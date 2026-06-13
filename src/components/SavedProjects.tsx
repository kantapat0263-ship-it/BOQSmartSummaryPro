"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FolderOpen, Trash2, Clock, Cloud, HardDrive, Search, ChevronDown, ArrowUpDown } from 'lucide-react';
import { listProjects, deleteProject, storageMode, type SavedProject } from '@/lib/project-store';

interface SavedProjectsProps {
  onOpen: (project: SavedProject) => void;
  reloadKey: number;
}

type SortKey = 'date' | 'grand' | 'name';
const LIMIT = 6;
const fmt0 = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export function SavedProjects({ onOpen, reloadKey }: SavedProjectsProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'cloud' | 'local'>('local');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [showAll, setShowAll] = useState(false);

  const reload = useCallback(() => {
    storageMode().then(setMode).catch(() => {});
    listProjects().then((p) => { setProjects(p); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => { reload(); }, [reload, reloadKey]);

  const handleDelete = async (id: string) => { await deleteProject(id); reload(); };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = projects.filter((p) => p.name.toLowerCase().includes(needle));
    return list.sort((a, b) =>
      sort === 'grand' ? b.grand - a.grand
        : sort === 'name' ? a.name.localeCompare(b.name, 'th')
          : b.savedAt - a.savedAt,
    );
  }, [projects, q, sort]);

  if (!loaded || projects.length === 0) return null;

  const shown = showAll ? filtered : filtered.slice(0, LIMIT);

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl mb-12">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${mode === 'cloud' ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
            {mode === 'cloud' ? <Cloud className="w-6 h-6 text-emerald-600" /> : <HardDrive className="w-6 h-6 text-primary" />}
          </div>
          <div>
            <h3 className="text-xl font-black text-primary">โครงการที่บันทึกไว้</h3>
            <p className="text-xs text-muted-foreground font-medium">
              {mode === 'cloud' ? '☁️ บนคลาวด์ (บัญชีคุณ)' : '💻 เก็บในเครื่องนี้'} • {projects.length} โครงการ
            </p>
          </div>
        </div>
        {/* search + sort */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="ค้นหาชื่อโครงการ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
            />
          </div>
          <button
            onClick={() => setSort((s) => (s === 'date' ? 'grand' : s === 'grand' ? 'name' : 'date'))}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-3 py-2"
            title="สลับการเรียง"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sort === 'date' ? 'ล่าสุด' : sort === 'grand' ? 'มูลค่า' : 'ชื่อ'}
          </button>
        </div>
      </div>

      {/* list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shown.map((p) => (
          <div key={p.id} className="group flex items-center justify-between gap-3 border border-border/60 rounded-2xl p-4 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors">
            <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left">
              <p className="font-bold text-primary truncate" title={p.name}>{p.name}</p>
              <p className="text-sm font-black text-secondary">฿{fmt0(p.grand)}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> {fmtDate(p.savedAt)}
              </p>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onOpen(p)} className="p-2.5 rounded-xl text-primary hover:bg-primary/10 transition-colors" title="เปิดโครงการ">
                <FolderOpen className="w-5 h-5" />
              </button>
              <button onClick={() => handleDelete(p.id)} className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="ลบ">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-6">ไม่พบโครงการที่ตรงกับการค้นหา</p>
        )}
      </div>

      {/* ดูทั้งหมด */}
      {!showAll && filtered.length > LIMIT && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-xl py-2.5 border border-border/60"
        >
          <ChevronDown className="w-4 h-4" /> ดูทั้งหมด ({filtered.length} โครงการ)
        </button>
      )}
    </div>
  );
}
