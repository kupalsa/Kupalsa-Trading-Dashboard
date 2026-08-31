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

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...emptySettings };
  try {
    return { ...emptySettings, ...JSON.parse(raw) };
  } catch {
    return { ...emptySettings };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isGithubConfigured(s: AppSettings): boolean {
  return Boolean(s.githubToken && s.githubOwner && s.githubRepo);
}
