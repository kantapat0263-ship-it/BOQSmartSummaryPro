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

/** งวดงานที่เรียกเก็บจากเจ้าของงาน (เงินเข้า) */
export interface PaymentMilestone {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd (วันที่คาดรับ/รับจริง)
  amount: number; // มูลค่างวด (ก่อนหักเงินประกัน)
  received: boolean; // รับเงินแล้วหรือยัง
}

/** ความคืบหน้ารวมของโครงการ ณ สิ้นเดือน (สำหรับ S-curve) */
export interface ProgressSnapshot {
  month: string; // YYYY-MM
  pct: number; // % ความคืบหน้ารวม (0..100)
}

/** ข้อมูลคุมต้นทุนทั้งหมดของ 1 โครงการ (เก็บเป็นก้อนเดียว) */
export interface CostControlData {
  projectId: string;
  targetProfitPct: number; // กำไรเป้าหมาย % (เช่น 15)
  overheadBudget: number; // งบค่าโสหุ้ยสนามที่ตั้งไว้
  retentionPct: number; // เงินประกันผลงานที่เจ้าของหักต่องวด %
  progress: Record<string, number>; // หมวด -> % ความคืบหน้า (0..100)
  entries: CostEntry[];
  vos: VariationOrder[];
  payments: PaymentMilestone[];
  progressHistory: ProgressSnapshot[];
  updatedAt: number;
}

export function emptyCostControl(projectId: string): CostControlData {
  return {
    projectId, targetProfitPct: 15, overheadBudget: 0, retentionPct: 0,
    progress: {}, entries: [], vos: [], payments: [], progressHistory: [], updatedAt: Date.now(),
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

// ---------- กระแสเงินสด (Cash Flow) ----------
export interface CashMonth {
  month: string; // YYYY-MM
  cashIn: number; // รับสุทธิ (หลังหักเงินประกัน)
  cashOut: number; // จ่ายจริง
  net: number;
  cumulative: number; // ยอดสะสม (running balance)
}

export interface CashflowSummary {
  receivedGross: number; // งวดที่รับแล้ว (ก่อนหัก)
  retentionHeld: number; // เงินประกันถูกหักสะสม
  receivedNet: number; // รับสุทธิ
  pendingPayments: number; // งวดที่ยังไม่รับ
  paidOut: number; // จ่ายออกแล้ว (สถานะจ่ายแล้ว)
  committedOut: number; // ผูกพันรอจ่าย
  netCash: number; // receivedNet − paidOut
  months: CashMonth[];
  minCumulative: number; // จุดต่ำสุดของยอดสะสม (ติดลบ = เงินขาดมือ)
}

const monthOf = (d: string): string => (d || '').slice(0, 7) || 'ไม่ระบุ';

export function computeCashflow(data: CostControlData): CashflowSummary {
  const ret = Math.min(100, Math.max(0, data.retentionPct || 0)) / 100;

  let receivedGross = 0;
  let pendingPayments = 0;
  const inByMonth = new Map<string, number>();
  for (const p of data.payments ?? []) {
    const amt = Number(p.amount) || 0;
    if (p.received) {
      receivedGross += amt;
      const net = amt * (1 - ret);
      inByMonth.set(monthOf(p.date), (inByMonth.get(monthOf(p.date)) ?? 0) + net);
    } else {
      pendingPayments += amt;
    }
  }
  const retentionHeld = receivedGross * ret;
  const receivedNet = receivedGross - retentionHeld;

  let paidOut = 0;
  let committedOut = 0;
  const outByMonth = new Map<string, number>();
  for (const e of data.entries ?? []) {
    const amt = Number(e.amount) || 0;
    if (e.status === 'committed') { committedOut += amt; continue; }
    paidOut += amt;
    outByMonth.set(monthOf(e.date), (outByMonth.get(monthOf(e.date)) ?? 0) + amt);
  }

  const allMonths = Array.from(new Set([...inByMonth.keys(), ...outByMonth.keys()]))
    .filter((m) => m !== 'ไม่ระบุ')
    .sort();
  let cumulative = 0;
  let minCumulative = 0;
  const months: CashMonth[] = allMonths.map((month) => {
    const cashIn = inByMonth.get(month) ?? 0;
    const cashOut = outByMonth.get(month) ?? 0;
    const net = cashIn - cashOut;
    cumulative += net;
    if (cumulative < minCumulative) minCumulative = cumulative;
    return { month, cashIn, cashOut, net, cumulative };
  });

  return {
    receivedGross, retentionHeld, receivedNet, pendingPayments,
    paidOut, committedOut, netCash: receivedNet - paidOut,
    months, minCumulative,
  };
}

// ---------- S-curve (เนื้องานสะสม vs ต้นทุนจ่ายสะสม) ----------
export interface SCurvePoint {
  month: string; // YYYY-MM
  earnedCum: number; // มูลค่าเนื้องานสะสม (EV)
  costCum: number; // ต้นทุนจ่ายจริงสะสม (AC)
}

export function computeSCurve(data: CostControlData, totalBudgetCost: number): SCurvePoint[] {
  // ต้นทุนจ่ายสะสมรายเดือน (เฉพาะสถานะจ่ายแล้ว)
  const costByMonth = new Map<string, number>();
  for (const e of data.entries ?? []) {
    if (e.status === 'committed') continue;
    const m = monthOf(e.date);
    costByMonth.set(m, (costByMonth.get(m) ?? 0) + (Number(e.amount) || 0));
  }
  // ความคืบหน้ารวม ณ สิ้นเดือน (เรียงตามเดือน)
  const hist = [...(data.progressHistory ?? [])]
    .filter((h) => h.month)
    .sort((a, b) => a.month.localeCompare(b.month));

  const months = Array.from(new Set([
    ...costByMonth.keys(),
    ...hist.map((h) => h.month),
  ])).filter((m) => m && m !== 'ไม่ระบุ').sort();

  let costCum = 0;
  let lastPct = 0;
  let hi = 0;
  return months.map((month) => {
    costCum += costByMonth.get(month) ?? 0;
    while (hi < hist.length && hist[hi].month <= month) {
      lastPct = Math.min(100, Math.max(0, hist[hi].pct || 0));
      hi += 1;
    }
    return { month, earnedCum: (lastPct / 100) * totalBudgetCost, costCum };
  });
}
