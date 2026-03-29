import assert from "node:assert/strict";
import test from "node:test";

import {
  importWorkspaceModule,
  readJsonFile,
  resolveFromRepo
} from "./helpers.mjs";

const aiBootstrap = await importWorkspaceModule("packages/ai-bootstrap/dist/ai-bootstrap/src/index.js");
const aiBootstrapHttp = await importWorkspaceModule(
  "packages/ai-bootstrap-http/dist/ai-bootstrap-http/src/index.js"
);
const aiBootstrapOpenAI = await importWorkspaceModule(
  "packages/ai-bootstrap-openai/dist/ai-bootstrap-openai/src/index.js"
);

const captures = await readJsonFile(resolveFromRepo("tests/fixtures/bootstrap/captures.json"));
const suggestions = await readJsonFile(resolveFromRepo("tests/fixtures/bootstrap/suggestions.json"));

const bootstrapOptions = {
  appName: "Demo Bootstrap",
  routes: ["/"],
  targetUrl: "https://demo.example"
};

const structuredRequest = {
  input: {
    app: {
      name: "Demo Bootstrap"
    }
  },
  model: "fixture-model",
  schema: {
    type: "array"
  },
  system_prompt: "Return only JSON."
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}

function createAbortableFetch() {
  return async (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      const signal = options.signal;
      const rejectAbort = () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };

      if (signal?.aborted) {
        rejectAbort();
        return;
      }

      signal?.addEventListener("abort", rejectAbort, {
        once: true
      });
    });
}

async function assertBootstrapProviderError(run, expected) {
  await assert.rejects(run, (error) => {
    assert.equal(aiBootstrap.isAICBootstrapProviderError(error), true);
    assert.equal(error.kind, expected.kind);
    assert.equal(error.retryable, expected.retryable);

    if (expected.status !== undefined) {
      assert.equal(error.status, expected.status);
    }

    if (expected.attempts !== undefined) {
      assert.equal(error.attempts, expected.attempts);
    }

    if (expected.providerPrefix) {
      assert.match(error.provider, expected.providerPrefix);
    }

    if (expected.message) {
      assert.match(error.message, expected.message);
    }

    return true;
  });
}

test("createBootstrapSuggestionPrompt builds a deterministic provider payload", () => {
  const prompt = aiBootstrap.createBootstrapSuggestionPrompt(bootstrapOptions, captures, 8);

  assert.equal(prompt.input.app.name, "Demo Bootstrap");
  assert.equal(prompt.input.max_suggestions, 8);
  assert.deepEqual(prompt.input.routes, ["/"]);
  assert.equal(prompt.schema.type, "array");
  assert.match(prompt.system_prompt, /Return only JSON/);
});

test("generateBootstrapDraft normalizes and deduplicates static suggestions", async () => {
  const provider = aiBootstrap.createStaticBootstrapSuggestionProvider(
    [
      suggestions[0],
      {
        ...suggestions[0],
        confidence_score: 0.55
      }
    ],
    "file-model"
  );

  const review = await aiBootstrap.generateBootstrapReview(bootstrapOptions, captures, provider);
  const draft = review.draft;

  assert.equal(draft.provider_name, "file-model");
  assert.equal(draft.suggestions.length, 1);
  assert.equal(draft.ui.length, 1);
  assert.equal(draft.ui[0].elements[0].id, "customer.archive");
  assert.equal(draft.ui[0].elements[0].provenance.ai_suggested.source, "ai_suggested");
  assert.equal(review.summary.accepted_suggestions, 1);
  assert.equal(review.summary.filtered_suggestions, 1);
  assert.equal(review.suggestions[1].status, "filtered_out");
  assert.equal(review.suggestions[1].issues[0].code, "duplicate_target");
});

test("generateBootstrapReview applies minConfidence and surfaces validation issues", async () => {
  const provider = aiBootstrap.createStaticBootstrapSuggestionProvider(
    [
      {
        ...suggestions[0],
        confidence_score: 0.49
      },
      suggestions[1]
    ],
    "file-model"
  );

  const review = await aiBootstrap.generateBootstrapReview(
    {
      ...bootstrapOptions,
      appName: ""
    },
    captures,
    provider,
    {
      minConfidence: 0.5
    }
  );

  assert.equal(review.summary.accepted_suggestions, 1);
  assert.equal(review.summary.filtered_suggestions, 1);
  assert.equal(review.draft.suggestions[0].target, "customer.send_renewal_email");
  assert.equal(review.suggestions[0].status, "filtered_out");
  assert.equal(review.suggestions[0].issues[0].code, "below_min_confidence");
  assert.ok(review.issues.some((issue) => issue.code === "manifest_validation"));
  assert.match(aiBootstrap.renderBootstrapReviewReport(review), /Validation issues: 1/);
});

