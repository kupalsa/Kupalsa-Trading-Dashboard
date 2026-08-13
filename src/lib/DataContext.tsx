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
  emptyRulesDoc,
  normalizeDailyReview,
  normalizeRules,
  type DailyReview,
  type RulesDoc,
  type Trade,
} from "./types";
import type { Opportunity } from "./backtest";

interface DataContextValue {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  githubReady: boolean;

  trades: Trade[];
  dailyReviews: DailyReview[];
  rules: RulesDoc;
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  addTrade: (t: Trade) => Promise<void>;
  updateTrade: (t: Trade) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  saveScreenshot: (path: string, base64: string) => Promise<void>;
  saveDailyReview: (r: DailyReview) => Promise<void>;
  saveRules: (r: RulesDoc) => Promise<void>;

  saveOpportunity: (o: Opportunity) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;
  saveBacktestScreenshot: (path: string, base64: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const TRADES_PATH = "data/trades.json";
const REVIEWS_PATH = "data/daily-reviews.json";
const RULES_PATH = "data/rules.json";
const OPPORTUNITIES_PATH = "data/opportunities.json";

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyReviews, setDailyReviews] = useState<DailyReview[]>([]);
  const [rules, setRules] = useState<RulesDoc>(emptyRulesDoc);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
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
      const [t, r, rl, ops] = await Promise.all([
        readJSON<Trade[]>(settings, TRADES_PATH, []),
        readJSON<DailyReview[]>(settings, REVIEWS_PATH, []),
        readJSON<Partial<RulesDoc>>(settings, RULES_PATH, emptyRulesDoc),
        readJSON<Opportunity[]>(settings, OPPORTUNITIES_PATH, []),
      ]);
      setTrades(t);
      setDailyReviews(r.map(normalizeDailyReview));
      setRules(normalizeRules(rl));
      setOpportunities(ops);
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

  const persistTrades = useCallback(
    async (next: Trade[]) => {
      setTrades(next);
      await writeJSON(settings, TRADES_PATH, next, "Update trades.json");
    },
    [settings],
  );

  const addTrade = useCallback(
    async (t: Trade) => {
      await persistTrades([...trades, t]);
    },
    [trades, persistTrades],
  );

  const updateTrade = useCallback(
    async (t: Trade) => {
      await persistTrades(trades.map((x) => (x.id === t.id ? t : x)));
    },
    [trades, persistTrades],
  );

  const deleteTrade = useCallback(
    async (id: string) => {
      await persistTrades(trades.filter((x) => x.id !== id));
    },
    [trades, persistTrades],
  );

  const saveScreenshot = useCallback(
    async (path: string, base64: string) => {
      await writeBinary(settings, path, base64, "Add trade screenshot");
    },
    [settings],
  );

  const saveDailyReview = useCallback(
    async (r: DailyReview) => {
      const next = [
        ...dailyReviews.filter((x) => x.date !== r.date),
        r,
      ].sort((a, b) => a.date.localeCompare(b.date));
      setDailyReviews(next);
      await writeJSON(settings, REVIEWS_PATH, next, `Update daily review ${r.date}`);
    },
    [dailyReviews, settings],
  );

  const saveRules = useCallback(
    async (r: RulesDoc) => {
      setRules(r);
      await writeJSON(settings, RULES_PATH, r, "Update strategy rules/notes");
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

  /** Upsert by id, keeping the log ordered by date then sequence. */
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

  const deleteOpportunity = useCallback(
    async (id: string) => {
      const target = opportunities.find((x) => x.id === id);
      await persistOpportunities(
        opportunities.filter((x) => x.id !== id),
        `Delete opportunity #${target?.seq ?? ""}`,
      );
    },
    [opportunities, persistOpportunities],
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
      rules,
      opportunities,
      loading,
      error,
      refresh,
      addTrade,
      updateTrade,
      deleteTrade,
      saveScreenshot,
      saveDailyReview,
      saveRules,
      saveOpportunity,
      deleteOpportunity,
      saveBacktestScreenshot,
    }),
    [
      settings,
      updateSettings,
      githubReady,
      trades,
      dailyReviews,
      rules,
      opportunities,
      loading,
      error,
      refresh,
      addTrade,
      updateTrade,
      deleteTrade,
      saveScreenshot,
      saveDailyReview,
      saveRules,
      saveOpportunity,
      deleteOpportunity,
      saveBacktestScreenshot,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
