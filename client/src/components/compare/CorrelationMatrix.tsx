import { Card } from "../common/Card";

interface Props {
  symbols: string[];
  pairCorrelations: Record<string, number>;
  marketCorrelations: Record<string, number>;
}

function colorForR(r: number): string {
  if (r > 0.7) return "#059669";
  if (r > 0.3) return "#34d399";
  if (r > -0.3) return "#d97706";
  if (r > -0.7) return "#f87171";
  return "#dc2626";
}

export function CorrelationMatrix({ symbols, pairCorrelations, marketCorrelations }: Props) {
  const allSyms = [...symbols, "SPY"];

  return (
    <Card title="Correlation Matrix (R values)">
      <div className="table-wrapper">
        <table className="stock-table correlation-table">
          <thead>
            <tr>
              <th></th>
              {allSyms.map((s) => <th key={s}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {allSyms.map((row) => (
              <tr key={row}>
                <td className="font-bold">{row}</td>
                {allSyms.map((col) => {
                  if (row === col) return <td key={col} className="corr-self">1.00</td>;
                  let r: number | undefined;
                  if (row === "SPY") r = marketCorrelations[col];
                  else if (col === "SPY") r = marketCorrelations[row];
                  else {
                    r = pairCorrelations[`${row}_${col}`] ?? pairCorrelations[`${col}_${row}`];
                  }
                  const val = r ?? 0;
                  return (
                    <td key={col} style={{ color: colorForR(val), fontWeight: 600 }}>
                      {val.toFixed(4)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted" style={{ marginTop: 8 }}>
        R close to 1 = move together | R close to -1 = move opposite | R near 0 = independent
      </p>
    </Card>
  );
}
