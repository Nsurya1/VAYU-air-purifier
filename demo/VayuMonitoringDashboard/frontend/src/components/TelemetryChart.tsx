import React, { useState } from 'react';
import { TelemetryRecord } from '../types/device';

interface TelemetryChartProps {
  data: TelemetryRecord[];
  metricKey: keyof TelemetryRecord;
  title: string;
  unit: string;
  strokeColor?: string;
  fillColor?: string;
  height?: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  metricKey,
  title,
  unit,
  strokeColor = '#F47721',
  fillColor,
  height = 180,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Reverse so oldest is on the left, newest on the right
  const points = [...data].reverse();

  if (points.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          borderRadius: '6px',
          border: '1px dashed #CBD5E1',
          color: '#64748B',
          fontSize: '0.85rem',
        }}
      >
        No telemetry readings available
      </div>
    );
  }

  // Extract numerical values
  const rawValues = points.map((p) => {
    const val = p[metricKey];
    return typeof val === 'number' ? val : null;
  });

  const validValues = rawValues.filter((v): v is number => v !== null);
  const minVal = validValues.length > 0 ? Math.floor(Math.min(...validValues)) : 0;
  const maxVal = validValues.length > 0 ? Math.ceil(Math.max(...validValues)) : 100;
  const range = maxVal - minVal > 0 ? maxVal - minVal : 1;

  const width = 600;
  const padding = { top: 20, right: 30, bottom: 25, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Build SVG path coordinates
  const coords: { x: number; y: number; val: number | null; time: string }[] = points.map((p, i) => {
    const val = rawValues[i];
    const x = padding.left + (i / Math.max(points.length - 1, 1)) * chartWidth;
    const y = val !== null ? padding.top + chartHeight - ((val - minVal) / range) * chartHeight : chartHeight + padding.top;
    return { x, y, val, time: p.recordedAt };
  });

  // Construct SVG polyline and area path
  let pathD = '';
  let areaD = '';
  let isDrawing = false;

  coords.forEach((pt, i) => {
    if (pt.val !== null) {
      if (!isDrawing) {
        pathD += `M ${pt.x} ${pt.y} `;
        areaD += `M ${pt.x} ${chartHeight + padding.top} L ${pt.x} ${pt.y} `;
        isDrawing = true;
      } else {
        pathD += `L ${pt.x} ${pt.y} `;
        areaD += `L ${pt.x} ${pt.y} `;
      }
    } else {
      if (isDrawing) {
        areaD += `L ${coords[i - 1].x} ${chartHeight + padding.top} Z `;
        isDrawing = false;
      }
    }
  });

  if (isDrawing && coords.length > 0) {
    const lastValid = coords.filter((c) => c.val !== null).pop();
    if (lastValid) {
      areaD += `L ${lastValid.x} ${chartHeight + padding.top} Z`;
    }
  }

  const activePoint = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : coords[coords.length - 1];

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '0.85rem', border: '1px solid #E2E8F0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0B1F3A' }}>
              {activePoint && activePoint.val !== null ? activePoint.val : '--'}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>{unit}</span>
          </div>
        </div>
        {activePoint && (
          <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {new Date(activePoint.time).toLocaleTimeString()}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={`grad-${String(metricKey)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor || strokeColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = padding.top + chartHeight * (1 - pct);
          const label = Math.round(minVal + range * pct);
          return (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#F1F5F9" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="var(--font-mono)">
                {label}
              </text>
            </g>
          );
        })}

        {/* Gradient Area */}
        {areaD && <path d={areaD} fill={`url(#grad-${String(metricKey)})`} />}

        {/* Main Line */}
        {pathD && <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Hover Points & Interactive Hitboxes */}
        {coords.map((pt, i) => (
          <g key={i}>
            {/* Transparent hover column */}
            <rect
              x={pt.x - (chartWidth / points.length) / 2}
              y={padding.top}
              width={chartWidth / points.length}
              height={chartHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIndex(i)}
            />
            {/* Highlight Dot */}
            {hoverIndex === i && pt.val !== null && (
              <>
                <line x1={pt.x} y1={padding.top} x2={pt.x} y2={padding.top + chartHeight} stroke="#CBD5E1" strokeDasharray="3 3" />
                <circle cx={pt.x} cy={pt.y} r="5" fill="#FFFFFF" stroke={strokeColor} strokeWidth="3" />
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
