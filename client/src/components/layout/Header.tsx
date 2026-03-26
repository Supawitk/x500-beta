import { BarChart3 } from "lucide-react";

interface Props {
  lastUpdated?: string;
}

export function Header({ lastUpdated }: Props) {
  const time = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString()
    : null;

  return (
    <header className="header">
      <div className="header-left">
        <BarChart3 size={24} />
        <h1>S&P 500 Value & Dividend Dashboard</h1>
      </div>
      {time && <span className="header-time">Updated: {time}</span>}
    </header>
  );
}
