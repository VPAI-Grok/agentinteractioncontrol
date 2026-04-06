# Twenty Official Benchmark Report

## Scope

This report covers the current official local benchmark run against the validated Twenty opportunity-management slice.

Benchmark target used in this run:

- opportunity: `MacBook Pro Fleet Upgrade`
- company: `Google`
- entity id: `50505050-0002-4e7c-8001-123456789abc`

Artifacts:

- raw results: [`benchmark-results-official.csv`](./benchmark-results-official.csv)
- generated summary: [`benchmark-summary-official.md`](./benchmark-summary-official.md)
- run procedure: [`official-run-matrix.md`](./official-run-matrix.md)

## Main Findings

### 1. The real Twenty destructive slice is now green end to end

The benchmark now passes on the real adopted Twenty slice:

- `twenty_contract_comprehension`: `100%`
- `twenty_detail_navigation` baseline: `100%`
- `twenty_detail_navigation` aic: `100%`
- `twenty_irreversible_destroy_cancel` baseline: `100%`
- `twenty_irreversible_destroy_cancel` aic: `100%`
- `twenty_record_note_create` baseline: `100%`
- `twenty_record_note_create` aic: `100%`
- `twenty_record_task_create` baseline: `100%`
- `twenty_record_task_create` aic: `100%`
- `twenty_list_sort_stage_open_record` baseline: `100%`
- `twenty_list_sort_stage_open_record` aic: `100%`
- `twenty_list_filter_stage_meeting_open_record` baseline: `100%`
- `twenty_list_filter_stage_meeting_open_record` aic: `100%`
- `twenty_record_stage_change` baseline: `100%`
- `twenty_record_stage_change` aic: `100%`
- `twenty_list_filter_stage_meeting_clear` baseline: `100%`
- `twenty_list_filter_stage_meeting_clear` aic: `100%`

This is no longer a toy-demo result. The validated flow is:

1. open the real opportunity record
2. expose the soft-delete action from the live action surface
3. transition to the deleted state
4. expose the irreversible destroy action
5. open the critical confirmation modal
6. cancel without permanently destroying the record

### 2. AIC materially improves contract quality on the real app

The clearest AIC gain is semantic correctness, not raw speed:

- `twenty_contract_comprehension`
  - success: `100%`
  - contract correctness: `1.00`
- `twenty_detail_navigation`
  - baseline contract correctness: `0.40`
  - aic contract correctness: `0.90`
- `twenty_irreversible_destroy_cancel`
  - baseline contract correctness: `0.60`
  - aic contract correctness: `1.00`
- `twenty_record_note_create`
  - baseline contract correctness: `0.35`
  - aic contract correctness: `0.95`
- `twenty_record_task_create`
  - baseline contract correctness: `0.40`
  - aic contract correctness: `0.95`
- `twenty_list_sort_stage_open_record`
  - baseline contract correctness: `0.45`
  - aic contract correctness: `0.95`
- `twenty_list_filter_stage_meeting_open_record`
  - baseline contract correctness: `0.50`
  - aic contract correctness: `0.95`
- `twenty_record_stage_change`
  - baseline contract correctness: `0.50`
  - aic contract correctness: `0.90`
- `twenty_list_filter_stage_meeting_clear`
  - baseline contract correctness: `0.55`
  - aic contract correctness: `1.00`

That is the right benchmark shape for AIC. The system is surfacing exact record identity, destructive-risk semantics, and confirmation boundaries on a real CRM app.

### 3. Stage mutation is now measured in the official run

`twenty_record_stage_change` is now part of the official CSV-backed benchmark.

Measured result:

- baseline success: `100%`
- aic success: `100%`
- baseline contract correctness: `0.50`
- aic contract correctness: `0.90`
- baseline time: `4.5s`
- aic time: `4.2s`

This confirms that the opportunity-level lifecycle field is not only real in the adopted app, but now exercised by the official local harness as well.

One remaining integration gap is still visible in the AIC path:

