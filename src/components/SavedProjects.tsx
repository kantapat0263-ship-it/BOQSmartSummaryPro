"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { FolderOpen, Trash2, Clock, Database } from 'lucide-react';
import { listProjects, deleteProject, type SavedProject } from '@/lib/project-store';

interface SavedProjectsProps {
  onOpen: (project: SavedProject) => void;
  reloadKey: number;
}

const fmt0 = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export function SavedProjects({ onOpen, reloadKey }: SavedProjectsProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    listProjects().then((p) => { setProjects(p); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => { reload(); }, [reload, reloadKey]);

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    reload();
  };

  if (!loaded || projects.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-2xl">
          <Database className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-black text-primary">โครงการที่บันทึกไว้</h3>
          <p className="text-xs text-muted-foreground font-medium">เก็บในเครื่องนี้ • {projects.length} โครงการ</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div key={p.id} className="group flex items-center justify-between gap-3 border border-border/60 rounded-2xl p-4 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors">
            <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left">
              <p className="font-bold text-primary truncate" title={p.name}>{p.name}</p>
              <p className="text-sm font-black text-secondary">฿{fmt0(p.grand)}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> {fmtDate(p.savedAt)}
              </p>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onOpen(p)}
                className="p-2.5 rounded-xl text-primary hover:bg-primary/10 transition-colors"
                title="เปิดโครงการ"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="ลบ"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
