import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const mcpToolsRoot = path.resolve(repoRoot, "packages/mcp-server/dist/mcp-server/src/tools");

const { handleDiscover } = await import(pathToFileURL(path.join(mcpToolsRoot, "discover.js")).href);
const { handleListElements } = await import(
  pathToFileURL(path.join(mcpToolsRoot, "list-elements.js")).href
);
const { handleUiState } = await import(pathToFileURL(path.join(mcpToolsRoot, "ui-state.js")).href);
const { handleWorkflows } = await import(pathToFileURL(path.join(mcpToolsRoot, "workflows.js")).href);
const { handleActions } = await import(pathToFileURL(path.join(mcpToolsRoot, "actions.js")).href);

const baseUrl = process.env.AIC_BASE_URL ?? "http://localhost:3000";
const outputFile = path.resolve(__dirname, "mcp-simulation-result.json");

async function main() {
  console.log(`Simulating MCP tool usage for Next.js checkout at ${baseUrl}...`);

  const discover = JSON.parse(await handleDiscover({ base_url: baseUrl }));
  const elements = JSON.parse(
    await handleListElements({
      base_url: baseUrl,
      actionable_only: true
    })
  );
  const uiState = JSON.parse(await handleUiState({ base_url: baseUrl }));
  const workflows = JSON.parse(await handleWorkflows({ base_url: baseUrl }));
  const actions = JSON.parse(await handleActions({ base_url: baseUrl }));

  const result = {
    actions,
    base_url: baseUrl,
    discover,
    elements,
    ui_state: uiState,
    workflows
  };

  await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Wrote MCP simulation result to ${outputFile}`);
  console.log(`Discovered app: ${discover.app?.name ?? "unknown"}`);
  console.log(`Actionable elements returned: ${elements.returned ?? 0}`);
}

void main();
