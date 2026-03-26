import { useMemo } from "react";

interface Props {
  totalPoints: number;
  range: [number, number];
  onChange: (range: [number, number]) => void;
  dates: string[];
}

export function TimeSlider({ totalPoints, range, onChange, dates }: Props) {
  const startDate = dates[range[0]] || "";
  const endDate = dates[range[1]] || "";

  const pctStart = useMemo(
    () => ((range[0] / totalPoints) * 100).toFixed(1),
    [range, totalPoints]
  );
  const pctEnd = useMemo(
    () => ((range[1] / totalPoints) * 100).toFixed(1),
    [range, totalPoints]
  );

  return (
    <div className="time-slider">
      <div className="time-slider-labels">
        <span className="text-sm">{startDate.slice(5)}</span>
        <span className="text-sm text-muted">
          {range[1] - range[0]} days selected
        </span>
        <span className="text-sm">{endDate.slice(5)}</span>
      </div>
      <div className="time-slider-track">
        <div
          className="time-slider-fill"
          style={{ left: `${pctStart}%`, width: `${Number(pctEnd) - Number(pctStart)}%` }}
        />
      </div>
      <div className="time-slider-inputs">
        <input
          type="range" min={0} max={totalPoints - 1}
          value={range[0]}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v < range[1]) onChange([v, range[1]]);
          }}
        />
        <input
          type="range" min={0} max={totalPoints - 1}
          value={range[1]}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v > range[0]) onChange([range[0], v]);
          }}
        />
      </div>
    </div>
  );
}
