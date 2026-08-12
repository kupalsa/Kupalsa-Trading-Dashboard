import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import LiveSessionPanel from "../components/LiveSessionPanel";
import TradeForm from "../components/TradeForm";
import TradeTable from "../components/TradeTable";
import DailyReviewPanel from "../components/DailyReviewPanel";

export default function LogPage() {
  const { githubReady, loading, error } = useData();

  if (!githubReady) {
    return (
      <div className="panel">
        <h2>Connect GitHub first</h2>
        <p>
          Head to <Link to="/settings">Settings</Link> and add your GitHub username, repository, and a
          Personal Access Token so trades can be saved.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Trade Log</h1>
      {error && <p className="error-text">{error}</p>}
      <LiveSessionPanel />
      <TradeForm />
      <DailyReviewPanel />
      <div className="panel">
        <h2>Recent Trades</h2>
        {loading ? <p className="muted">Loading…</p> : <TradeTable />}
      </div>
    </div>
  );
}
