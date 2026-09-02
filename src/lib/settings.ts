export interface AppSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
}

const STORAGE_KEY = "trading-dashboard-settings";

export const emptySettings: AppSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
};

/**
 * Every field here ends up in a URL or an auth header, where a stray space is
 * both invisible in the input and fatal: an owner of "kupalsa " requests
 * /repos/kupalsa%20/… and 404s, and a token with a trailing newline from a
 * copy-paste fails auth. Trim on the way in and on the way out, so values
 * already stored with whitespace are repaired on load rather than needing the
 * user to spot a space they cannot see.
 */
export function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  return {
    githubToken: (raw.githubToken ?? "").trim(),
    githubOwner: (raw.githubOwner ?? "").trim(),
    githubRepo: (raw.githubRepo ?? "").trim(),
  };
}

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...emptySettings };
  try {
    return normalizeSettings({ ...emptySettings, ...JSON.parse(raw) });
  } catch {
    return { ...emptySettings };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function clearSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isGithubConfigured(s: AppSettings): boolean {
  return Boolean(s.githubToken && s.githubOwner && s.githubRepo);
}
