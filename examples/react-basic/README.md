# Agent Interaction Control: Vite CRM Demo

This is the canonical Vite starter for AIC in this repo. It demonstrates shadcn-style integration, runtime manifests, devtools surfaces, and generated project artifacts.

## Getting Started

1. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```

2. Generate AIC artifacts:
   ```bash
   pnpm --dir examples/react-basic run aic:generate
   ```

3. Audit readiness:
   ```bash
   pnpm --dir examples/react-basic run aic:doctor
   ```

4. Start the app:
   ```bash
   pnpm --dir examples/react-basic run dev
   ```

## Useful Commands

```bash
pnpm aic --help
pnpm --dir examples/react-basic run aic:doctor
pnpm --dir examples/react-basic run aic:generate
pnpm --dir examples/react-basic run aic:inspect
```
