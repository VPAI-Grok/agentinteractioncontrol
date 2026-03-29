import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const exampleRoot = resolve(currentDir, "..");
const workspaceRoot = resolve(exampleRoot, "..", "..");
const cliEntrypoint = resolve(workspaceRoot, "packages/cli/dist/cli/src/index.js");
const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
const providerTimeoutMs = process.env.OPENAI_PROVIDER_TIMEOUT_MS ?? "30000";
const providerRetries = process.env.OPENAI_PROVIDER_RETRIES ?? "2";

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required.");
  process.exit(1);
}

const args = [
  cliEntrypoint,
  "bootstrap",
  "https://demo.example",
  "--app-name",
  "DemoBootstrap",
  "--captures-file",
  "./captures/customers.json",
  "--provider-kind",
  "openai",
  "--provider-model",
  model,
  "--provider-timeout-ms",
  providerTimeoutMs,
  "--provider-retries",
  providerRetries,
  "--draft-file",
  "./output/draft.json",
  "--review-file",
  "./output/review.json",
  "--report-file",
  "./output/report.txt",
  "--prompt-file",
  "./output/prompt.json"
];

execFileSync(process.execPath, args, {
  cwd: exampleRoot,
  env: process.env,
  stdio: "inherit"
});