test("HTTP bootstrap provider normalizes JSON responses from a generic endpoint", async () => {
  const provider = aiBootstrapHttp.createHttpBootstrapSuggestionProvider({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [suggestions[1]] }), {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      }),
    model: "fixture-model",
    providerName: "http:fixture-model"
  });

  const normalized = await provider.suggest({
    captures,
    options: bootstrapOptions
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].provider, "http:fixture-model");
  assert.equal(normalized[0].target, "customer.send_renewal_email");
});

test("HTTP structured client retries transient failures and succeeds", async () => {
  let attempts = 0;
  const provider = aiBootstrapHttp.createHttpBootstrapSuggestionProvider({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () => {
      attempts += 1;
      return attempts === 1 ? new Response("temporary failure", { status: 503 }) : jsonResponse({ data: [suggestions[1]] });
    },
    model: "fixture-model",
    retries: 1
  });

  const normalized = await provider.suggest({
    captures,
    options: bootstrapOptions
  });

  assert.equal(attempts, 2);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].target, "customer.send_renewal_email");
});

test("HTTP structured client exhausts retries on rate limits", async () => {
  let attempts = 0;
  const client = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () => {
      attempts += 1;
      return new Response("slow down", { status: 429 });
    },
    retries: 2
  });

  await assertBootstrapProviderError(() => client.completeJson(structuredRequest), {
    attempts: 3,
    kind: "rate_limit",
    providerPrefix: /^http:https:\/\/provider\.example\/suggest$/,
    retryable: true,
    status: 429
  });
  assert.equal(attempts, 3);
});

test("HTTP structured client exhausts retries on server failures", async () => {
  let attempts = 0;
  const client = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () => {
      attempts += 1;
      return new Response("bad gateway", { status: 502 });
    },
    retries: 1
  });

  await assertBootstrapProviderError(() => client.completeJson(structuredRequest), {
    attempts: 2,
    kind: "server",
    retryable: true,
    status: 502
  });
  assert.equal(attempts, 2);
});

test("HTTP structured client normalizes timeouts, network failures, invalid JSON, invalid responses, and client errors", async () => {
  const timeoutClient = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: createAbortableFetch(),
    retries: 0,
    timeoutMs: 5
  });
  await assertBootstrapProviderError(() => timeoutClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "timeout",
    retryable: true
  });

  let networkAttempts = 0;
  const networkClient = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () => {
      networkAttempts += 1;
      throw new TypeError("fetch failed");
    },
    retries: 1
  });
  await assertBootstrapProviderError(() => networkClient.completeJson(structuredRequest), {
    attempts: 2,
    kind: "network",
    retryable: true
  });
  assert.equal(networkAttempts, 2);

  const invalidJsonClient = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () =>
      new Response("not-json", {
        headers: {
          "content-type": "application/json"
        },
        status: 200
      }),
    retries: 2
  });
  await assertBootstrapProviderError(() => invalidJsonClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "invalid_json",
    retryable: false
  });

  const invalidResponseClient = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () => jsonResponse({ data: {} }),
    responseSelector: "data.items",
    retries: 2
  });
  await assertBootstrapProviderError(() => invalidResponseClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "invalid_response",
    message: /response selector/,
    retryable: false
  });

  let clientAttempts = 0;
  const clientError = aiBootstrapHttp.createHttpStructuredModelClient({
    endpoint: "https://provider.example/suggest",
    fetchImpl: async () => {
      clientAttempts += 1;
      return new Response("bad request", { status: 400 });
    },
    retries: 2
  });
  await assertBootstrapProviderError(() => clientError.completeJson(structuredRequest), {
    attempts: 1,
    kind: "client",
    retryable: false,
    status: 400
  });
  assert.equal(clientAttempts, 1);
});

