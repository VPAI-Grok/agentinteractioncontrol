# Bootstrap OpenAI Example

This example runs the AIC bootstrap flow from a saved capture file and sends the prompt to the OpenAI Responses API through the built-in OpenAI adapter.

## Files

- `captures/customers.json`
  A saved capture payload for a simple customer page.
- `scripts/run-openai-bootstrap.mjs`
  Invokes the local AIC CLI with the OpenAI provider path.
- `output/`
  Generated prompt, report, review, and draft artifacts.

## Usage

1. Export `OPENAI_API_KEY`.
2. Optionally set `OPENAI_MODEL` to a different Responses-compatible model.
3. Optionally set `OPENAI_PROVIDER_TIMEOUT_MS` or `OPENAI_PROVIDER_RETRIES` if you want to override the default `30000` ms timeout and `2` retries for transient provider failures.
4. From this directory, run `pnpm bootstrap`.

The script writes:

- `output/prompt.json`
- `output/draft.json`
- `output/review.json`
- `output/report.txt`

The OpenAI-backed flow retries only on timeouts, network failures, `429`, and `5xx` responses. Invalid JSON, invalid structured output, authentication failures, and explicit model refusals fail immediately so the review bundle does not hide provider problems.

If you want to inspect the prompt without calling a model, run:

`node ../../packages/cli/dist/cli/src/index.js bootstrap https://demo.example --app-name DemoBootstrap --captures-file ./captures/customers.json --prompt-file ./output/prompt.json --print-prompt`
