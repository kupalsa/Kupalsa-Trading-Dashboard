import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadSettings, saveSettings, isGithubConfigured, type AppSettings } from "./settings";
import { readJSON, writeBinary, writeJSON } from "./githubStore";
import {
  normalizeDailyReview,
  normalizeTrade,
  type DailyReview,
  type RulesDoc,
  type Trade,
} from "./types";
import { normalizeOpportunity, type Opportunity } from "./backtest";
import {
  normalizeStrategies,
  resolveSelection,
  type Strategy,
} from "./strategy";
import {
  emptyTrash,
  normalizeTrash,
  purgeExpiredTrash,
  type TrashDoc,
} from "./trash";

interface DataContextValue {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  githubReady: boolean;

  trades: Trade[];
  dailyReviews: DailyReview[];
  opportunities: Opportunity[];
  strategies: Strategy[];
  trash: TrashDoc;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  addTrade: (t: Trade) => Promise<void>;
  updateTrade: (t: Trade) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  restoreTrade: (id: string) => Promise<void>;
  purgeTrashedTrade: (id: string) => Promise<void>;
  saveScreenshot: (path: string, base64: string) => Promise<void>;
  saveDailyReview: (r: DailyReview) => Promise<void>;

  saveStrategy: (s: Strategy) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  savePlaybookImage: (path: string, base64: string) => Promise<void>;

  saveOpportunity: (o: Opportunity) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;
  restoreOpportunity: (id: string) => Promise<void>;
  purgeTrashedOpportunity: (id: string) => Promise<void>;
  saveBacktestScreenshot: (path: string, base64: string) => Promise<void>;

