import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { DataProvider, useData } from "./lib/DataContext";
import { applyTheme, loadTheme, type Theme } from "./lib/theme";
import SessionReminder from "./components/SessionReminder";
import StrategyPicker from "./components/StrategyPicker";
import LogPage from "./pages/LogPage";
import StatsPage from "./pages/StatsPage";
import StrategyPage from "./pages/StrategyPage";
import BacktestPage from "./pages/BacktestPage";
import SettingsPage from "./pages/SettingsPage";

function Sidebar() {
  const { githubReady } = useData();
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <nav className="sidebar">
      <h1>Trading Journal</h1>
      <StrategyPicker />
      <NavLink to="/" end>
        Log
      </NavLink>
      <NavLink to="/stats">Stats</NavLink>
      <NavLink to="/strategy">Strategy</NavLink>
      <NavLink to="/backtest">Backtest</NavLink>
      <NavLink to="/settings">
        Settings {!githubReady && <span style={{ color: "var(--amber)" }}>●</span>}
      </NavLink>

      <div className="sidebar-footer">
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
        </Routes>
      </div>
      <SessionReminder />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}
