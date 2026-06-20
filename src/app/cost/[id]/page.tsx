"use client"

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, ArrowLeft, FileWarning } from 'lucide-react';
import { getProject, storageMode } from '@/lib/project-store';
import { loadCostControl } from '@/lib/cost-control-store';
import { CostControlView } from '@/components/cost/CostControlView';
import type { CostControlData, BudgetCat } from '@/lib/cost-control';

interface SummaryRow { cat: string; tot: number }
interface ResultShape { summary?: SummaryRow[]; grand?: number }

type State =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | {
      kind: 'ready';
      name: string;
      grand: number;
      budgetCats: BudgetCat[];
      initial: CostControlData;
      mode: 'cloud' | 'local';
    };

export default function CostControlPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [project, mode] = await Promise.all([getProject(id), storageMode()]);
        if (!alive) return;
        if (!project) { setState({ kind: 'notfound' }); return; }
        const result = (project.result ?? {}) as ResultShape;
        const budgetCats: BudgetCat[] = (result.summary ?? [])
          .filter((s) => s && s.cat)
          .map((s) => ({ category: s.cat, boq: Number(s.tot) || 0 }));
        const initial = await loadCostControl(id);
        if (!alive) return;
        setState({
          kind: 'ready',
          name: project.name,
          grand: project.grand || result.grand || budgetCats.reduce((a, b) => a + b.boq, 0),
          budgetCats,
          initial,
          mode,
        });
      } catch {
        if (alive) setState({ kind: 'notfound' });
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="font-bold">กำลังโหลดข้อมูลคุมต้นทุน…</p>
      </div>
    );
  }

  if (state.kind === 'notfound') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <FileWarning className="w-14 h-14 text-muted-foreground" />
        <h1 className="text-2xl font-black text-primary">ไม่พบโครงการนี้</h1>
        <p className="text-muted-foreground font-medium max-w-md">
          ต้อง “บันทึกโครงการ” ก่อน ถึงจะคุมต้นทุนได้ — และต้องเปิดด้วยบัญชี/เครื่องเดียวกับที่บันทึกไว้
        </p>
        <Link href="/" className="inline-flex items-center gap-2 bg-primary text-white rounded-2xl px-6 py-3 font-black mt-2">
          <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <CostControlView
      projectId={id}
      projectName={state.name}
      grand={state.grand}
      budgetCats={state.budgetCats}
      initial={state.initial}
      mode={state.mode}
    />
  );
}