  emptyTrashNow: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const TRADES_PATH = "data/trades.json";
const REVIEWS_PATH = "data/daily-reviews.json";
const RULES_PATH = "data/rules.json"; // legacy; seeds the first strategy
const OPPORTUNITIES_PATH = "data/opportunities.json";
const STRATEGIES_PATH = "data/strategies.json";
const TRASH_PATH = "data/trash.json";
const SELECTION_KEY = "trading-dashboard-selected-strategies";

function loadSelection(): string[] {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyReviews, setDailyReviews] = useState<DailyReview[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [trash, setTrash] = useState<TrashDoc>(emptyTrash);
  const [selectedRaw, setSelectedRaw] = useState<string[]>(() => loadSelection());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const githubReady = isGithubConfigured(settings);

  const updateSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const refresh = useCallback(async () => {
    if (!isGithubConfigured(settings)) return;
    setLoading(true);
    setError(null);
    try {
      const [t, r, legacyRules, ops, strats, trashRaw] = await Promise.all([
        readJSON<Partial<Trade>[]>(settings, TRADES_PATH, []),
        readJSON<Partial<DailyReview>[]>(settings, REVIEWS_PATH, []),
        readJSON<Partial<RulesDoc> | null>(settings, RULES_PATH, null),
        readJSON<Partial<Opportunity>[]>(settings, OPPORTUNITIES_PATH, []),
        readJSON<Partial<Strategy>[] | null>(settings, STRATEGIES_PATH, null),
        readJSON<Partial<TrashDoc> | null>(settings, TRASH_PATH, null),
      ]);
      setTrades(t.map(normalizeTrade));
      setDailyReviews(r.map(normalizeDailyReview));
      setOpportunities(ops.map(normalizeOpportunity));
      setStrategies(normalizeStrategies(strats, legacyRules ?? undefined));

      const loadedTrash = normalizeTrash(trashRaw);
      const purged = purgeExpiredTrash(loadedTrash);
      setTrash(purged);
      if (purged !== loadedTrash) {
        await writeJSON(settings, TRASH_PATH, purged, "Purge expired trash");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.githubOwner, settings.githubRepo, settings.githubToken]);

  const selectedIds = useMemo(
    () => resolveSelection(strategies, selectedRaw),
    [strategies, selectedRaw],
  );

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedRaw(ids);
    localStorage.setItem(SELECTION_KEY, JSON.stringify(ids));
  }, []);

  const persistTrades = useCallback(
    async (next: Trade[]) => {
      setTrades(next);
      await writeJSON(settings, TRADES_PATH, next, "Update trades.json");
    },
    [settings],
  );

  const persistTrash = useCallback(
    async (next: TrashDoc, message: string) => {
      setTrash(next);
      await writeJSON(settings, TRASH_PATH, next, message);
    },
    [settings],
  );

  const addTrade = useCallback(
    async (t: Trade) => persistTrades([...trades, t]),
    [trades, persistTrades],
  );

  const updateTrade = useCallback(
    async (t: Trade) => persistTrades(trades.map((x) => (x.id === t.id ? t : x))),
    [trades, persistTrades],
  );

  /** Deletes move a trade to the trash rather than destroying it outright. */
  const deleteTrade = useCallback(
    async (id: string) => {
      const target = trades.find((x) => x.id === id);
      if (!target) return;
      await persistTrades(trades.filter((x) => x.id !== id));
      await persistTrash(
        { ...trash, trades: [{ ...target, deletedAt: new Date().toISOString() }, ...trash.trades] },
        `Trash trade ${target.date}`,
      );
    },
    [trades, persistTrades, trash, persistTrash],
  );

  const restoreTrade = useCallback(
    async (id: string) => {
      const item = trash.trades.find((x) => x.id === id);
      if (!item) return;
      const { deletedAt: _deletedAt, ...trade } = item;
      await persistTrades([...trades, trade]);
      await persistTrash(
        { ...trash, trades: trash.trades.filter((x) => x.id !== id) },
        `Restore trade ${trade.date}`,
      );
    },
    [trash, trades, persistTrades, persistTrash],
  );

  const purgeTrashedTrade = useCallback(
    async (id: string) => {
      await persistTrash(
        { ...trash, trades: trash.trades.filter((x) => x.id !== id) },
        "Permanently delete trade",
      );
    },
    [trash, persistTrash],
  );

  const saveScreenshot = useCallback(
    async (path: string, base64: string) => {
      await writeBinary(settings, path, base64, "Add trade screenshot");
    },
    [settings],
  );

  /** Reviews are keyed by strategy AND date. */
  const saveDailyReview = useCallback(
    async (r: DailyReview) => {
      const next = [
        ...dailyReviews.filter((x) => !(x.date === r.date && x.strategyId === r.strategyId)),
        r,
      ].sort((a, b) => a.date.localeCompare(b.date));
      setDailyReviews(next);
      await writeJSON(settings, REVIEWS_PATH, next, `Update daily review ${r.date}`);
    },
    [dailyReviews, settings],
  );

  const persistStrategies = useCallback(
    async (next: Strategy[], message: string) => {
      setStrategies(next);
      await writeJSON(settings, STRATEGIES_PATH, next, message);
    },
    [settings],
  );

  const saveStrategy = useCallback(
    async (s: Strategy) => {
      const exists = strategies.some((x) => x.id === s.id);
      const next = exists
        ? strategies.map((x) => (x.id === s.id ? s : x))
        : [...strategies, s];
      await persistStrategies(next, `${exists ? "Update" : "Add"} strategy ${s.name}`);
    },
    [strategies, persistStrategies],
  );

  /** Deleting a strategy leaves its records in place rather than destroying them. */
  const deleteStrategy = useCallback(
    async (id: string) => {
      if (strategies.length <= 1) throw new Error("At least one strategy must exist.");
      const target = strategies.find((x) => x.id === id);
      await persistStrategies(
        strategies.filter((x) => x.id !== id),
        `Delete strategy ${target?.name ?? id}`,
      );
      setSelectedIds(selectedIds.filter((x) => x !== id));
    },
    [strategies, persistStrategies, selectedIds, setSelectedIds],
  );

  const savePlaybookImage = useCallback(
    async (path: string, base64: string) => {
      await writeBinary(settings, path, base64, "Add playbook image");
    },
    [settings],
  );

  const persistOpportunities = useCallback(
    async (next: Opportunity[], message: string) => {
      setOpportunities(next);
      await writeJSON(settings, OPPORTUNITIES_PATH, next, message);
    },
    [settings],
  );

  const saveOpportunity = useCallback(
    async (o: Opportunity) => {
      const exists = opportunities.some((x) => x.id === o.id);
      const next = (exists
        ? opportunities.map((x) => (x.id === o.id ? o : x))
        : [...opportunities, o]
      ).sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
      await persistOpportunities(
        next,
        `${exists ? "Update" : "Add"} opportunity #${o.seq}${o.date ? ` (${o.date})` : ""}`,
      );
    },
    [opportunities, persistOpportunities],
  );

  /** Deletes move an opportunity to the trash rather than destroying it outright. */
  const deleteOpportunity = useCallback(
    async (id: string) => {
      const target = opportunities.find((x) => x.id === id);
      if (!target) return;
      await persistOpportunities(
        opportunities.filter((x) => x.id !== id),
        `Delete opportunity #${target.seq}`,
      );
      await persistTrash(
        {
          ...trash,
          opportunities: [{ ...target, deletedAt: new Date().toISOString() }, ...trash.opportunities],
        },
        `Trash opportunity #${target.seq}`,
      );
    },
    [opportunities, persistOpportunities, trash, persistTrash],
  );

  const restoreOpportunity = useCallback(
    async (id: string) => {
      const item = trash.opportunities.find((x) => x.id === id);
      if (!item) return;
      const { deletedAt: _deletedAt, ...opportunity } = item;
      await persistOpportunities(
        [...opportunities, opportunity].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq),
        `Restore opportunity #${opportunity.seq}`,
      );
      await persistTrash(
        { ...trash, opportunities: trash.opportunities.filter((x) => x.id !== id) },
        `Restore opportunity #${opportunity.seq}`,
      );
    },
    [trash, opportunities, persistOpportunities, persistTrash],
  );