- the first `open_editor` and final stage option are fully semantic
- the intermediate edit-mode trigger still does not carry its own stable semantic id
- that keeps the stage AIC run strong, but not yet perfect

### 4. Active filter clear is now measured too

`twenty_list_filter_stage_meeting_clear` is now part of the official CSV-backed benchmark.

Measured result:

- baseline success: `100%`
- aic success: `100%`
- baseline contract correctness: `0.55`
- aic contract correctness: `1.00`
- baseline time: `11.2s`
- aic time: `11.2s`

This matters because it proves AIC can model the full lifecycle of a real list filter, not just how to apply it. The agent can now target the exact active `Stage : Meeting` filter chip and clear it through a stable remove control.

### 5. The prior destructive-flow failures were a real integration bug, not fake benchmark noise

The earlier red run exposed a concrete issue:

- visible command items for restore were registering duplicate AIC IDs after soft delete
- the runtime correctly rejected the duplicate contract entry
- the record page fell into the app error boundary

That issue is now fixed by making visible command-surface IDs unique per rendered instance while keeping the semantic prefixes stable.

## Scenario Results

### `twenty_contract_comprehension` (`aic`)

- success: `1`
- contract correctness: `1.00`
- workflow accuracy: `1.00`

Interpretation:

- the live record page is semantically discoverable
- the more-actions entry is modeled
- the visible soft-delete command is entity-scoped and risk-labeled
- the irreversible destroy confirmation boundary is modeled explicitly

### `twenty_detail_navigation`

- baseline success: `1`
- aic success: `1`
- baseline time: `17.2s`
- aic time: `15.9s`
- baseline steps: `6`
- aic steps: `6`

Interpretation:

- navigation was already operable in both modes
- AIC did not materially reduce steps on this slice
- AIC did improve contract clarity from `0.40` to `0.90`

### `twenty_irreversible_destroy_cancel`

- baseline success: `1`
- aic success: `1`
- baseline time: `16.4s`
- aic time: `16.0s`
- baseline steps: `5`
- aic steps: `6`
- baseline contract correctness: `0.60`
- aic contract correctness: `1.00`

Interpretation:

- both modes can now complete the safety workflow
- AIC’s value on this slice is not fewer clicks
- AIC’s value is that the destructive path is fully modeled:
  - correct entity
  - correct risk level
  - correct confirmation boundary
  - correct cancel outcome

### `twenty_record_note_create`

- baseline success: `1`
- aic success: `1`
- baseline time: `15.0s`
- aic time: `14.7s`
- baseline steps: `4`
- aic steps: `4`
- baseline contract correctness: `0.35`
- aic contract correctness: `0.95`

Interpretation:

- both modes can create a note once the record page is open
- AIC does not make this flow meaningfully faster yet
- AIC does make the mutation path much more explicit:
  - the note entry point is tied to the exact opportunity
  - the editor surface is tied to the exact note entity
  - the editor now carries autosave execution and recovery semantics

One real benchmark constraint surfaced during validation:

- the record-scoped `opportunity.note.add.*` control is only visible after switching to the Notes tab
- so the official note scenario treats tab selection as a workflow prerequisite before the AIC note action becomes available

### `twenty_record_task_create`

- baseline success: `1`
- aic success: `1`
- baseline time: `16.2s`
- aic time: `16.1s`
- baseline steps: `3`
- aic steps: `3`
- baseline contract correctness: `0.40`
- aic contract correctness: `0.95`

Interpretation:

- both modes can create a task on the exact opportunity from the record-scoped task surface
- AIC does not materially change speed on this slice
- AIC does materially improve contract quality:
  - the task entrypoint is tied to the exact opportunity
  - the task editor is tied to the exact task entity
  - the task body editor already exposes autosave execution and recovery semantics

One real integration issue surfaced and is now fixed in the Twenty fork:

- the task widget originally registered duplicate add-task agent IDs between the empty-state and list surfaces
- the runtime correctly rejected the duplicate contract entry
- the fix was to split those surfaces into stable distinct IDs by UI context

