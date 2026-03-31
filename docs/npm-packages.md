# npm Packages

The core `@aicorg/*` packages are now published to npm under the `alpha` tag.

## Published Alpha Wave

| Package | Purpose |
| --- | --- |
| `@aicorg/spec` | Manifest types, validators, and diff helpers |
| `@aicorg/runtime` | Runtime registry and manifest serialization |
| `@aicorg/sdk-react` | React SDK for explicit AIC annotations |
| `@aicorg/automation-core` | Deterministic scanning, artifact generation, init, and doctor helpers |
| `@aicorg/cli` | `aic` command-line interface |
| `@aicorg/plugin-vite` | Vite scanning and artifact generation helpers |
| `@aicorg/plugin-next` | Next.js scanning and artifact generation helpers |
| `@aicorg/integrations-radix` | Radix UI helper factories |
| `@aicorg/integrations-shadcn` | shadcn/ui wrapper components |
| `@aicorg/ai-bootstrap` | Bootstrap prompt and review tooling |
| `@aicorg/ai-bootstrap-http` | Generic HTTP bootstrap provider adapter |
| `@aicorg/ai-bootstrap-openai` | OpenAI bootstrap provider adapter |
| `@aicorg/mcp-server` | MCP server exposing AIC manifests to AI agents |

## Deferred From The First npm Wave

- `@aicorg/devtools`
  Remains repo-only for now because its extension-shell packaging needs a separate release story.
- `examples/*`
  Stay private as demos, proof surfaces, and test fixtures.

## Install Targets

Core runtime and React adoption:

```bash
pnpm add @aicorg/spec @aicorg/runtime @aicorg/sdk-react
```

CLI-driven onboarding and artifact generation:

```bash
pnpm add -D @aicorg/cli
```

Framework and integration helpers:

```bash
pnpm add @aicorg/plugin-vite @aicorg/plugin-next @aicorg/integrations-radix @aicorg/integrations-shadcn
```

Bootstrap providers:

```bash
pnpm add @aicorg/ai-bootstrap @aicorg/ai-bootstrap-http @aicorg/ai-bootstrap-openai
```

MCP server for AI agent integration (Claude Desktop, Cursor, etc.):

```bash
npx @aicorg/mcp-server
```

## Release Notes

- The current npm release uses the `alpha` tag.
- Workspace examples and deferred packages are intentionally not published.
- Package tarballs are validated with local smoke tests before any publish step runs in CI.
