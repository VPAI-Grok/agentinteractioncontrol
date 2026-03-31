import { z } from "zod";
import { validateDiscoveryManifest } from "@aicorg/spec";
import { fetchDiscovery, resolveAllEndpoints } from "../fetch-manifest.js";

export const discoverToolName = "discover_aic_app";

export const discoverToolDescription =
  "Discover whether a web app supports AIC (Agent Interaction Contract). " +
  "Fetches and validates the discovery manifest at /.well-known/agent.json. " +
  "Returns the app name, version, supported capabilities, and resolved endpoint URLs " +
  "for UI state, permissions, workflows, and semantic actions.";

export const discoverToolSchema = {
  base_url: z
    .string()
    .describe("Base URL of the AIC-instrumented web app (e.g. http://localhost:3000)")
};

export async function handleDiscover(args: { base_url: string }): Promise<string> {
  const result = await fetchDiscovery(args.base_url);

  if (!result.ok) {
    return JSON.stringify({
      success: false,
      error: result.error,
      hint: "The app may not support AIC. Check that /.well-known/agent.json is served."
    });
  }

  const validation = validateDiscoveryManifest(result.data);
  const endpoints = resolveAllEndpoints(
    args.base_url,
    result.data.endpoints ?? {}
  );

  return JSON.stringify({
    success: true,
    app: result.data.app,
    spec: result.data.spec,
    capabilities: result.data.capabilities,
    endpoints,
    framework: result.data.framework ?? null,
    notes: result.data.notes ?? [],
    validation: {
      valid: validation.ok,
      issues: validation.issues
    }
  });
}
