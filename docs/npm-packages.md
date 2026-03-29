# npm Packages

This repo is preparing an alpha npm release for the core `@aic/*` packages.

## Planned Alpha Publish Wave

| Package | Purpose |
| --- | --- |
| `@aic/spec` | Manifest types, validators, and diff helpers |
| `@aic/runtime` | Runtime registry and manifest serialization |
| `@aic/sdk-react` | React SDK for explicit AIC annotations |
| `@aic/automation-core` | Deterministic scanning, artifact generation, init, and doctor helpers |
| `@aic/cli` | `aic` command-line interface |
| `@aic/plugin-vite` | Vite scanning and artifact generation helpers |
| `@aic/plugin-next` | Next.js scanning and artifact generation helpers |
| `@aic/integrations-radix` | Radix UI helper factories |
| `@aic/integrations-shadcn` | shadcn/ui wrapper components |
| `@aic/ai-bootstrap` | Bootstrap prompt and review tooling |
| `@aic/ai-bootstrap-http` | Generic HTTP bootstrap provider adapter |
| `@aic/ai-bootstrap-openai` | OpenAI bootstrap provider adapter |

## Deferred From The First npm Wave

- `@aic/devtools`
  Remains repo-only for now because its extension-shell packaging needs a separate release story.
- `examples/*`
  Stay private as demos, proof surfaces, and test fixtures.

## Install Targets After The First Alpha Publish

Core runtime and React adoption:

```bash
pnpm add @aic/spec @aic/runtime @aic/sdk-react
```

CLI-driven onboarding and artifact generation:

```bash
pnpm add -D @aic/cli
```

Framework and integration helpers:

```bash
pnpm add @aic/plugin-vite @aic/plugin-next @aic/integrations-radix @aic/integrations-shadcn
```

Bootstrap providers:

```bash
pnpm add @aic/ai-bootstrap @aic/ai-bootstrap-http @aic/ai-bootstrap-openai
```

## Release Notes

- The first npm release is intended to use an alpha tag.
- Workspace examples and deferred packages are intentionally not published.
- Package tarballs are validated with local smoke tests before any publish step runs in CI.
