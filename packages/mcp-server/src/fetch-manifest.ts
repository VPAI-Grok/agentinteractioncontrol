import type {
  AICDiscoveryManifest,
  AICDiscoveryEndpoints
} from "@aicorg/spec";

export interface FetchManifestSuccess<T> {
  ok: true;
  data: T;
}

export interface FetchManifestError {
  ok: false;
  error: string;
}

export type FetchManifestResult<T> = FetchManifestSuccess<T> | FetchManifestError;

export async function fetchManifest<T>(url: string): Promise<FetchManifestResult<T>> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status} ${response.statusText} from ${url}`
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Unknown fetch error";
    return { ok: false, error: `Failed to fetch ${url}: ${message}` };
  }
}

export function resolveEndpointUrl(
  baseUrl: string,
  path: string | undefined,
  fallback: string
): string {
  const resolved = path ?? fallback;
  const base = baseUrl.replace(/\/+$/, "");

  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }

  return `${base}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}

export interface ResolvedEndpoints {
  actions: string;
  permissions: string;
  ui: string;
  workflows: string;
}

export function resolveAllEndpoints(
  baseUrl: string,
  endpoints: AICDiscoveryEndpoints
): ResolvedEndpoints {
  return {
    actions: resolveEndpointUrl(baseUrl, endpoints.actions, "/.well-known/agent/actions"),
    permissions: resolveEndpointUrl(baseUrl, endpoints.permissions, "/agent-permissions.json"),
    ui: resolveEndpointUrl(baseUrl, endpoints.ui, "/.well-known/agent/ui"),
    workflows: resolveEndpointUrl(baseUrl, endpoints.workflows, "/agent-workflows.json")
  };
}

export async function fetchDiscovery(
  baseUrl: string
): Promise<FetchManifestResult<AICDiscoveryManifest>> {
  const url = resolveEndpointUrl(baseUrl, undefined, "/.well-known/agent.json");
  return fetchManifest<AICDiscoveryManifest>(url);
}
