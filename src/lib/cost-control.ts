/**
 * cost-control.ts — เครื่องคำนวณคุมต้นทุน (pure functions, ไม่มี side-effect)
 *
 * แนวคิด: เทียบ "งบต้นทุนเป้า" (จาก BOQ × กำไรเป้า) กับ "จ่ายจริง + ความคืบหน้า"
 * แล้วพยากรณ์ว่าสุดท้ายโครงการจะ "กำไร/ขาดทุน" เท่าไหร่ (ดาวเหนือ = กำไรคาดการณ์)
 */

// ประเภทต้นทุน
export type CostType = 'M' | 'L' | 'S' | 'E' | 'OH';
export const COST_TYPES: { value: CostType; label: string }[] = [
  { value: 'M', label: 'วัสดุ' },
  { value: 'L', label: 'ค่าแรง' },
  { value: 'S', label: 'ผู้รับเหมาช่วง' },
  { value: 'E', label: 'เครื่องจักร' },
  { value: 'OH', label: 'ค่าโสหุ้ย' },
];
export const costTypeLabel = (t: CostType): string =>
  COST_TYPES.find((c) => c.value === t)?.label ?? t;

// สถานะรายจ่าย: จ่ายแล้ว / ผูกพัน (PO ยังไม่จ่าย)
export type EntryStatus = 'paid' | 'committed';

export interface CostEntry {
  id: string;
  date: string; // yyyy-mm-dd
  category: string; // ชื่อหมวด (ตรงกับหมวดใน BOQ)
  type: CostType;
  vendor?: string;
  amount: number;
  status: EntryStatus;
  note?: string;
}

/** หมวดสำหรับค่าโสหุ้ยสนาม (ต้นทุนทางอ้อม ไม่ผูกหมวดงาน) */
export const OVERHEAD_CAT = 'ค่าโสหุ้ยสนาม';

/** งานเพิ่ม-ลด (Variation Order): เปลี่ยนทั้งรายได้และงบของหมวด */
export interface VariationOrder {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  category: string; // เพิ่มเข้าหมวดไหน
  revenue: number; // มูลค่าที่เพิ่ม (ติดลบได้ = งานลด)
  approved: boolean; // อนุมัติแล้ว -> นับเข้าสัญญา
  note?: string;
}

/** ข้อมูลคุมต้นทุนทั้งหมดของ 1 โครงการ (เก็บเป็นก้อนเดียว) */
export interface CostControlData {
  projectId: string;
  targetProfitPct: number; // กำไรเป้าหมาย % (เช่น 15)
  overheadBudget: number; // งบค่าโสหุ้ยสนามที่ตั้งไว้
  progress: Record<string, number>; // หมวด -> % ความคืบหน้า (0..100)
  entries: CostEntry[];
  vos: VariationOrder[];
  updatedAt: number;
}

export function emptyCostControl(projectId: string): CostControlData {
  return {
    projectId, targetProfitPct: 15, overheadBudget: 0,
    progress: {}, entries: [], vos: [], updatedAt: Date.now(),
  };
}

export type RAG = 'good' | 'warn' | 'bad' | 'none';

export interface CategoryCost {
  category: string;
  boq: number; // มูลค่า BOQ (ราคาขาย)
  budgetCost: number; // งบต้นทุนเป้า = boq × (1 − กำไรเป้า%)
  progressPct: number;
  earned: number; // EV = %คืบ × งบต้นทุน
  paid: number;
  committed: number;
  actual: number; // paid + committed
  cv: number; // EV − actual
  cpi: number | null; // EV / actual
  eac: number; // คาดต้นทุนจบงาน
  forecastProfit: number; // boq − eac
  inBudget: boolean; // หมวดนี้มีใน BOQ ไหม (false = รายจ่ายนอกงบ)
  status: RAG;
}

export interface CostSummary {
  contract: number; // มูลค่าสัญญาปัจจุบัน = Σ BOQ + VO อนุมัติ
  originalContract: number; // มูลค่าสัญญาเดิม (จาก BOQ)
  voApproved: number; // VO ที่อนุมัติแล้ว
  voPending: number; // VO ที่รออนุมัติ
  overheadBudget: number;
  totalBudgetCost: number;
  targetProfit: number; // contract − งบต้นทุน
  targetProfitPct: number;
  paid: number;
  committed: number;
  totalActual: number;
  totalEarned: number;
  totalEAC: number;
  forecastProfit: number; // contract − Σ EAC  ← ดาวเหนือ
  forecastProfitPct: number;
  profitVariance: number; // forecastProfit − targetProfit
  overallProgressPct: number; // ถ่วงน้ำหนักด้วยงบ
  cpi: number | null;
  status: RAG;
  categories: CategoryCost[];
}

function ragByCostRatio(ratio: number, hasData: boolean): RAG {
  if (!hasData) return 'none';
  if (ratio <= 1.02) return 'good';
  if (ratio <= 1.1) return 'warn';
  return 'bad';
}

export interface BudgetCat {
  category: string;
  boq: number;
}

/**
 * คำนวณภาพรวมคุมต้นทุน
 * @param budgetCats หมวดจาก BOQ (ชื่อหมวด + ยอด)
 * @param data       ข้อมูลที่กรอก (กำไรเป้า, ความคืบหน้า, รายจ่าย)
 */
