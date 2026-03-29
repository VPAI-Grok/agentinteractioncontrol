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

## npm Alpha Release Gates

- first-wave package manifests are public and include publish metadata
- tarball smoke tests are green
- package matrix docs match the current publish wave
- manual publish workflow is configured with npm-token expectations documented

## Not In This Release

- stable GA npm publishing
- non-React platform support
- heuristic repo mutation
