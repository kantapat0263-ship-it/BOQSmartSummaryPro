"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Target, Activity, Plus, Trash2,
  Cloud, HardDrive, CheckCircle2, AlertTriangle, Gauge, Layers,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { saveCostControl } from '@/lib/cost-control-store';
import {
  computeCostSummary, COST_TYPES, costTypeLabel,
  type CostControlData, type CostEntry, type CostType, type EntryStatus, type BudgetCat, type RAG,
} from '@/lib/cost-control';

const fmt0 = (n: number) => Math.round(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtSign = (n: number) => (n >= 0 ? '+' : '−') + fmt0(Math.abs(n));
const today = () => new Date().toISOString().slice(0, 10);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const RAG_BG: Record<RAG, string> = {
  good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', none: 'bg-slate-300',
};
const RAG_TEXT: Record<RAG, string> = {
  good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', none: 'text-slate-400',
};
const RAG_SOFT: Record<RAG, string> = {
  good: 'bg-emerald-50 border-emerald-200', warn: 'bg-amber-50 border-amber-200',
  bad: 'bg-red-50 border-red-200', none: 'bg-slate-50 border-slate-200',
};

interface Props {
  projectId: string;
  projectName: string;
  grand: number;
  budgetCats: BudgetCat[];
  initial: CostControlData;
  mode: 'cloud' | 'local';
}

export function CostControlView({ projectId, projectName, grand, budgetCats, initial, mode }: Props) {
  const [data, setData] = useState<CostControlData>(initial);
  const [saved, setSaved] = useState(true);
  const firstRun = useRef(true);

  // auto-save (debounce)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setSaved(false);
    const t = setTimeout(() => {
      saveCostControl(data).then(() => setSaved(true)).catch(() => setSaved(false));
    }, 600);
    return () => clearTimeout(t);
  }, [data]);

  const summary = useMemo(() => computeCostSummary(budgetCats, data), [budgetCats, data]);

  const setProgress = (cat: string, val: number) =>
    setData((d) => ({ ...d, progress: { ...d.progress, [cat]: val } }));
  const setProfit = (val: number) => setData((d) => ({ ...d, targetProfitPct: val }));
  const addEntry = (e: CostEntry) => setData((d) => ({ ...d, entries: [e, ...d.entries] }));
  const delEntry = (id: string) => setData((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== id) }));

  const chartData = summary.categories
    .filter((c) => c.boq > 0 || c.actual > 0)
    .slice(0, 12)
    .map((c) => ({
      name: c.category.replace(/^หมวด/, '').slice(0, 14),
      งบต้นทุน: Math.round(c.budgetCost),
      จ่ายจริง: Math.round(c.actual),
      คาดจบงาน: Math.round(c.eac),
      status: c.status,
    }));

  return (
    <div className="min-h-screen construction-pattern pb-24">
      {/* top bar */}
      <div className="hero-gradient text-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-100/80 hover:text-white text-sm font-bold mb-6">
            <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-secondary px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest mb-3">
                <Gauge className="w-3.5 h-3.5" /> Cost Control
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">{projectName}</h1>
              <p className="text-blue-100/70 font-medium mt-1">มูลค่าสัญญา ฿{fmt0(grand)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold bg-white/10 rounded-full px-4 py-2 backdrop-blur">
              {mode === 'cloud' ? <Cloud className="w-4 h-4 text-emerald-300" /> : <HardDrive className="w-4 h-4" />}
              {mode === 'cloud' ? 'บันทึกบนคลาวด์' : 'เก็บในเครื่อง'}
              <span className={`ml-1 ${saved ? 'text-emerald-300' : 'text-amber-300'}`}>
                {saved ? '• บันทึกแล้ว' : '• กำลังบันทึก…'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-8 space-y-10">
        {/* ===== HERO: กำไรคาดการณ์ ===== */}
        <div className={`rounded-[2.5rem] border-2 p-8 md:p-10 shadow-2xl bg-white ${RAG_SOFT[summary.status]}`}>
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" /> กำไรคาดการณ์ ณ ปัจจุบัน
              </p>
              <div className={`text-5xl md:text-6xl font-black tracking-tighter ${RAG_TEXT[summary.status]}`}>
                <span className="text-3xl mr-1">฿</span>
                <AnimatedNumber value={Math.round(summary.forecastProfit)} />
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3 text-sm font-bold">
                <span className="text-muted-foreground">
                  คิดเป็น {summary.forecastProfitPct.toFixed(1)}% ของสัญญา
                </span>
                <span className={summary.profitVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {summary.profitVariance >= 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
                  เทียบเป้า {fmtSign(summary.profitVariance)} บาท
                </span>
              </div>
              {summary.status === 'bad' && (
                <div className="mt-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3 text-sm font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" /> กำไรกำลังหดต่ำกว่าเป้า — ดูหมวดไฟแดงด้านล่างเพื่อแก้ก่อนสาย
                </div>
              )}
              {summary.status === 'good' && summary.totalActual > 0 && (
                <div className="mt-4 flex items-start gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" /> ต้นทุนอยู่ในกรอบ กำไรเป็นไปตามเป้า
                </div>
              )}
            </div>
            {/* เป้า vs คาด แท่งเทียบ */}
            <div className="space-y-4">
              <Bar2 label="กำไรเป้าหมาย" value={summary.targetProfit} max={Math.max(summary.targetProfit, summary.forecastProfit, 1)} color="bg-slate-400" />
              <Bar2 label="กำไรคาดการณ์" value={summary.forecastProfit} max={Math.max(summary.targetProfit, summary.forecastProfit, 1)} color={RAG_BG[summary.status]} />
              <div className="pt-2 grid grid-cols-2 gap-2 text-center">
                <Mini label="ความคืบหน้า" value={`${summary.overallProgressPct.toFixed(0)}%`} />
                <Mini label="CPI" value={summary.cpi ? summary.cpi.toFixed(2) : '—'} hint={summary.cpi ? (summary.cpi >= 1 ? 'คุ้มค่า' : 'ใช้เกินเนื้องาน') : ''} />
              </div>
            </div>
          </div>
        </div>

        {/* ===== KPI row ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi icon={<Layers />} label="งบต้นทุนเป้า" value={summary.totalBudgetCost} tone="primary" />
          <Kpi icon={<Wallet />} label="จ่ายจริง (รวมผูกพัน)" value={summary.totalActual} tone="secondary"
            sub={summary.committed > 0 ? `ผูกพัน ฿${fmt0(summary.committed)}` : undefined} />
          <Kpi icon={<Activity />} label="คาดต้นทุนจบงาน" value={summary.totalEAC} tone="primary" />
          <Kpi icon={<Target />} label="กำไรเป้าหมาย" value={summary.targetProfit} tone="secondary" />
        </div>

        {/* ===== ตั้งค่า: กำไรเป้า ===== */}
        <div className="bg-white rounded-3xl border border-border/60 p-6 shadow-sm flex flex-wrap items-center gap-4">
          <div className="font-black text-primary flex items-center gap-2"><Target className="w-5 h-5" /> กำไรเป้าหมายของโครงการ</div>
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <input
              type="range" min={0} max={40} step={0.5}
              value={data.targetProfitPct}
              onChange={(e) => setProfit(Number(e.target.value))}
              className="flex-1 accent-secondary"
            />
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={99} step={0.5}
                value={data.targetProfitPct}
                onChange={(e) => setProfit(Number(e.target.value))}
                className="w-20 text-right font-black text-lg border border-border rounded-xl px-3 py-1.5"
              />
              <span className="font-black text-lg">%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-medium w-full md:w-auto">
            งบต้นทุน = มูลค่า BOQ × {(100 - data.targetProfitPct).toFixed(1)}%
          </p>
        </div>

        {/* ===== chart: งบ vs จ่าย vs คาดจบ ===== */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-3xl border border-border/60 p-6 shadow-sm">
            <h3 className="font-black text-primary mb-4">งบต้นทุน · จ่ายจริง · คาดจบงาน (รายหมวด)</h3>
            <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 42)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} fontSize={11} />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                <Tooltip formatter={(v: number) => `฿${fmt0(v)}`} />
                <Legend />
                <Bar dataKey="งบต้นทุน" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                <Bar dataKey="จ่ายจริง" fill="#f97316" radius={[0, 4, 4, 0]} />
                <Bar dataKey="คาดจบงาน" radius={[0, 4, 4, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.status === 'bad' ? '#ef4444' : d.status === 'warn' ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ===== ตารางคุมต้นทุนรายหมวด ===== */}
        <div className="bg-white rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          <div className="p-6 pb-3">
            <h3 className="font-black text-primary">คุมต้นทุนรายหมวด</h3>
            <p className="text-xs text-muted-foreground font-medium">กรอก % ความคืบหน้าของแต่ละหมวด → ระบบคำนวณกำไรคาดการณ์ให้</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border/60 bg-muted/30">
                  <th className="text-left font-black px-4 py-3">หมวด</th>
                  <th className="text-right font-black px-3">มูลค่า BOQ</th>
                  <th className="text-right font-black px-3">งบต้นทุน</th>
                  <th className="text-center font-black px-3 w-28">% คืบหน้า</th>
                  <th className="text-right font-black px-3">จ่ายจริง</th>
                  <th className="text-center font-black px-3">CPI</th>
                  <th className="text-right font-black px-3">คาดจบงาน</th>
                  <th className="text-right font-black px-4">กำไรคาด</th>
                </tr>
              </thead>
              <tbody>
                {summary.categories.map((c) => (
                  <tr key={c.category} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${RAG_BG[c.status]}`} />
                        <span className="font-bold text-primary truncate" title={c.category}>{c.category}</span>
                        {!c.inBudget && <span className="text-[10px] font-bold text-red-500 shrink-0">นอกงบ</span>}
                      </div>
                    </td>
                    <td className="text-right px-3 tabular-nums text-muted-foreground">{fmt0(c.boq)}</td>
                    <td className="text-right px-3 tabular-nums">{fmt0(c.budgetCost)}</td>
                    <td className="px-3">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min={0} max={100} value={c.progressPct || ''}
                          onChange={(e) => setProgress(c.category, Math.min(100, Math.max(0, Number(e.target.value))))}
                          placeholder="0"
                          className="w-14 text-right border border-border rounded-lg px-2 py-1 tabular-nums focus:ring-2 focus:ring-primary/30 focus:outline-none"
                          disabled={!c.inBudget}
                        />
                        <span className="text-muted-foreground text-xs">%</span>
                      </div>
                    </td>
                    <td className="text-right px-3 tabular-nums font-semibold">{fmt0(c.actual)}</td>
                    <td className={`text-center px-3 tabular-nums font-bold ${c.cpi == null ? 'text-muted-foreground' : c.cpi >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {c.cpi == null ? '—' : c.cpi.toFixed(2)}
                    </td>
                    <td className="text-right px-3 tabular-nums">{fmt0(c.eac)}</td>
                    <td className={`text-right px-4 tabular-nums font-black ${c.forecastProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtSign(c.forecastProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-black text-primary">
                  <td className="px-4 py-3">รวมทั้งโครงการ</td>
                  <td className="text-right px-3 tabular-nums">{fmt0(summary.contract)}</td>
                  <td className="text-right px-3 tabular-nums">{fmt0(summary.totalBudgetCost)}</td>
                  <td className="text-center px-3 tabular-nums">{summary.overallProgressPct.toFixed(0)}%</td>
                  <td className="text-right px-3 tabular-nums">{fmt0(summary.totalActual)}</td>
                  <td className="text-center px-3 tabular-nums">{summary.cpi ? summary.cpi.toFixed(2) : '—'}</td>
                  <td className="text-right px-3 tabular-nums">{fmt0(summary.totalEAC)}</td>
                  <td className={`text-right px-4 tabular-nums ${summary.forecastProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtSign(summary.forecastProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ===== บันทึกรายจ่าย ===== */}
        <CostEntrySection
          categories={budgetCats.map((b) => b.category)}
          entries={data.entries}
          onAdd={addEntry}
          onDelete={delEntry}
        />
      </div>
    </div>
  );
}

// ---------- ฟอร์ม + รายการรายจ่าย ----------
function CostEntrySection({
  categories, entries, onAdd, onDelete,
}: {
  categories: string[];
  entries: CostEntry[];
  onAdd: (e: CostEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState(categories[0] ?? '');
  const [type, setType] = useState<CostType>('M');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<EntryStatus>('paid');
  const [note, setNote] = useState('');

  useEffect(() => { if (!category && categories[0]) setCategory(categories[0]); }, [categories, category]);

  const submit = () => {
    const amt = Number(amount);
    if (!category || !amt || amt <= 0) return;
    onAdd({ id: newId(), date, category, type, vendor: vendor.trim() || undefined, amount: amt, status, note: note.trim() || undefined });
    setAmount(''); setVendor(''); setNote('');
  };

  const inputCls = 'border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none';

  return (
    <div className="bg-white rounded-3xl border border-border/60 shadow-sm overflow-hidden">
      <div className="p-6 pb-4">
        <h3 className="font-black text-primary flex items-center gap-2"><Wallet className="w-5 h-5" /> บันทึกรายจ่ายจริง</h3>
        <p className="text-xs text-muted-foreground font-medium">กรอกค่าวัสดุ/ค่าแรง/ผู้รับเหมาช่วงที่จ่ายจริง → เข้าหมวดที่เลือก</p>
      </div>

      {/* form */}
      <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-7 gap-2 items-center">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} col-span-2 md:col-span-2`}>
          {categories.length === 0 && <option value="">— ไม่มีหมวด —</option>}
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as CostType)} className={inputCls}>
          {COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input placeholder="ผู้ขาย (ถ้ามี)" value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputCls} />
        <input type="number" placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} className={`${inputCls} text-right font-bold`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as EntryStatus)} className={inputCls}>
          <option value="paid">จ่ายแล้ว</option>
          <option value="committed">ผูกพัน (PO)</option>
        </select>
        <input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} col-span-2 md:col-span-6`} />
        <button onClick={submit} disabled={!category || !Number(amount)}
          className="bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-white rounded-xl px-4 py-2 font-black text-sm inline-flex items-center justify-center gap-1.5 md:col-span-1">
          <Plus className="w-4 h-4" /> เพิ่ม
        </button>
      </div>

      {/* list */}
      {entries.length > 0 ? (
        <div className="overflow-x-auto border-t border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="text-left font-black px-4 py-2.5">วันที่</th>
                <th className="text-left font-black px-3">หมวด</th>
                <th className="text-left font-black px-3">ประเภท</th>
                <th className="text-left font-black px-3">ผู้ขาย</th>
                <th className="text-right font-black px-3">จำนวนเงิน</th>
                <th className="text-center font-black px-3">สถานะ</th>
                <th className="px-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{e.date}</td>
                  <td className="px-3 font-semibold text-primary max-w-[200px] truncate" title={e.category}>{e.category}</td>
                  <td className="px-3">{costTypeLabel(e.type)}</td>
                  <td className="px-3 text-muted-foreground max-w-[160px] truncate">{e.vendor || '—'}</td>
                  <td className="px-3 text-right tabular-nums font-bold">{fmt0(e.amount)}</td>
                  <td className="px-3 text-center">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${e.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {e.status === 'paid' ? 'จ่ายแล้ว' : 'ผูกพัน'}
                    </span>
                  </td>
                  <td className="px-3 text-right">
                    <button onClick={() => onDelete(e.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-muted-foreground text-sm py-8 border-t border-border/60">ยังไม่มีรายจ่าย — เริ่มกรอกด้านบนได้เลย</p>
      )}
    </div>
  );
}

// ---------- ชิ้นเล็ก ----------
function Bar2({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs font-bold mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">฿{fmt0(value)}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-muted/40 rounded-2xl py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-black text-primary tabular-nums">{value}</p>
      {hint && <p className="text-[10px] font-bold text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Kpi({ icon, label, value, tone, sub }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'secondary'; sub?: string }) {
  const box = tone === 'primary' ? 'border-primary/10' : 'border-secondary/10';
  const chip = tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary';
  const txt = tone === 'primary' ? 'text-primary' : 'text-secondary';
  return (
    <div className={`rounded-3xl border p-5 bg-white shadow-sm ${box}`}>
      <div className={`inline-flex p-2 rounded-xl mb-3 ${chip}`}>{icon}</div>
      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black tracking-tight tabular-nums ${txt}`}>฿{fmt0(value)}</p>
      {sub && <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
