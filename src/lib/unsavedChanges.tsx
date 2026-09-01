import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Tracks whether an editor has unsaved edits, so navigating away can ask
 * first. The app uses a plain <Routes> tree rather than a data router, so
 * React Router's useBlocker isn't available — instead the sidebar asks this
 * before following a link, and beforeunload covers closing or reloading.
 */
interface UnsavedChangesValue {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** Runs `go` immediately when clean, otherwise after the user confirms. */
  confirmLeave: (go: () => void) => void;
  pending: boolean;
  resolvePending: (proceed: boolean) => void;
}

const Ctx = createContext<UnsavedChangesValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirtyState] = useState(false);
  const [pendingGo, setPendingGo] = useState<{ run: () => void } | null>(null);
  const dirtyRef = useRef(false);

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirtyState(next);
  }, []);

  // Closing or reloading the tab is outside the router's reach.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const confirmLeave = useCallback((go: () => void) => {
    if (!dirtyRef.current) {
      go();
      return;
    }
    setPendingGo({ run: go });
  }, []);

  const resolvePending = useCallback(
    (proceed: boolean) => {
      const go = pendingGo?.run;
      setPendingGo(null);
      if (proceed && go) {
        setDirty(false);
        go();
      }
    },
    [pendingGo, setDirty],
  );

  return (
    <Ctx.Provider
      value={{ dirty, setDirty, confirmLeave, pending: pendingGo !== null, resolvePending }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUnsavedChanges(): UnsavedChangesValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  return ctx;
}

/** Marks the current editor dirty, and clears the flag when it unmounts. */
export function useDirtyFlag(dirty: boolean): void {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);
}