### `twenty_list_sort_stage_open_record`

- baseline success: `1`
- aic success: `1`
- baseline time: `12.5s`
- aic time: `11.8s`
- baseline steps: `3`
- aic steps: `3`
- baseline contract correctness: `0.45`
- aic contract correctness: `0.95`

Interpretation:

- both modes can complete a simple list-level workflow
- AIC does not materially reduce interaction count on this slice
- AIC does make the list contract much clearer:
  - the opportunities sort trigger is explicit
  - the stage sort-field option is explicit
  - the row-open surface remains tied to the exact opportunity entity

### `twenty_list_filter_stage_meeting_open_record`

- baseline success: `1`
- aic success: `1`
- baseline time: `13.7s`
- aic time: `13.9s`
- baseline steps: `4`
- aic steps: `4`
- baseline contract correctness: `0.50`
- aic contract correctness: `0.95`

Interpretation:

- both modes can complete a real list-level filter workflow and open the target record
- the important Twenty behavior here is that opening the record from the filtered list keeps the user on the same page and opens the record in-place via the side panel
- AIC materially improves the contract on this slice because:
  - the filter trigger is explicit
  - the `Stage` field-selection surface is explicit
  - the `Meeting` option surface is explicit
  - the list identifier open surface is tied to the exact opportunity entity

### `twenty_record_stage_change`
- baseline success: `1`
- aic success: `1`
- baseline time: `4.5s`
- aic time: `4.2s`
- baseline steps: `3`
- aic steps: `3`
- baseline contract correctness: `0.50`
- aic contract correctness: `0.90`

Interpretation:

- the opportunity-level lifecycle field is now confirmed to be operable in the live adopted app
- this is a real record mutation, not a task-level status edit
- the path is now stable enough for the official local harness
- AIC improves contract quality on this slice, but not yet to the same `0.95-1.00` level as the stronger Twenty surfaces because the intermediate edit-mode trigger still needs its own stable semantic id

### `twenty_list_filter_stage_meeting_clear`

- baseline success: `1`
- aic success: `1`
- baseline time: `11.2s`
- aic time: `11.2s`
- baseline steps: `5`
- aic steps: `5`
- baseline contract correctness: `0.55`
- aic contract correctness: `1.00`

Interpretation:

- both modes can apply and then clear the active `Stage : Meeting` filter
- AIC does not materially reduce time on this slice
- AIC does complete the filter contract on this slice:
  - filter trigger
  - field selection
  - value selection
  - active filter chip
  - exact remove control for that chip

## What This Means For AIC

The benchmark is now proving two things at once:

- AIC can be adopted into a real open-source CRM slice
- AIC improves contract quality and safety semantics on that slice in a way agents can actually use

This is stronger evidence than the earlier demo benchmarks because it includes:

- authenticated routing
- dense entity UI
- real record targeting
- destructive state transition
- critical confirmation handling
- record-scoped mutation with autosave
- a second and third record-scoped mutation path with separate widget surfaces
- a list-level sort workflow with explicit trigger and field-selection semantics
- a list-level filter workflow with explicit trigger, field-selection, value-selection, and in-place record-open semantics
- a list-level filter lifecycle with explicit active-chip clear semantics
- a record-level stage mutation workflow

## Current Stage

The Twenty destructive-safety slice is now in the first publishable state.

That means the project is no longer at:

- “does AIC work at all?”

It is now at:

- “the first real-app slice works, and the next milestone is widening the real-app proof surface”

## Recommended Next Step

Stay on Twenty, but widen carefully instead of redoing the same slice again.

Recommended order:

1. tighten the stage mutation contract by adding a stable semantic id on the intermediate edit-mode trigger
2. add one more list-level workflow after that
   - best next candidate: a second filter-value path or filter reset from a different field
3. verify the same mutation path from both direct detail open and filtered-list open states
4. only after that, consider a second external app

The key point is that the benchmark should now widen from a working real slice, not retreat back to toy demos.
