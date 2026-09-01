export type Theme = "light" | "dark";

/**
 * Versioned key. The previous theme wrote "light" to storage on every mount,
 * not just when it was chosen, so every existing browser holds a "light" that
 * was never actually a preference. Reading a fresh key lets the new dark
 * default apply once; anything chosen from here on persists normally.
 */
const KEY = "trading-dashboard-theme-v2";

/** Dark is the design's native state; light is the opt-in. */
export function loadTheme(): Theme {
  return localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY, theme);
}
