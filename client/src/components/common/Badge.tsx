interface Props {
  value: number | null;
  type: "change" | "margin" | "yield";
  suffix?: string;
}

export function Badge({ value, type, suffix = "%" }: Props) {
  if (value === null || value === undefined) return <span className="text-muted">N/A</span>;

  const isPositive = value > 0;
  const colorClass =
    type === "change"
      ? isPositive ? "text-green" : "text-red"
      : type === "margin"
        ? isPositive ? "text-green" : "text-red"
        : "text-green";

  return (
    <span className={colorClass}>
      {type === "change" && isPositive ? "+" : ""}
      {value.toFixed(2)}{suffix}
    </span>
  );
}
