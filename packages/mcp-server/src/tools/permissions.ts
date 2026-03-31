import { z } from "zod";
import { validatePermissionsManifest } from "@aicorg/spec";
import {
  fetchDiscovery,
  fetchManifest,
  resolveEndpointUrl
} from "../fetch-manifest.js";
import type { AICPermissionsManifest } from "@aicorg/spec";

export const permissionsToolName = "get_aic_permissions";

export const permissionsToolDescription =
  "Get the permissions and policy rules for an AIC-instrumented web app. " +
  "Returns risk band policies (which risk levels require confirmation or audit), " +
  "forbidden actions, action-specific policies with role requirements, " +
  "and mutation rules. Use this to understand what the agent is allowed " +
  "to do and what requires human confirmation before execution.";

export const permissionsToolSchema = {
  base_url: z
    .string()
    .describe("Base URL of the AIC-instrumented web app (e.g. http://localhost:3000)")
};

export async function handlePermissions(args: { base_url: string }): Promise<string> {
  const discovery = await fetchDiscovery(args.base_url);

  const permissionsUrl = discovery.ok
    ? resolveEndpointUrl(
        args.base_url,
        discovery.data.endpoints?.permissions,
        "/agent-permissions.json"
      )
    : resolveEndpointUrl(args.base_url, undefined, "/agent-permissions.json");

  const result = await fetchManifest<AICPermissionsManifest>(permissionsUrl);

  if (!result.ok) {
    return JSON.stringify({
      success: false,
      error: result.error,
      hint: "Permissions manifest may not be configured. The app may still be operable with default risk policies."
    });
  }

  const validation = validatePermissionsManifest(result.data);

  return JSON.stringify({
    success: true,
    risk_bands: result.data.riskBands,
    forbidden_actions: result.data.forbiddenActions ?? [],
    action_policies: result.data.actionPolicies ?? {},
    mutation_policy: result.data.mutationPolicy ?? null,
    reauth_required_for: result.data.reauthRequiredFor ?? [],
    validation: {
      valid: validation.ok,
      issues: validation.issues.length > 0 ? validation.issues : undefined
    }
  });
}