export function computeCostSummary(budgetCats: BudgetCat[], data: CostControlData): CostSummary {
  const pct = Math.min(99.9, Math.max(0, data.targetProfitPct)) / 100;

  // รวมรายจ่ายต่อหมวด
  const paidBy = new Map<string, number>();
  const commitBy = new Map<string, number>();
  for (const e of data.entries) {
    const m = e.status === 'committed' ? commitBy : paidBy;
    m.set(e.category, (m.get(e.category) ?? 0) + (Number(e.amount) || 0));
  }

  // เริ่มจากหมวดใน BOQ
  const order: string[] = [];
  const boqMap = new Map<string, number>();
  const originalContract = budgetCats.reduce((s, b) => s + b.boq, 0);
  for (const b of budgetCats) {
    if (!boqMap.has(b.category)) order.push(b.category);
    boqMap.set(b.category, (boqMap.get(b.category) ?? 0) + b.boq);
  }
  // งานเพิ่ม-ลด (VO): อนุมัติแล้ว -> เพิ่มรายได้+งบเข้าหมวด
  let voApproved = 0;
  let voPending = 0;
  for (const v of data.vos ?? []) {
    const amt = Number(v.revenue) || 0;
    if (v.approved) {
      voApproved += amt;
      if (!boqMap.has(v.category)) order.push(v.category);
      boqMap.set(v.category, (boqMap.get(v.category) ?? 0) + amt);
    } else {
      voPending += amt;
    }
  }
  // เติมหมวดที่มีรายจ่ายแต่ไม่อยู่ใน BOQ/VO (รายจ่ายนอกงบ) ยกเว้นค่าโสหุ้ย (จัดการแยก)
  for (const c of new Set([...paidBy.keys(), ...commitBy.keys()])) {
    if (c !== OVERHEAD_CAT && !boqMap.has(c)) {
      order.push(c);
      boqMap.set(c, 0);
    }
  }

  const calcCat = (category: string, boq: number, budgetCost: number, progressPct: number): CategoryCost => {
    const inBudget = boq > 0;
    const earned = (budgetCost * progressPct) / 100;
    const paid = paidBy.get(category) ?? 0;
    const committed = commitBy.get(category) ?? 0;
    const actual = paid + committed;
    const cv = earned - actual;
    const cpi = actual > 0 ? earned / actual : null;
    let eac: number;
    if (actual <= 0 && progressPct <= 0) eac = budgetCost;
    else if (progressPct > 0 && cpi && cpi > 0) eac = budgetCost / cpi;
    else eac = Math.max(budgetCost, actual);
    const forecastProfit = boq - eac;
    const ratio = budgetCost > 0 ? eac / budgetCost : actual > 0 ? Infinity : 1;
    const status = ragByCostRatio(ratio, actual > 0 || progressPct > 0);
    return { category, boq, budgetCost, progressPct, earned, paid, committed, actual, cv, cpi, eac, forecastProfit, inBudget, status };
  };

  const categories: CategoryCost[] = order.map((category) => {
    const boq = boqMap.get(category) ?? 0;
    const progressPct = Math.min(100, Math.max(0, data.progress[category] ?? 0));
    return calcCat(category, boq, boq * (1 - pct), progressPct);
  });

  // ค่าโสหุ้ยสนาม: งบ = overheadBudget, ไม่มีรายได้, ใช้ %คืบหน้ารวมของงานเป็นตัวฉาย EAC
  const overheadBudget = Math.max(0, Number(data.overheadBudget) || 0);
  const overheadActual = (paidBy.get(OVERHEAD_CAT) ?? 0) + (commitBy.get(OVERHEAD_CAT) ?? 0);
  if (overheadBudget > 0 || overheadActual > 0) {
    const workBudget = categories.reduce((s, c) => s + c.budgetCost, 0);
    const workEarned = categories.reduce((s, c) => s + c.earned, 0);
    const ohProgress = workBudget > 0 ? Math.min(100, (workEarned / workBudget) * 100) : 0;
    categories.push(calcCat(OVERHEAD_CAT, 0, overheadBudget, ohProgress));
  }

  const contract = categories.reduce((s, c) => s + c.boq, 0);
  const totalBudgetCost = categories.reduce((s, c) => s + c.budgetCost, 0);
  const paid = categories.reduce((s, c) => s + c.paid, 0);
  const committed = categories.reduce((s, c) => s + c.committed, 0);
  const totalActual = paid + committed;
  const totalEarned = categories.reduce((s, c) => s + c.earned, 0);
  const totalEAC = categories.reduce((s, c) => s + c.eac, 0);
  const targetProfit = contract - totalBudgetCost;
  const forecastProfit = contract - totalEAC;
  const forecastProfitPct = contract > 0 ? (forecastProfit / contract) * 100 : 0;
  const profitVariance = forecastProfit - targetProfit;
  const overallProgressPct = totalBudgetCost > 0 ? (totalEarned / totalBudgetCost) * 100 : 0;
  const cpi = totalActual > 0 ? totalEarned / totalActual : null;

  let status: RAG = 'none';
  if (totalActual > 0 || totalEarned > 0) {
    if (forecastProfit < 0 || forecastProfit < targetProfit * 0.9) status = 'bad';
    else if (forecastProfit < targetProfit * 0.99) status = 'warn';
    else status = 'good';
  }

  return {
    contract, originalContract, voApproved, voPending, overheadBudget,
    totalBudgetCost, targetProfit, targetProfitPct: data.targetProfitPct,
    paid, committed, totalActual, totalEarned, totalEAC,
    forecastProfit, forecastProfitPct, profitVariance, overallProgressPct, cpi, status,
    categories,
  };
}
