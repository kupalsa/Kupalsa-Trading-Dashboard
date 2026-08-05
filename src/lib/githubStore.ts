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
    throw new GithubApiError(
      `GitHub write failed (${res.status}) for ${path}: ${await res.text()}`,
      res.status,
    );
  }
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

export function screenshotUrl(s: AppSettings, path: string): string {
  return `https://raw.githubusercontent.com/${s.githubOwner}/${s.githubRepo}/main/${path}`;
}
