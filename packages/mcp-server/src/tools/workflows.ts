import { z } from "zod";
import { validateWorkflowManifest } from "@aicorg/spec";
import {
  fetchDiscovery,
  fetchManifest,
  resolveEndpointUrl
} from "../fetch-manifest.js";
import type { AICWorkflowManifest } from "@aicorg/spec";

export const workflowsToolName = "get_aic_workflows";

export const workflowsToolDescription =
  "Get the workflow definitions for an AIC-instrumented web app. " +
  "Workflows describe multi-step processes like checkout flows, onboarding wizards, " +
  "or approval chains. Each workflow includes its steps, entry points, " +
  "checkpoint steps, human approval requirements, rollback/fallback steps, " +
  "completion signals, and estimated duration. " +
  "Optionally filter to a single workflow by ID.";

export const workflowsToolSchema = {
  base_url: z
    .string()
    .describe("Base URL of the AIC-instrumented web app (e.g. http://localhost:3000)"),
  workflow_id: z
    .string()
    .optional()
    .describe("Optional: return only the workflow with this ID")
};

export async function handleWorkflows(args: {
  base_url: string;
  workflow_id?: string;
}): Promise<string> {
  const discovery = await fetchDiscovery(args.base_url);

  const workflowsUrl = discovery.ok
    ? resolveEndpointUrl(
        args.base_url,
        discovery.data.endpoints?.workflows,
        "/agent-workflows.json"
      )
    : resolveEndpointUrl(args.base_url, undefined, "/agent-workflows.json");

  const result = await fetchManifest<AICWorkflowManifest>(workflowsUrl);

  if (!result.ok) {
    return JSON.stringify({
      success: false,
      error: result.error,
      hint: "Workflows manifest may not be configured. The app may not define multi-step flows."
    });
  }

  const validation = validateWorkflowManifest(result.data);
  let workflows = result.data.workflows ?? [];

  if (args.workflow_id) {
    workflows = workflows.filter((w) => w.id === args.workflow_id);

    if (workflows.length === 0) {
      const available = (result.data.workflows ?? []).map((w) => w.id);
      return JSON.stringify({
        success: false,
        error: `Workflow "${args.workflow_id}" not found.`,
        available_workflows: available
      });
    }
  }

  return JSON.stringify({
    success: true,
    workflow_count: workflows.length,
    workflows: workflows.map((w) => ({
      id: w.id,
      title: w.title,
      step_count: w.steps.length,
      steps: w.steps,
      entry_points: w.entry_points,
      checkpoint_steps: w.checkpoint_steps ?? [],
      human_approval_steps: w.human_approval_steps ?? [],
      rollback_steps: w.rollback_steps ?? [],
      fallback_steps: w.fallback_steps ?? [],
      retryable_steps: w.retryable_steps ?? [],
      preconditions: w.preconditions ?? [],
      completion_signal: w.completion_signal ?? null,
      estimated_duration_ms: w.estimated_duration_ms ?? null
    })),
    validation: {
      valid: validation.ok,
      issues: validation.issues.length > 0 ? validation.issues : undefined
    }
  });
}
