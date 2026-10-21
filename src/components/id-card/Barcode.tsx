'use client';

import React from 'react';
import { encodeCode128Runs } from '@/lib/id-card/barcode';

interface BarcodeProps {
  value: string;
  className?: string;
  height?: number;
  barColor?: string;
}

/**
 * Ultra-high-contrast, responsive SVG Barcode component for gate officer and escort cameras.
 * Module-scaled with crisp edges for instantaneous decode by 1D laser & 2D mobile camera scanners.
 */
export default function Barcode({
  value,
  className = 'w-full h-10',
  height = 44,
  barColor = '#000000',
}: BarcodeProps) {
  const { runs, totalModules } = encodeCode128Runs(value || '2604 8213 0010', 8);

  let currentX = 0;

  return (
    <svg
      viewBox={`0 0 ${totalModules} ${height}`}
      className={className}
      preserveAspectRatio="none"
      style={{ shapeRendering: 'crispEdges' }}
      aria-label={`Barcode: ${value}`}
    >
      {runs.map((run, idx) => {
        const x = currentX;
        currentX += run.width;
        if (!run.isBar) return null;
        return (
          <rect
            key={idx}
            x={x}
            y={0}
            width={run.width}
            height={height}
            fill={barColor}
          />
        );
      })}
    </svg>
  );
}
