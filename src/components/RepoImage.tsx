import { useEffect, useState } from "react";
import { useData } from "../lib/DataContext";
import { fetchRepoFile } from "../lib/githubStore";

/** Resolves a repo-relative image path to a usable object URL. */
export function useRepoImage(path: string | null | undefined): {
  url: string | null;
  loading: boolean;
  error: string | null;
} {
  const { settings } = useData();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRepoFile(settings, path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings, path]);

  return { url, loading, error };
}

interface Props {
  path: string | null;
  alt: string;
  className?: string;
}

export default function RepoImage({ path, alt, className }: Props) {
  const { url, loading, error } = useRepoImage(path);

  if (loading) return <span className="small-note">Loading image…</span>;
  if (error) return <span className="error-text">{error}</span>;
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

/** Opens a repo image in a new tab, fetching it with auth first. */
export function RepoImageLink({ path, children }: { path: string; children: React.ReactNode }) {
  const { url, loading, error } = useRepoImage(path);
  if (loading) return <span className="small-note">…</span>;
  if (error || !url) return <span className="muted" title={error ?? ""}>unavailable</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
