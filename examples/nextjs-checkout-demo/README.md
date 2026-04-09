# Agent Interaction Control: Next.js Checkout Demo

This is a demonstration of how to integrate the [@aicorg/sdk-react](https://www.npmjs.com/package/@aicorg/sdk-react) and [@aicorg/plugin-next](https://www.npmjs.com/package/@aicorg/plugin-next) into a complex, multi-step Next.js workflow with structured validation and semantic boundaries.

## Demo: Autonomous Agent Execution

This example proves that an AI agent using the standard MCP protocol can autonomously operate a Next.js web application utilizing AIC components, without brittle DOM selectors.

Here is the repo's canonical Next.js AIC starter. It demonstrates generated manifests, MCP discovery, and a critical-action contract with structured confirmation.

## Getting Started

1. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```

2. Generate the AIC manifests using the local CLI toolkit:
   ```bash
   pnpm run aic:generate
   ```

3. Audit the example:
   ```bash
   pnpm run aic:doctor
   ```

4. Start the Next.js development server:
   ```bash
   pnpm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Simulating the Agent Connection (MCP)

To verify the MCP Server integration against this Next.js app:

1. Keep the Next.js developer server running on `localhost:3000`.
2. In a new terminal within this directory, run the simulation script:
   ```bash
   node simulate-mcp-client.mjs
   ```
3. The script connects to the AIC MCP Server over `stdio` and lists actionable elements extracted directly from the generated static files.

## Useful Commands

```bash
pnpm aic --help
pnpm run aic:doctor
pnpm run aic:generate
pnpm run aic:inspect
```
