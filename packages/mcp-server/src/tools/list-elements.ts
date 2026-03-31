import { z } from "zod";
import {
  fetchDiscovery,
  fetchManifest,
  resolveEndpointUrl
} from "../fetch-manifest.js";
import type { AICRuntimeUiManifest, AICElementManifest } from "@aicorg/spec";

export const listElementsToolName = "list_aic_elements";

export const listElementsToolDescription =
  "Search and filter interactive elements from an AIC-instrumented web app. " +
  "Use this to find specific controls by role (button, input, form, etc.), " +
  "risk level (low, medium, high, critical), entity type (invoice, order, etc.), " +
  "or free-text query matching labels and descriptions. " +
  "By default only shows actionable (enabled + visible) elements. " +
  "Returns a focused subset instead of the full UI manifest.";

export const listElementsToolSchema = {
  base_url: z
    .string()
    .describe("Base URL of the AIC-instrumented web app (e.g. http://localhost:3000)"),
  role: z
    .string()
    .optional()
    .describe("Filter by element role (e.g. button, input, form, select, checkbox, dialog)"),
  risk: z
    .string()
    .optional()
    .describe("Filter by risk level (low, medium, high, critical)"),
  entity_type: z
    .string()
    .optional()
    .describe("Filter by entity type (e.g. invoice, order, customer)"),
  query: z
    .string()
    .optional()
    .describe("Free-text search across element labels and descriptions"),
  actionable_only: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true (default), hide disabled and hidden elements"),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe("Maximum number of elements to return (default 50)")
};

function matchesQuery(element: AICElementManifest, query: string): boolean {
  const lower = query.toLowerCase();
  const label = (element.label ?? "").toLowerCase();
  const description = (element.description ?? "").toLowerCase();
  const id = element.id.toLowerCase();
  const aliases = (element.aliases ?? []).map((a) => a.toLowerCase());

  return (
    label.includes(lower) ||
    description.includes(lower) ||
    id.includes(lower) ||
    aliases.some((a) => a.includes(lower))
  );
}

function isActionable(element: AICElementManifest): boolean {
  const state = element.state ?? {};
  if (state.hidden === true) return false;
  if (state.visible === false) return false;
  if (state.enabled === false) return false;
  return true;
}

export async function handleListElements(args: {
  base_url: string;
  role?: string;
  risk?: string;
  entity_type?: string;
  query?: string;
  actionable_only?: boolean;
  limit?: number;
}): Promise<string> {
  const discovery = await fetchDiscovery(args.base_url);

  const uiUrl = discovery.ok
    ? resolveEndpointUrl(args.base_url, discovery.data.endpoints?.ui, "/.well-known/agent/ui")
    : resolveEndpointUrl(args.base_url, undefined, "/.well-known/agent/ui");

  const result = await fetchManifest<AICRuntimeUiManifest>(uiUrl);

  if (!result.ok) {
    return JSON.stringify({
      success: false,
      error: result.error
    });
  }

  let elements = result.data.elements ?? [];

  const actionableOnly = args.actionable_only !== false;
  if (actionableOnly) {
    elements = elements.filter(isActionable);
  }

  if (args.role) {
    const role = args.role.toLowerCase();
    elements = elements.filter((e) => e.role === role);
  }

  if (args.risk) {
    const risk = args.risk.toLowerCase();
    elements = elements.filter((e) => e.risk === risk);
  }

  if (args.entity_type) {
    const entityType = args.entity_type.toLowerCase();
    elements = elements.filter(
      (e) => e.entity_ref?.entity_type?.toLowerCase() === entityType
    );
  }

  if (args.query) {
    elements = elements.filter((e) => matchesQuery(e, args.query!));
  }

  const limit = args.limit ?? 50;
  const total = elements.length;
  const truncated = elements.length > limit;
  elements = elements.slice(0, limit);

  return JSON.stringify({
    success: true,
    total_matches: total,
    returned: elements.length,
    truncated,
    filters_applied: {
      role: args.role ?? null,
      risk: args.risk ?? null,
      entity_type: args.entity_type ?? null,
      query: args.query ?? null,
      actionable_only: actionableOnly
    },
    elements
  });
}
