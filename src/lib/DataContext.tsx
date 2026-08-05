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
import { emptyRulesDoc, type DailyReview, type RulesDoc, type Trade } from "./types";

interface DataContextValue {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  githubReady: boolean;

  trades: Trade[];
  dailyReviews: DailyReview[];
  rules: RulesDoc;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  addTrade: (t: Trade) => Promise<void>;
  updateTrade: (t: Trade) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  saveScreenshot: (path: string, base64: string) => Promise<void>;
  saveDailyReview: (r: DailyReview) => Promise<void>;
  saveRules: (r: RulesDoc) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const TRADES_PATH = "data/trades.json";
const REVIEWS_PATH = "data/daily-reviews.json";
const RULES_PATH = "data/rules.json";

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyReviews, setDailyReviews] = useState<DailyReview[]>([]);
  const [rules, setRules] = useState<RulesDoc>(emptyRulesDoc);
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
      const [t, r, rl] = await Promise.all([
        readJSON<Trade[]>(settings, TRADES_PATH, []),
        readJSON<DailyReview[]>(settings, REVIEWS_PATH, []),
        readJSON<RulesDoc>(settings, RULES_PATH, emptyRulesDoc),
      ]);
      setTrades(t);
      setDailyReviews(r);
      setRules(rl);
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

  const value = useMemo<DataContextValue>(
    () => ({
      settings,
      updateSettings,
      githubReady,
      trades,
      dailyReviews,
      rules,
      loading,
      error,
      refresh,
      addTrade,
      updateTrade,
      deleteTrade,
      saveScreenshot,
      saveDailyReview,
      saveRules,
    }),
    [
      settings,
      updateSettings,
      githubReady,
      trades,
      dailyReviews,
      rules,
      loading,
      error,
      refresh,
      addTrade,
      updateTrade,
      deleteTrade,
      saveScreenshot,
      saveDailyReview,
      saveRules,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
