import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { DataProvider, useData } from "./lib/DataContext";
import { applyTheme, loadTheme, type Theme } from "./lib/theme";
import { UnsavedChangesProvider, useUnsavedChanges } from "./lib/unsavedChanges";
import { ActiveTimerProvider, useActiveTimer } from "./lib/activeTimer";
import { formatDuration, isRunning, sessionMs } from "./lib/timeTracking";
import ConfirmDialog from "./components/ConfirmDialog";
import SessionReminder from "./components/SessionReminder";
import UpdateNotice from "./components/UpdateNotice";
import StrategyPicker from "./components/StrategyPicker";
import LogPage from "./pages/LogPage";
import StatsPage from "./pages/StatsPage";
import StrategyPage from "./pages/StrategyPage";
import BacktestPage from "./pages/BacktestPage";
import SettingsPage from "./pages/SettingsPage";
import TrashPage from "./pages/TrashPage";
import TimePage from "./pages/TimePage";

/** A nav link that asks before abandoning unsaved edits. */
function GuardedLink({
  to,
  end,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  className?: string | ((p: { isActive: boolean }) => string);
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { confirmLeave } = useUnsavedChanges();
  return (
    <NavLink
      to={to}
      end={end}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        confirmLeave(() => navigate(to));
      }}
    >
      {children}
    </NavLink>
  );
}

/** Visible on every page so a running timer can't be forgotten. */
function TimerBadge() {
  const { active, now } = useActiveTimer();
  if (!active) return null;
  const live = isRunning(active);
  return (
    <NavLink to="/time" className={live ? "timer-badge running" : "timer-badge"}>
      <span className="timer-dot" />
      {active.category} {formatDuration(sessionMs(active, now))}
      {!live && <span className="small-note"> paused</span>}
    </NavLink>
  );
}

function Sidebar() {
  const { githubReady, trash } = useData();
  const { active } = useActiveTimer();
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const trashCount = trash.trades.length + trash.opportunities.length;
  // Pulsing only while actually counting; a paused session shows a still dot,
  // so "open" and "running" don't look the same.
  const timerLive = active != null && isRunning(active);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <nav className="sidebar">
      <h1>Trading Journal</h1>
      <StrategyPicker />
      <GuardedLink to="/" end>
        Log
      </GuardedLink>
      <GuardedLink to="/stats">Stats</GuardedLink>
      <GuardedLink to="/strategy">Strategy</GuardedLink>
      <GuardedLink to="/backtest">Backtest</GuardedLink>
      <GuardedLink to="/time">
        Time
        {active && <span className={timerLive ? "nav-dot live" : "nav-dot"} />}
      </GuardedLink>
      <GuardedLink to="/settings">
        Settings {!githubReady && <span style={{ color: "var(--amber)" }}>●</span>}
      </GuardedLink>

      <div className="sidebar-footer">
        <TimerBadge />
        <GuardedLink
          to="/trash"
          className={({ isActive }) => `trash-link${isActive ? " active" : ""}`}
        >
          🗑 Recently deleted{trashCount > 0 && <span className="trash-count"> ({trashCount})</span>}
        </GuardedLink>
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "◗ Dark theme" : "◖ Light theme"}
        </button>
      </div>
    </nav>
  );
}

function LeaveGuard() {
  const { pending, resolvePending } = useUnsavedChanges();
  if (!pending) return null;
  return (
    <ConfirmDialog
      title="Discard unsaved changes?"
      message="This page has edits that haven't been saved. Leaving now loses them."
      confirmLabel="Discard and leave"
      cancelLabel="Stay"
      onConfirm={() => resolvePending(true)}
      onCancel={() => resolvePending(false)}
    />
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <Routes>
          <Route path="/" element={<LogPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/strategy" element={<StrategyPage />} />
          <Route path="/strategy/:id" element={<StrategyPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/time" element={<TimePage />} />
          <Route path="/trash" element={<TrashPage />} />
        </Routes>
      </div>
      <SessionReminder />
      <LeaveGuard />
      <UpdateNotice />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <UnsavedChangesProvider>
        <ActiveTimerProvider>
          <AppShell />
        </ActiveTimerProvider>
      </UnsavedChangesProvider>
    </DataProvider>
  );
}
