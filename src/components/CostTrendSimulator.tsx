"use client"

import React, { useMemo, useState } from 'react';
import { TrendingUp, Info, Calculator, ChevronDown } from 'lucide-react';
import {
  Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface CatRow { cat: string; tot: number; pct: number; }
interface CostTrendSimulatorProps {
  grand: number;
  summary: CatRow[];
}

const fmt0 = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtSigned = (n: number) => (n > 0 ? '+' : '') + fmt0(n);

export function CostTrendSimulator({ grand, summary }: CostTrendSimulatorProps) {
  const [baseStr, setBaseStr] = useState('5');
  const [months, setMonths] = useState(12);
  const [marginStr, setMarginStr] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const margin = marginStr.trim() === '' ? null : (parseFloat(marginStr) || 0);
  const cats = useMemo(() => summary.filter((c) => c.tot > 0).sort((a, b) => b.tot - a.tot), [summary]);

  // อัตราของแต่ละหมวด: ใช้ค่าที่ผู้ใช้ตั้งเอง ถ้าไม่ตั้ง = อัตราพื้นฐาน
  const inputVal = (cat: string) => overrides[cat] ?? baseStr;
  const rateOf = (cat: string) => {
    const v = parseFloat(overrides[cat] ?? baseStr);
    return isFinite(v) ? v : 0;
  };
  const setRate = (cat: string, v: string) => setOverrides((p) => ({ ...p, [cat]: v }));

  const { series, projected, diff, diffPct, blended, profit, atHorizon } = useMemo(() => {
    const catCost = (c: CatRow, m: number) => c.tot * Math.pow(1 + rateOf(c.cat) / 100, m / 12);
    const total = (m: number) => cats.reduce((s, c) => s + catCost(c, m), 0);

    const series = Array.from({ length: months + 1 }, (_, m) => ({ m, cost: Math.round(total(m)) }));
    const projected = total(months);
    const diff = projected - grand;
    const diffPct = grand ? (diff / grand) * 100 : 0;
    // อัตราเฉลี่ยถ่วงน้ำหนัก (effective blended rate ต่อปี)
    const blended = grand > 0 && months > 0 ? (Math.pow(projected / grand, 12 / months) - 1) * 100 : 0;

    const atHorizon = cats.map((c) => ({
      cat: c.cat, rate: rateOf(c.cat), now: c.tot, future: catCost(c, months),
    }));

    let profit = null as null | { sell: number; now: number; then: number; lost: number; mNow: number; mThen: number; };
    if (margin !== null) {
      const sell = grand * (1 + margin / 100);
      const now = sell - grand;
      const then = sell - projected;
      profit = { sell, now, then, lost: now - then, mNow: margin, mThen: projected ? (then / projected) * 100 : 0 };
    }
    return { series, projected, diff, diffPct, blended, profit, atHorizon };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grand, cats, overrides, baseStr, months, margin]);

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mt-8">
      <div className="p-6 border-b border-border/60">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-secondary" />
          จำลองแนวโน้มต้นทุน (Cost Trend Simulator)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          ตั้งอัตราราคาขึ้นแยกตามหมวด แล้วระบบถ่วงน้ำหนักตามสัดส่วนต้นทุนจริง → แม่นกว่าใช้อัตราเดียว
        </p>
      </div>

      {/* base controls */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border/60">
        <label className="space-y-1.5 block">
          <span className="text-sm font-medium">อัตราพื้นฐาน (% ต่อปี)</span>
          <Input type="number" inputMode="decimal" value={baseStr}
            onChange={(e) => setBaseStr(e.target.value)} placeholder="เช่น 5" />
          <span className="text-[11px] text-muted-foreground">ใช้กับหมวดที่ยังไม่ตั้งเอง</span>
        </label>
        <label className="space-y-1.5 block">
          <span className="text-sm font-medium">มองไปข้างหน้า</span>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[6, 12, 18, 24, 36].map((m) => (<SelectItem key={m} value={String(m)}>{m} เดือน</SelectItem>))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5 block">
          <span className="text-sm font-medium">กำไรที่ตั้งไว้ (% ของต้นทุน) <span className="text-muted-foreground font-normal">— ไม่บังคับ</span></span>
          <Input type="number" inputMode="decimal" value={marginStr}
            onChange={(e) => setMarginStr(e.target.value)} placeholder="เช่น 10" />
        </label>
      </div>

      {/* per-category rates */}
      <div className="px-6 py-4 border-b border-border/60">
        <p className="text-sm font-semibold mb-2">อัตราราคาขึ้นแยกตามหมวด (% ต่อปี)</p>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left border-b border-border/40">
                <th className="py-2 pr-2 font-semibold">หมวดงาน</th>
                <th className="py-2 px-2 font-semibold text-right">ต้นทุนปัจจุบัน</th>
                <th className="py-2 px-2 font-semibold text-right">% โครงการ</th>
                <th className="py-2 pl-2 font-semibold text-right">อัตรา %/ปี</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.cat} className="border-b border-border/30">
                  <td className="py-1.5 pr-2 font-medium">{c.cat.replace('งาน', '')}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">฿{fmt0(c.tot)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{c.pct.toFixed(1)}%</td>
                  <td className="py-1.5 pl-2 text-right">
                    <input type="number" inputMode="decimal" value={inputVal(c.cat)}
                      onChange={(e) => setRate(c.cat, e.target.value)}
                      className="w-20 text-right rounded-md border border-border/60 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 tabular-nums" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* summary cards */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">ต้นทุนปัจจุบัน</p>
          <p className="text-2xl font-black text-primary mt-1">฿{fmt0(grand)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">คาดการณ์ ณ {months} เดือน</p>
          <p className="text-2xl font-black text-primary mt-1">฿{fmt0(projected)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">อัตราเฉลี่ยถ่วงน้ำหนัก ≈ {blended.toFixed(1)}%/ปี</p>
        </div>
        <div className={`rounded-xl border p-4 ${diff > 0 ? 'border-red-200 bg-red-50' : diff < 0 ? 'border-emerald-200 bg-emerald-50' : 'border-border/60'}`}>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">ต้นทุนเพิ่มขึ้น</p>
          <p className={`text-2xl font-black mt-1 ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-primary'}`}>
            ฿{fmtSigned(diff)} <span className="text-base">({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* profit impact */}
      {profit && (
        <div className={`mx-6 mb-6 rounded-xl p-4 ${profit.then < 0 ? 'bg-red-100 border border-red-300' : profit.then < profit.now ? 'bg-amber-50 border border-amber-300' : 'bg-emerald-50 border border-emerald-300'}`}>
          <p className="text-sm font-bold mb-1">ผลกระทบต่อกำไร (สมมติราคาขายล็อกที่ ฿{fmt0(profit.sell)})</p>
          <p className="text-sm">
            กำไรเดิม <b>฿{fmt0(profit.now)}</b> ({profit.mNow.toFixed(1)}%) →
            ถ้าเริ่มช้า {months} เดือน เหลือ <b>฿{fmt0(profit.then)}</b> ({profit.mThen.toFixed(1)}%)
            {' '}— {profit.then < 0
              ? <span className="text-red-700 font-bold">ขาดทุน ฿{fmt0(-profit.then)} ⚠️</span>
              : <span className="font-bold">กำไรหาย ฿{fmt0(profit.lost)}</span>}
          </p>
        </div>
      )}

      {/* chart */}
      <div className="px-6 pb-6 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="m" tickFormatter={(m) => `${m} ด.`} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number) => [`฿${fmt0(v)}`, 'ต้นทุนคาดการณ์']}
              labelFormatter={(m) => `เดือนที่ ${m}`}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <ReferenceLine y={grand} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="cost" stroke="hsl(var(--secondary))" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* transparency */}
      <div className="px-6 pb-6 -mt-2 space-y-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>เป็น <b>ภาพจำลองตามสมมติฐานที่กรอก</b> ไม่ใช่การพยากรณ์จริง</span>
        </div>

        <details className="group rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold flex items-center gap-2 hover:bg-muted/40 transition-colors">
            <Calculator className="w-4 h-4 text-secondary" />
            วิธีคำนวณ (กดเพื่อดูที่มา)
            <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 pt-1 text-sm space-y-3 text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground mb-1">1) ต้นทุนอนาคต = รวมรายหมวด (ถ่วงน้ำหนัก)</p>
              <p className="font-mono text-xs bg-background rounded-lg p-2 border border-border/60">
                ต้นทุนอนาคต = Σ [ ต้นทุนหมวด × (1 + อัตราหมวด)<sup>เดือน ÷ 12</sup> ]
              </p>
              <p className="text-xs mt-1">
                แต่ละหมวดโตด้วยอัตราของตัวเอง แล้วรวมกัน → ได้อัตราเฉลี่ยถ่วงน้ำหนัก ≈ <b className="text-foreground">{blended.toFixed(1)}%/ปี</b>
                {' '}(ต้นทุนรวม ฿{fmt0(grand)} → <b className="text-foreground">฿{fmt0(projected)}</b>, {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
              </p>
            </div>

            {/* per-category breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left border-b border-border/40">
                    <th className="py-1 pr-2">หมวด</th>
                    <th className="py-1 px-2 text-right">อัตรา</th>
                    <th className="py-1 px-2 text-right">ปัจจุบัน</th>
                    <th className="py-1 pl-2 text-right">ณ {months} ด.</th>
                  </tr>
                </thead>
                <tbody>
                  {atHorizon.map((r) => (
                    <tr key={r.cat} className="border-b border-border/20">
                      <td className="py-1 pr-2">{r.cat.replace('งาน', '')}</td>
                      <td className="py-1 px-2 text-right tabular-nums">{r.rate}%</td>
                      <td className="py-1 px-2 text-right tabular-nums">฿{fmt0(r.now)}</td>
                      <td className="py-1 pl-2 text-right tabular-nums font-medium text-foreground">฿{fmt0(r.future)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {profit && (
              <div>
                <p className="font-semibold text-foreground mb-1">2) ผลกระทบต่อกำไร (ราคาขายล็อกไว้แล้ว)</p>
                <p className="font-mono text-xs bg-background rounded-lg p-2 border border-border/60 leading-relaxed">
                  ราคาขาย = ต้นทุนปัจจุบัน × (1 + กำไร%) = ฿{fmt0(profit.sell)}<br />
                  กำไรคงเหลือ = ราคาขาย − ต้นทุนอนาคต = ฿{fmt0(profit.then)}<br />
                  กำไรที่หาย = ต้นทุนที่เพิ่มขึ้น = ฿{fmt0(diff)}
                </p>
              </div>
            )}

            <div>
              <p className="font-semibold text-foreground mb-1">ข้อจำกัด & แหล่งอ้างอิง</p>
              <ul className="text-xs list-disc list-inside space-y-0.5">
                <li>คิดเป็น <b>อัตราต่อหมวด</b> (ทบต้นรายปี) ไม่รวมปัจจัยอื่น (อัตราแลกเปลี่ยน, ดีมานด์, ฤดูกาล)</li>
                <li>แม่นเท่ากับ <b>สมมติฐาน %</b> ที่กรอก — ควรอิงข้อมูลจริง</li>
                <li>ตั้งค่า % จาก <b>ดัชนีราคาวัสดุก่อสร้าง</b> (กระทรวงพาณิชย์) หรือ <b>ราคากลาง</b> (กรมบัญชีกลาง)</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
