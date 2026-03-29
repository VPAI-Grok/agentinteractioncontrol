# Release Checklist

## Technical Gates

- `pnpm check`
- `pnpm build`
- `pnpm test`
- `pnpm test:goldens`

## Contract Proof Gates

- example runtime proof tests are green
- reference consumer proof tests are green
- supported-boundary docs reflect the current product surface

## Repo Launch Gates

- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md` are present
- README links to the examples, supported-boundary doc, and proof harness
- GitHub issue and PR templates are present
- CI workflow is enabled on the default branch

## Not In This Release

- npm publishing
- non-React platform support
- heuristic repo mutation
