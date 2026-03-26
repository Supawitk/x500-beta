import React from "react";

/**
 * Custom Bar shape that clamps negative width/height to 0.
 * Prevents "Invalid negative value for <rect> attribute height" SVG errors
 * that occur when Recharts calculates sub-pixel or negative bar dimensions.
 */
export function SafeBarShape(props: any) {
  const { x, y, width, height, fill, stroke, radius, ...rest } = props;
  const safeWidth = Math.max(0, width ?? 0);
  const safeHeight = Math.max(0, height ?? 0);
  const safeY = height < 0 ? (y ?? 0) + (height ?? 0) : y ?? 0;

  if (safeWidth === 0 || safeHeight === 0) return null;

  return (
    <rect
      x={x}
      y={safeY}
      width={safeWidth}
      height={safeHeight}
      fill={fill}
      stroke={stroke}
      rx={typeof radius === "number" ? radius : 0}
      ry={typeof radius === "number" ? radius : 0}
      {...rest}
    />
  );
}
