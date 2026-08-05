import { NavLink, Route, Routes } from "react-router-dom";
import { DataProvider, useData } from "./lib/DataContext";
import LogPage from "./pages/LogPage";
import StatsPage from "./pages/StatsPage";
import RulesPage from "./pages/RulesPage";
import BacktestPage from "./pages/BacktestPage";
import SettingsPage from "./pages/SettingsPage";

function Sidebar() {
  const { githubReady } = useData();
  return (
    <nav className="sidebar">
      <h1>Trading Dashboard</h1>
      <NavLink to="/" end>
        Log
      </NavLink>
      <NavLink to="/stats">Stats</NavLink>
      <NavLink to="/rules">Rules &amp; Notes</NavLink>
      <NavLink to="/backtest">Backtest</NavLink>
      <NavLink to="/settings">
        Settings {!githubReady && <span style={{ color: "var(--amber)" }}>●</span>}
      </NavLink>
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
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
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
