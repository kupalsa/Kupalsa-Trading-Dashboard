export interface AppSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  anthropicKey: string;
}

const STORAGE_KEY = "trading-dashboard-settings";

export const emptySettings: AppSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  anthropicKey: "",
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

export function isAnthropicConfigured(s: AppSettings): boolean {
  return Boolean(s.anthropicKey);
}