  const purgeTrashedOpportunity = useCallback(
    async (id: string) => {
      await persistTrash(
        { ...trash, opportunities: trash.opportunities.filter((x) => x.id !== id) },
        "Permanently delete opportunity",
      );
    },
    [trash, persistTrash],
  );

  const emptyTrashNow = useCallback(
    async () => persistTrash(emptyTrash, "Empty trash"),
    [persistTrash],
  );

  const saveBacktestScreenshot = useCallback(
    async (path: string, base64: string) => {
      await writeBinary(settings, path, base64, "Add backtest screenshot");
    },
    [settings],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      settings,
      updateSettings,
      githubReady,
      trades,
      dailyReviews,
      opportunities,
      strategies,
      trash,
      selectedIds,
      setSelectedIds,
      loading,
      error,
      refresh,
      addTrade,
      updateTrade,
      deleteTrade,
      restoreTrade,
      purgeTrashedTrade,
      saveScreenshot,
      saveDailyReview,
      saveStrategy,
      deleteStrategy,
      savePlaybookImage,
      saveOpportunity,
      deleteOpportunity,
      restoreOpportunity,
      purgeTrashedOpportunity,
      saveBacktestScreenshot,
      emptyTrashNow,
    }),
    [
      settings,
      updateSettings,
      githubReady,
      trades,
      dailyReviews,
      opportunities,
      strategies,
      trash,
      selectedIds,
      setSelectedIds,
      loading,
      error,
      refresh,
      addTrade,
      updateTrade,
      deleteTrade,
      restoreTrade,
      purgeTrashedTrade,
      saveScreenshot,
      saveDailyReview,
      saveStrategy,
      deleteStrategy,
      savePlaybookImage,
      saveOpportunity,
      deleteOpportunity,
      restoreOpportunity,
      purgeTrashedOpportunity,
      saveBacktestScreenshot,
      emptyTrashNow,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
