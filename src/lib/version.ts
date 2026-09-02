/** The build this running app came from. */
export const RUNNING_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/**
 * Records which version we already reloaded for. If a reload doesn't actually
 * pick up the new build — a cache that won't revalidate — retrying forever
 * would trap the app in a reload loop, so a version is only auto-reloaded for
 * once per tab.
 */
const ATTEMPT_KEY = "trading-dashboard-update-reload";

export function reloadAlreadyTried(version: string): boolean {
  try {
    return sessionStorage.getItem(ATTEMPT_KEY) === version;
  } catch {
    return false;
  }
}

export function markReloadTried(version: string): void {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, version);
  } catch {
    // Private mode with storage disabled: worst case we show the banner.
  }
}

/**
 * The version currently deployed, or null if it can't be determined (offline,
 * or a build predating version.json). Cache is bypassed deliberately — the
 * whole point is to see past a stale cache.
 */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const url = new URL("version.json", document.baseURI);
    url.searchParams.set("t", String(Date.now()));
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const version = (data as { version?: unknown })?.version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/** Reload from the network rather than the back/forward cache. */
export function hardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}
