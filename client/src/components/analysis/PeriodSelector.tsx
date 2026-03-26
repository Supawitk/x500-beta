interface Props {
  period: string;
  onChange: (p: string) => void;
}

const PERIODS = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
];

export function PeriodSelector({ period, onChange }: Props) {
  return (
    <div className="period-selector">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          className={`period-btn ${period === p.value ? "active" : ""}`}
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
