import { z } from "zod";
import { validateRuntimeUiManifest } from "@aicorg/spec";
import {
  fetchDiscovery,
  fetchManifest,
  resolveEndpointUrl
} from "../fetch-manifest.js";
import type { AICRuntimeUiManifest } from "@aicorg/spec";

export const uiStateToolName = "get_aic_ui_state";

export const uiStateToolDescription =
  "Get the full runtime UI state of an AIC-instrumented web app. " +
  "Returns every interactive element currently rendered on the page, including " +
  "stable IDs, roles, actions, risk levels, entity references, execution metadata, " +
  "recovery guidance, validation constraints, workflow links, and current state " +
  "(enabled, visible, busy, selected, value). This is the primary tool for " +
  "understanding what the user interface currently exposes.";

export const uiStateToolSchema = {
  base_url: z
    .string()
    .describe("Base URL of the AIC-instrumented web app (e.g. http://localhost:3000)")
};

export async function handleUiState(args: { base_url: string }): Promise<string> {
  const discovery = await fetchDiscovery(args.base_url);

  const uiUrl = discovery.ok
    ? resolveEndpointUrl(args.base_url, discovery.data.endpoints?.ui, "/.well-known/agent/ui")
    : resolveEndpointUrl(args.base_url, undefined, "/.well-known/agent/ui");

  const result = await fetchManifest<AICRuntimeUiManifest>(uiUrl);

  if (!result.ok) {
    return JSON.stringify({
      success: false,
      error: result.error,
      hint: "The UI manifest endpoint may not be available. Ensure the app is running and AIC is configured."
    });
  }

  const validation = validateRuntimeUiManifest(result.data);

  return JSON.stringify({
    success: true,
    page: result.data.page,
    view: result.data.view,
    element_count: result.data.elements?.length ?? 0,
    elements: result.data.elements,
    relationships: result.data.relationships ?? [],
    user_context: result.data.user_context ?? null,
    updated_at: result.data.updated_at,
    validation: {
      valid: validation.ok,
      issue_count: validation.issues.length,
      issues: validation.issues.length > 0 ? validation.issues : undefined
    }
  });
}
