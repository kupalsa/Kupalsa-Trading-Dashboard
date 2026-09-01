import type { AppSettings } from "./settings";

export class GithubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GithubApiError";
  }
}

interface ContentsResponse {
  content: string;
  sha: string;
}

function apiBase(s: AppSettings): string {
  return `https://api.github.com/repos/${s.githubOwner}/${s.githubRepo}/contents`;
}

function headers(s: AppSettings): HeadersInit {
  return {
    Authorization: `Bearer ${s.githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// UTF-8 safe base64 encode/decode
function b64EncodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function b64DecodeUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function getFile(
  s: AppSettings,
  path: string,
): Promise<ContentsResponse | null> {
  const res = await fetch(`${apiBase(s)}/${path}`, { headers: headers(s) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new GithubApiError(
      `GitHub read failed (${res.status}) for ${path}: ${await res.text()}`,
      res.status,
    );
  }
  const data = await res.json();
  return { content: data.content as string, sha: data.sha as string };
}

async function putFile(
  s: AppSettings,
  path: string,
  base64Content: string,
  message: string,
  sha?: string,
): Promise<void> {
  const res = await fetch(`${apiBase(s)}/${path}`, {
    method: "PUT",
    headers: { ...headers(s), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: base64Content,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new GithubApiError(writeErrorMessage(res.status, path, await res.text()), res.status);
  }
}

/**
 * GitHub answers a write the token isn't allowed to make with 404 rather than
 * 403 — it won't confirm the repo exists to a caller who can't write to it. So
 * a 404 here almost always means the token's permissions, not a missing file:
 * reading works while writing doesn't.
 */
function writeErrorMessage(status: number, path: string, body: string): string {
  if (status === 404) {
    return (
      `Could not save ${path} — GitHub refused the write (404). ` +
      `This usually means the Personal Access Token is missing "Contents: Read and write" ` +
      `for this repository (read-only tokens can load your data but not save it). ` +
      `Check the token at github.com/settings/tokens, then re-enter it in Settings. ` +
      `Also confirm the owner and repository names are right.`
    );
  }
  if (status === 401) {
    return `Could not save ${path} — the token was rejected (401). It has probably expired; create a new one and re-enter it in Settings.`;
  }
  if (status === 409) {
    return `Could not save ${path} — it changed in GitHub since this page loaded (409). Reload to pick up the newer version, then redo this change.`;
  }
  if (status === 403) {
    return `Could not save ${path} — forbidden (403). If you have been saving rapidly this may be a rate limit; wait a minute and retry. Otherwise check the token's permissions.`;
  }
  return `GitHub write failed (${status}) for ${path}: ${body}`;
}

export async function readJSON<T>(
  s: AppSettings,
  path: string,
  fallback: T,
): Promise<T> {
  const file = await getFile(s, path);
  if (!file) return fallback;
  const text = b64DecodeUtf8(file.content);
  return JSON.parse(text) as T;
}

export async function writeJSON<T>(
  s: AppSettings,
  path: string,
  data: T,
  message: string,
): Promise<void> {
  const existing = await getFile(s, path);
  const content = b64EncodeUtf8(JSON.stringify(data, null, 2));
  await putFile(s, path, content, message, existing?.sha);
}

/** Upload a binary (e.g. image) file given raw base64 content (no data: prefix). */
export async function writeBinary(
  s: AppSettings,
  path: string,
  base64Content: string,
  message: string,
): Promise<void> {
  const existing = await getFile(s, path);
  await putFile(s, path, base64Content, message, existing?.sha);
}

export async function testConnection(s: AppSettings): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${s.githubOwner}/${s.githubRepo}`,
    { headers: headers(s) },
  );
  if (!res.ok) {
    throw new GithubApiError(
      `Could not reach repo (${res.status}): ${await res.text()}`,
      res.status,
    );
  }
  const data = await res.json();
  return data.full_name as string;
}

/**
 * Repo files live in a private repo, so raw.githubusercontent.com URLs 404 —
 * the browser can't attach the token to a plain <img src> or <iframe src>.
 * Fetch the bytes through the API instead and hand back an object URL. Works
 * for any file type (images, the uploaded backtest-helper HTML, etc.).
 *
 * Results are cached per path: the same file is often rendered in a list and
 * then again in an editor, and blobs are cheap to keep but wasteful to refetch.
 */
const fileCache = new Map<string, Promise<string>>();

export function fetchRepoFile(s: AppSettings, path: string): Promise<string> {
  const key = `${s.githubOwner}/${s.githubRepo}/${path}`;
  const hit = fileCache.get(key);
  if (hit) return hit;

  const load = (async () => {
    const res = await fetch(`${apiBase(s)}/${path}`, {
      headers: { ...headers(s), Accept: "application/vnd.github.raw" },
    });
    if (!res.ok) {
      throw new GithubApiError(
        `Could not load ${path} (${res.status})`,
        res.status,
      );
    }
    return URL.createObjectURL(await res.blob());
  })();

  // A failed load shouldn't be cached forever — let the next render retry.
  load.catch(() => fileCache.delete(key));
  fileCache.set(key, load);
  return load;
}

export function forgetRepoFile(s: AppSettings, path: string): void {
  fileCache.delete(`${s.githubOwner}/${s.githubRepo}/${path}`);
}

/**
 * Fetch a repo file as text rather than a blob URL. Needed for HTML rendered
 * via <iframe srcDoc> — a sandboxed iframe without `allow-same-origin` can't
 * resolve a blob: URL (it fails to load, silently, with no console error),
 * and granting allow-same-origin to load one would give the iframe's script
 * the app's own origin, defeating the sandbox entirely. srcDoc sidesteps the
 * problem: no URL to resolve, so the sandbox stays intact.
 */
export async function fetchRepoText(s: AppSettings, path: string): Promise<string> {
  const res = await fetch(`${apiBase(s)}/${path}`, {
    headers: { ...headers(s), Accept: "application/vnd.github.raw" },
  });
  if (!res.ok) {
    throw new GithubApiError(`Could not load ${path} (${res.status})`, res.status);
  }
  return res.text();
}
