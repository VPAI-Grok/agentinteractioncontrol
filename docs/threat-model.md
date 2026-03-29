# AIC Threat Model

This document captures the main safety and correctness risks for the current AIC v1 baseline.

## Primary Failure Modes

- Wrong-record actions because a row/card action lacks stable entity identity.
- High-risk actions executed without explicit confirmation semantics.
- Runtime/build drift where static manifests stop matching live UI state.
- Ambiguous or noisy inference that overstates action intent or risk.
- Unsafe write-back that edits the wrong source location.

## Current Mitigations

- Stable `agentId` values are the primary identity surface.
- Critical-risk elements are blocked unless structured confirmation metadata is present.
- Row/grid actions are warned when `entity_ref` is missing.
- Deterministic extraction avoids runtime evaluation and cross-module guessing.
- Devtools authoring is review-first and exports patch plans instead of mutating the repo directly.
- CLI apply only writes exact source matches and skips drifted or ambiguous proposals.
- Bootstrap suggestions preserve confidence and filtered-review context instead of silently merging.

## Trust Boundaries

There are three metadata provenance tiers:

- `authored`
- `inferred`
- `ai_suggested`

The system must preserve those sources so downstream users can decide how much trust to place in each field.

## v1 Safety Rules

- Prefer explicit annotations over inference on critical paths.
- Treat AI bootstrap as a review aid, not a source of truth.
- Keep mutation behind a guarded CLI path.
- Keep extraction deterministic and reviewable.
- Make contract diffs easy to inspect in fixtures and goldens.

## Deferred Risks

The repo does not yet fully solve:

- deeper custom-component semantic inference
- broad write-back across complex JSX patterns
- runtime authoring inside devtools
- provider-specific bootstrap governance beyond the current review bundle flow
- platform-wide governance, audit, or observability products

Those remain post-baseline areas and should not weaken the current guarded path.
