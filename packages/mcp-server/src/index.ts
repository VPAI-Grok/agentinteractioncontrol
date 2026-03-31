#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  discoverToolName,
  discoverToolDescription,
  discoverToolSchema,
  handleDiscover
} from "./tools/discover.js";

import {
  uiStateToolName,
  uiStateToolDescription,
  uiStateToolSchema,
  handleUiState
} from "./tools/ui-state.js";

import {
  listElementsToolName,
  listElementsToolDescription,
  listElementsToolSchema,
  handleListElements
} from "./tools/list-elements.js";

import {
  permissionsToolName,
  permissionsToolDescription,
  permissionsToolSchema,
  handlePermissions
} from "./tools/permissions.js";

import {
  workflowsToolName,
  workflowsToolDescription,
  workflowsToolSchema,
  handleWorkflows
} from "./tools/workflows.js";

import {
  actionsToolName,
  actionsToolDescription,
  actionsToolSchema,
  handleActions
} from "./tools/actions.js";

const server = new McpServer({
  name: "aic-mcp-server",
  version: "0.1.0"
});

// --- Tool registrations ---

server.tool(
  discoverToolName,
  discoverToolDescription,
  discoverToolSchema,
  async (args) => ({
    content: [{ type: "text", text: await handleDiscover(args) }]
  })
);

server.tool(
  uiStateToolName,
  uiStateToolDescription,
  uiStateToolSchema,
  async (args) => ({
    content: [{ type: "text", text: await handleUiState(args) }]
  })
);

server.tool(
  listElementsToolName,
  listElementsToolDescription,
  listElementsToolSchema,
  async (args) => ({
    content: [{ type: "text", text: await handleListElements(args) }]
  })
);

server.tool(
  permissionsToolName,
  permissionsToolDescription,
  permissionsToolSchema,
  async (args) => ({
    content: [{ type: "text", text: await handlePermissions(args) }]
  })
);

server.tool(
  workflowsToolName,
  workflowsToolDescription,
  workflowsToolSchema,
  async (args) => ({
    content: [{ type: "text", text: await handleWorkflows(args) }]
  })
);

server.tool(
  actionsToolName,
  actionsToolDescription,
  actionsToolSchema,
  async (args) => ({
    content: [{ type: "text", text: await handleActions(args) }]
  })
);

// --- Start ---

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AIC MCP Server running on stdio");
}

main().catch((error) => {
  console.error("AIC MCP Server failed to start:", error);
  process.exit(1);
});
