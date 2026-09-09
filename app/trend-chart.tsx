'use client';
import { useEffect, useId, useRef, useState } from 'react';
export type TrendPoint = { id: string; date: string; value: number };
export function TrendChart({
  points,
  label,
  unit,
}: {
  points: TrendPoint[];
  label: string;
  unit: string;
}) {
  const id = useId().replaceAll(':', '');
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(700);
  const hasPoints = points.length > 0;
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(180, entry.contentRect.width)),
    );
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, [hasPoints]);
  if (!points.length) return <p>No entries in this period.</p>;
  const data = [...points].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  const values = data.map((p) => p.value),
    dates = data.map((p) => Date.parse(p.date));
  const low = Math.min(...values),
    high = Math.max(...values),
    pad = Math.max(1, (high - low) * 0.15);
  const min = Math.max(0, low - pad),
    max = high + pad;
  const start = dates[0],
    end = dates.at(-1)!;
  const xy = data.map((p, i) => ({
    x:
      start === end
        ? 60 + (width - 85) / 2
        : 60 + ((dates[i] - start) / (end - start)) * (width - 85),
    y: 174 - ((p.value - min) / (max - min)) * 145,
  }));
  return (
    <>
      <svg
        ref={chart}
        className="weight-chart"
        viewBox={`0 0 ${width} 210`}
        style={{ height: 210 }}
        role="img"
        aria-label={`${label}: ${data.length} recorded entries. Values are listed below the chart.`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#8ee8ff" stopOpacity=".25" />
            <stop offset="1" stopColor="#8ee8ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[min, (max + min) / 2, max].map((v, i) => (
          <g key={i}>
            <line
              x1="60"
              x2={width - 15}
              y1={174 - i * 72.5}
              y2={174 - i * 72.5}
              stroke="#b0d5ef"
              strokeOpacity=".12"
            />
            <text
              x="48"
              y={178 - i * 72.5}
              textAnchor="end"
              fill="#aec5da"
              fontSize="12"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {xy.length > 1 && (
          <path
            d={`M${xy[0].x} 190 L${xy.map((p) => `${p.x} ${p.y}`).join(' L')} L${xy.at(-1)!.x} 190 Z`}
            fill={`url(#${id})`}
          />
        )}
        <polyline
          points={xy.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#8ee8ff"
          strokeWidth="3"
        />
        {xy.map((p, i) => (
          <circle key={data[i].id} cx={p.x} cy={p.y} r="4" fill="#b7efff">
            <title>
              {data[i].date.slice(0, 10)}: {data[i].value} {unit}
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-range">
        <span>
          {data[0].date.slice(0, 10)} · {values[0]} {unit}
        </span>
        <span>
          {data.at(-1)!.date.slice(0, 10)} · {values.at(-1)} {unit}
        </span>
      </div>
      <p className="quiet-note">
        Dates use actual time spacing. The vertical scale follows your recorded
        range.
      </p>
      <details className="chart-values">
        <summary>View {label.toLowerCase()} values</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Recorded</th>
              <th scope="col">
                {label} ({unit})
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.date.length > 10
                    ? new Date(p.date).toLocaleString()
                    : p.date}
                </td>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
