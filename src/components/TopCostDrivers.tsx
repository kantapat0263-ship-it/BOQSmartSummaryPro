"use client"

import React, { useMemo } from 'react';
import { Target, TrendingUp } from 'lucide-react';

interface MaterialRow {
  cat: string;
  name: string;
  unit: string;
  qty: number;
  tot: number;
  unitRate: number;
  buildings: number;
}

interface TopCostDriversProps {
  materials: MaterialRow[];
  grandTotal: number;
  topN?: number;
}

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

export function TopCostDrivers({ materials, grandTotal, topN = 10 }: TopCostDriversProps) {
  const { rows, itemsTo80, maxTot } = useMemo(() => {
    const sorted = [...materials].sort((a, b) => b.tot - a.tot);
    let cum = 0;
    let reached80 = 0;
    let found = false;
    const withCum = sorted.map((m) => {
      cum += m.tot;
      const cumPct = grandTotal ? (cum / grandTotal) * 100 : 0;
      if (!found) {
        reached80 += 1;
        if (cumPct >= 80) found = true;
      }
      return {
        ...m,
        pct: grandTotal ? (m.tot / grandTotal) * 100 : 0,
        cumPct,
      };
    });
    return {
      rows: withCum.slice(0, topN),
      itemsTo80: reached80,
      maxTot: sorted.length ? sorted[0].tot : 0,
    };
  }, [materials, grandTotal, topN]);

  if (materials.length === 0) return null;

  const pct80 = materials.length ? (itemsTo80 / materials.length) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mt-8">
      <div className="p-6 border-b border-border/60 flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-secondary" />
          รายการที่กินงบสูงสุด (Top Cost Drivers)
        </h3>
        <div className="text-sm bg-secondary/10 text-secondary font-bold px-4 py-2 rounded-xl flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          {fmt(itemsTo80)} รายการ ({pct80.toFixed(0)}% ของทั้งหมด) = 80% ของงบ
        </div>
      </div>
      <div className="p-6 space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                <span className="font-medium truncate" title={r.name}>{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                  {r.cat.replace('งาน', '')}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-bold">฿{fmt(r.tot)}</span>
                <span className="text-muted-foreground text-xs ml-2">({r.pct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                  style={{ width: `${maxTot ? (r.tot / maxTot) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">
                สะสม {r.cumPct.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
