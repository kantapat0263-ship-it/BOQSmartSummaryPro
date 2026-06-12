"use client"

import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, Download, Scale, Building2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MaterialRow {
  cat: string;
  name: string;
  unit: string;
  qty: number;
  mat: number;
  lab: number;
  tot: number;
  unitRate: number;
  buildings: number;
  buildingList: string;
}

interface MaterialTableProps {
  materials: MaterialRow[];
  filename: string;
}

type SortKey = 'name' | 'cat' | 'qty' | 'unitRate' | 'tot' | 'buildings' | 'variance';

const fmt2 = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const keyOf = (m: MaterialRow) => `${m.cat}||${m.name}||${m.unit}`;

export function MaterialTable({ materials, filename }: MaterialTableProps) {
  const storeKey = `boq:refprice:${filename}`;
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('tot');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [refInput, setRefInput] = useState<Record<string, string>>({});

  // hydrate reference prices from localStorage (per file)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      setRefInput(raw ? JSON.parse(raw) : {});
    } catch {
      setRefInput({});
    }
  }, [storeKey]);

  const setRef = (k: string, v: string) => {
    setRefInput((prev) => {
      const next = { ...prev };
      if (v.trim() === '') delete next[k];
      else next[k] = v;
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const categories = useMemo(() => Array.from(new Set(materials.map((m) => m.cat))), [materials]);

  const rows = useMemo(() => {
    const refOf = (m: MaterialRow) => {
      const v = parseFloat(refInput[keyOf(m)]);
      return isFinite(v) ? v : null;
    };
    const q = search.trim().toLowerCase();
    let list = materials
      .filter((m) => (catFilter === 'all' || m.cat === catFilter))
      .filter((m) => (q === '' || m.name.toLowerCase().includes(q) || m.unit.toLowerCase().includes(q)))
      .map((m) => {
        const ref = refOf(m);
        const varTot = ref !== null ? (m.unitRate - ref) * m.qty : null;
        return { ...m, ref, varTot };
      });

    const dir = sortDir === 'asc' ? 1 : -1;
    list = list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case 'name': av = a.name; bv = b.name; break;
        case 'cat': av = a.cat; bv = b.cat; break;
        case 'qty': av = a.qty; bv = b.qty; break;
        case 'unitRate': av = a.unitRate; bv = b.unitRate; break;
        case 'buildings': av = a.buildings; bv = b.buildings; break;
        case 'variance': av = a.varTot ?? -Infinity; bv = b.varTot ?? -Infinity; break;
        default: av = a.tot; bv = b.tot;
      }
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv, 'th') * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return list;
  }, [materials, refInput, search, catFilter, sortKey, sortDir]);

  const compared = rows.filter((r) => r.ref !== null);
  const totalVariance = compared.reduce((acc, r) => acc + (r.varTot ?? 0), 0);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'name' || k === 'cat' ? 'asc' : 'desc'); }
  };

  const exportCSV = () => {
    const head = ['หมวด', 'รายการ', 'หน่วย', 'จำนวนรวม', 'ราคา/หน่วย(จริง)', 'ราคาอ้างอิง/หน่วย', 'ส่วนต่าง/หน่วย', 'ส่วนต่างรวม', 'รวมเป็นเงิน', 'ใช้กี่อาคาร', 'อาคารที่ใช้'];
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    for (const r of rows) {
      lines.push([
        r.cat, r.name, r.unit, r.qty, r.unitRate.toFixed(2),
        r.ref !== null ? r.ref.toFixed(2) : '',
        r.ref !== null ? (r.unitRate - r.ref).toFixed(2) : '',
        r.varTot !== null ? r.varTot.toFixed(2) : '',
        r.tot.toFixed(2), r.buildings, r.buildingList,
      ].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[เทียบราคา] ${filename.replace(/\.xlsx$/i, '')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SortBtn = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 font-semibold hover:text-primary transition-colors ${className}`}>
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? 'text-primary' : 'text-muted-foreground/40'}`} />
    </button>
  );

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mt-8">
      <div className="p-6 border-b border-border/60 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            ตารางวัสดุ & เทียบราคาอ้างอิง
          </h3>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อวัสดุ / หน่วย..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="ทุกหมวดงาน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหมวดงาน</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          แสดง {fmt0(rows.length)} รายการ • กรอก "ราคาอ้างอิง/หน่วย" (ราคากลาง/ราคาที่ตั้งไว้) เพื่อดูส่วนต่าง — ระบบจำค่าให้แม้ปิดหน้าเว็บ
        </p>
      </div>

      {/* variance summary */}
      {compared.length > 0 && (
        <div className={`px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium border-b border-border/60 ${totalVariance > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          <span>เทียบราคาแล้ว <b>{fmt0(compared.length)}</b> รายการ</span>
          <span>
            ผลรวมส่วนต่าง:{' '}
            <b>{totalVariance > 0 ? '+' : ''}{fmt2(totalVariance)} บาท</b>{' '}
            {totalVariance > 0 ? '(สูงกว่าราคาอ้างอิง 🔺)' : totalVariance < 0 ? '(ต่ำกว่าราคาอ้างอิง 🟢)' : ''}
          </span>
        </div>
      )}

      <div className="overflow-x-auto max-h-[640px]">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-3 py-3"><SortBtn k="name" label="รายการ" /></th>
              <th className="px-3 py-3"><SortBtn k="cat" label="หมวด" /></th>
              <th className="px-3 py-3 text-center">หน่วย</th>
              <th className="px-3 py-3 text-right"><SortBtn k="qty" label="จำนวนรวม" className="justify-end w-full" /></th>
              <th className="px-3 py-3 text-right"><SortBtn k="unitRate" label="ราคา/หน่วย" className="justify-end w-full" /></th>
              <th className="px-3 py-3 text-right bg-amber-50/60">ราคาอ้างอิง/หน่วย</th>
              <th className="px-3 py-3 text-right bg-amber-50/60"><SortBtn k="variance" label="ส่วนต่างรวม" className="justify-end w-full" /></th>
              <th className="px-3 py-3 text-right"><SortBtn k="tot" label="รวมเป็นเงิน" className="justify-end w-full" /></th>
              <th className="px-3 py-3 text-center"><SortBtn k="buildings" label="อาคาร" className="justify-center w-full" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${keyOf(r)}#${i}`} className={`border-t border-border/40 hover:bg-muted/20 ${i % 2 ? 'bg-muted/[0.15]' : ''}`}>
                <td className="px-3 py-2 max-w-[280px]"><span className="font-medium" title={r.name}>{r.name}</span></td>
                <td className="px-3 py-2"><span className="text-xs text-muted-foreground">{r.cat.replace('งาน', '')}</span></td>
                <td className="px-3 py-2 text-center text-muted-foreground">{r.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt2(r.qty)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt2(r.unitRate)}</td>
                <td className="px-2 py-2 text-right bg-amber-50/40">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={refInput[keyOf(r)] ?? ''}
                    onChange={(e) => setRef(keyOf(r), e.target.value)}
                    placeholder="—"
                    className="w-24 text-right rounded-md border border-amber-300/60 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 tabular-nums"
                  />
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold bg-amber-50/40 ${r.varTot === null ? 'text-muted-foreground/40' : r.varTot > 0 ? 'text-red-600' : r.varTot < 0 ? 'text-emerald-600' : ''}`}>
                  {r.varTot === null ? '—' : `${r.varTot > 0 ? '+' : ''}${fmt2(r.varTot)}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt2(r.tot)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex items-center gap-1 ${r.buildings >= 2 ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
                    <Building2 className="w-3 h-3" />{r.buildings}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">ไม่พบรายการที่ตรงกับการค้นหา</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
