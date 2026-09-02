import { useCallback, useEffect, useState } from "react";
import {
  fetchDeployedVersion,
  hardReload,
  markReloadTried,
  reloadAlreadyTried,
  RUNNING_VERSION,
} from "../lib/version";
import { useUnsavedChanges } from "../lib/unsavedChanges";

const POLL_MS = 5 * 60 * 1000;

/**
 * Notices when a newer build has been deployed and gets onto it.
 *
 * Checks on mount, whenever the window regains focus — the moment that matters
 * for an app launched from the Dock — and periodically while it sits open.
 * Reloads by itself when nothing would be lost; when there are unsaved edits,
 * or when a reload has already failed to take, it asks instead.
 */
export default function UpdateNotice() {
  const { dirty } = useUnsavedChanges();
  const [stale, setStale] = useState<string | null>(null);

  const check = useCallback(async () => {
    const deployed = await fetchDeployedVersion();
    if (!deployed || deployed === RUNNING_VERSION) return;
    setStale(deployed);

    // Reloading mid-edit would throw the edits away, which is worse than
    // running a version behind for another minute.
    if (!dirty && !reloadAlreadyTried(deployed)) {
      markReloadTried(deployed);
      hardReload();
    }
  }, [dirty]);

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const id = setInterval(check, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(id);
    };
  }, [check]);

  if (!stale) return null;

  return (
    <div className="update-notice">
      <span>
        A newer version is available.
        {dirty && " Save your changes first — reloading now would lose them."}
      </span>
      <button className="primary" onClick={hardReload}>
        Reload
      </button>
    </div>
  );
}
