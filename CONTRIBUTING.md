# Contributing

## Working Agreement

- Keep changes aligned with the current supported boundary in [docs/supported-today.md](/mnt/c/users/vatsa/agentinteractioncontrol/docs/supported-today.md).
- Prefer explicit contract improvements over heuristic behavior.
- Do not broaden repo mutation, extraction, or provider behavior without tests and docs in the same change.

## Local Workflow

1. Install dependencies with `pnpm install`.
2. Run `pnpm check`.
3. Run `pnpm build`.
4. Run `pnpm test`.
5. If manifest or fixture outputs changed, run `pnpm test:update-goldens` and then `pnpm test:goldens`.

## Pull Requests

- Keep PRs scoped to one milestone or one subsystem.
- Update docs when the public behavior or supported boundary changes.
- Include tests for any behavior change.
- Call out intentional contract changes in the PR description.

## Ground Rules

- The CLI is the only supported repo-mutation path.
- Runtime UI is the authoritative source for rich per-element metadata.
- Bootstrap suggestions remain review inputs, not a source of truth.