test("OpenAI bootstrap provider consumes Responses API style structured output", async () => {
  const provider = aiBootstrapOpenAI.createOpenAIBootstrapSuggestionProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify([suggestions[0]])
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      ),
    model: "gpt-5.4-mini",
    providerName: "openai:gpt-5.4-mini"
  });

  const review = await aiBootstrap.generateBootstrapReview(bootstrapOptions, captures, provider);
  const draft = review.draft;

  assert.equal(draft.provider_name, "openai:gpt-5.4-mini");
  assert.equal(draft.suggestions.length, 1);
  assert.equal(draft.suggestions[0].target, "customer.archive");
  assert.match(aiBootstrap.renderBootstrapReviewReport(review), /Suggestion provider: openai:gpt-5\.4-mini/);
  assert.match(aiBootstrap.renderBootstrapReport(draft), /Accepted suggestions: 1/);
});

test("OpenAI structured client retries transient failures and succeeds", async () => {
  let attempts = 0;
  const provider = aiBootstrapOpenAI.createOpenAIBootstrapSuggestionProvider({
    apiKey: "test-key",
    fetchImpl: async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("temporary failure", { status: 503 })
        : jsonResponse({
            output_text: JSON.stringify([suggestions[0]])
          });
    },
    model: "gpt-5.4-mini",
    retries: 1
  });

  const review = await aiBootstrap.generateBootstrapReview(bootstrapOptions, captures, provider);
  assert.equal(attempts, 2);
  assert.equal(review.draft.suggestions[0].target, "customer.archive");
});

test("OpenAI structured client exhausts retries on rate limits and server failures", async () => {
  let rateLimitAttempts = 0;
  const rateLimited = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () => {
      rateLimitAttempts += 1;
      return new Response("rate limited", { status: 429 });
    },
    retries: 2
  });
  await assertBootstrapProviderError(() => rateLimited.completeJson(structuredRequest), {
    attempts: 3,
    kind: "rate_limit",
    retryable: true,
    status: 429
  });
  assert.equal(rateLimitAttempts, 3);

  let serverAttempts = 0;
  const serverError = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () => {
      serverAttempts += 1;
      return new Response("upstream unavailable", { status: 503 });
    },
    retries: 1
  });
  await assertBootstrapProviderError(() => serverError.completeJson(structuredRequest), {
    attempts: 2,
    kind: "server",
    retryable: true,
    status: 503
  });
  assert.equal(serverAttempts, 2);
});

test("OpenAI structured client normalizes timeouts, network failures, invalid JSON, invalid responses, refusals, and auth errors", async () => {
  const timeoutClient = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: createAbortableFetch(),
    retries: 0,
    timeoutMs: 5
  });
  await assertBootstrapProviderError(() => timeoutClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "timeout",
    retryable: true
  });

  let networkAttempts = 0;
  const networkClient = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () => {
      networkAttempts += 1;
      throw new TypeError("socket hang up");
    },
    retries: 1
  });
  await assertBootstrapProviderError(() => networkClient.completeJson(structuredRequest), {
    attempts: 2,
    kind: "network",
    retryable: true
  });
  assert.equal(networkAttempts, 2);

  const invalidJsonClient = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () =>
      jsonResponse({
        output_text: "{"
      }),
    retries: 2
  });
  await assertBootstrapProviderError(() => invalidJsonClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "invalid_json",
    retryable: false
  });

  const invalidResponseClient = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () =>
      jsonResponse({
        output: []
      }),
    retries: 2
  });
  await assertBootstrapProviderError(() => invalidResponseClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "invalid_response",
    retryable: false
  });

  const refusalClient = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () =>
      jsonResponse({
        output: [
          {
            refusal: "Policy disallowed."
          }
        ]
      }),
    retries: 2
  });
  await assertBootstrapProviderError(() => refusalClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "model_refusal",
    retryable: false
  });

  let authAttempts = 0;
  const authClient = aiBootstrapOpenAI.createOpenAIStructuredModelClient({
    apiKey: "test-key",
    fetchImpl: async () => {
      authAttempts += 1;
      return new Response("unauthorized", { status: 401 });
    },
    retries: 2
  });
  await assertBootstrapProviderError(() => authClient.completeJson(structuredRequest), {
    attempts: 1,
    kind: "auth",
    retryable: false,
    status: 401
  });
  assert.equal(authAttempts, 1);
});
