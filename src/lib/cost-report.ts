/**
 * cost-report.ts — สร้างรายงานคุมต้นทุน (CVR) เป็นไฟล์ Excel
 * เรียกฝั่ง client: generateCostReport(...) -> ArrayBuffer -> ดาวน์โหลด
 */
import ExcelJS from 'exceljs';
import {
  costTypeLabel, type CostControlData, type CostSummary, type CashflowSummary,
} from './cost-control';

const FONT = 'Tahoma';
const MONEY = '#,##0';
const PCT = '0.0"%"';
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
};
const NAVY = 'FF1E3A8A';
const RAG_FILL: Record<string, string> = {
  good: 'FFD1FAE5', warn: 'FFFEF3C7', bad: 'FFFEE2E2', none: 'FFF1F5F9',
};

function titleRow(ws: ExcelJS.Worksheet, r: number, text: string, span = 8) {
  ws.mergeCells(r, 1, r, span);
  const c = ws.getCell(r, 1);
  c.value = text;
  c.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: FONT };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(r).height = 26;
}

function headerRow(ws: ExcelJS.Worksheet, r: number, cols: string[]) {
  cols.forEach((h, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = h;
    c.font = { bold: true, size: 11, name: FONT };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FB' } };
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
  });
}

export interface CostReportInput {
  projectName: string;
  summary: CostSummary;
  cash: CashflowSummary;
  data: CostControlData;
}

export async function generateCostReport(input: CostReportInput): Promise<ArrayBuffer> {
  const { projectName, summary: s, cash, data } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BOQ Smart Summary Pro';

  // ===== ชีต 1: สรุปคุมต้นทุน =====
  const ov = wb.addWorksheet('สรุปคุมต้นทุน');
  ov.columns = [
    { width: 38 }, { width: 16 }, { width: 16 }, { width: 12 },
    { width: 16 }, { width: 10 }, { width: 16 }, { width: 16 },
  ];
  titleRow(ov, 1, `รายงานคุมต้นทุน (CVR) — ${projectName}`);
  ov.getCell(2, 1).value = `ณ วันที่ ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}`;
  ov.getCell(2, 1).font = { italic: true, size: 10, name: FONT };

  // KPI block
  const kpis: [string, number, string?][] = [
    ['มูลค่าสัญญาปัจจุบัน', s.contract],
    ['  • สัญญาเดิม', s.originalContract],
    ['  • งานเพิ่ม-ลด (VO) อนุมัติ', s.voApproved],
    ['งบต้นทุนเป้า', s.totalBudgetCost],
    ['จ่ายจริง (รวมผูกพัน)', s.totalActual],
    ['คาดต้นทุนจบงาน (EAC)', s.totalEAC],
    ['กำไรเป้าหมาย', s.targetProfit],
    ['กำไรคาดการณ์', s.forecastProfit],
    ['ผลต่างกำไร (คาด − เป้า)', s.profitVariance],
  ];
  let r = 4;
  kpis.forEach(([label, val]) => {
    ov.getCell(r, 1).value = label;
    ov.getCell(r, 1).font = { bold: !label.startsWith('  '), size: 11, name: FONT };
    const vc = ov.getCell(r, 2);
    vc.value = Math.round(val);
    vc.numFmt = MONEY;
    vc.font = { bold: true, size: 11, name: FONT, color: { argb: val < 0 ? 'FFDC2626' : 'FF111111' } };
    r += 1;
  });
  ov.getCell(4, 4).value = 'CPI';
  ov.getCell(4, 4).font = { bold: true, name: FONT };
  ov.getCell(4, 5).value = s.cpi ? Number(s.cpi.toFixed(2)) : '—';
  ov.getCell(5, 4).value = 'ความคืบหน้า';
  ov.getCell(5, 4).font = { bold: true, name: FONT };
  ov.getCell(5, 5).value = Number(s.overallProgressPct.toFixed(1));
  ov.getCell(5, 5).numFmt = PCT;

  // ตารางรายหมวด
  r += 1;
  titleRow(ov, r, 'คุมต้นทุนรายหมวด'); r += 1;
  const head = r;
  headerRow(ov, head, ['หมวด', 'มูลค่า BOQ', 'งบต้นทุน', '% คืบ', 'จ่ายจริง', 'CPI', 'คาดจบงาน', 'กำไรคาด']);
  r += 1;
  for (const c of s.categories) {
    const row = [
      c.category, Math.round(c.boq), Math.round(c.budgetCost), Number(c.progressPct.toFixed(0)),
      Math.round(c.actual), c.cpi ? Number(c.cpi.toFixed(2)) : '—', Math.round(c.eac), Math.round(c.forecastProfit),
    ];
    row.forEach((v, i) => {
      const cell = ov.getCell(r, i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 10, name: FONT };
      cell.border = BORDER;
      if ([2, 3, 5, 7, 8].includes(i + 1)) cell.numFmt = MONEY;
      if (i + 1 === 4) cell.numFmt = PCT;
    });
    ov.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAG_FILL[c.status] } };
    if (c.forecastProfit < 0) ov.getCell(r, 8).font = { size: 10, name: FONT, color: { argb: 'FFDC2626' }, bold: true };
    r += 1;
  }
  // grand
  const g = ['รวมทั้งโครงการ', Math.round(s.contract), Math.round(s.totalBudgetCost),
    Number(s.overallProgressPct.toFixed(0)), Math.round(s.totalActual),
    s.cpi ? Number(s.cpi.toFixed(2)) : '—', Math.round(s.totalEAC), Math.round(s.forecastProfit)];
  g.forEach((v, i) => {
    const cell = ov.getCell(r, i + 1);
    cell.value = v as ExcelJS.CellValue;
    cell.font = { bold: true, size: 11, name: FONT };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FB' } };
    cell.border = BORDER;
    if ([2, 3, 5, 7, 8].includes(i + 1)) cell.numFmt = MONEY;
    if (i + 1 === 4) cell.numFmt = PCT;
  });

  // ===== ชีต 2: รายจ่าย =====
  const ex = wb.addWorksheet('รายจ่ายจริง');
  ex.columns = [{ width: 12 }, { width: 30 }, { width: 14 }, { width: 20 }, { width: 16 }, { width: 12 }, { width: 24 }];
  titleRow(ex, 1, 'รายจ่ายจริง', 7);
  headerRow(ex, 2, ['วันที่', 'หมวด', 'ประเภท', 'ผู้ขาย', 'จำนวนเงิน', 'สถานะ', 'หมายเหตุ']);
  let er = 3;
  for (const e of [...data.entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const row = [e.date, e.category, costTypeLabel(e.type), e.vendor ?? '', Math.round(e.amount),
      e.status === 'paid' ? 'จ่ายแล้ว' : 'ผูกพัน', e.note ?? ''];
    row.forEach((v, i) => {
      const cell = ex.getCell(er, i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 10, name: FONT };
      cell.border = BORDER;
      if (i === 4) cell.numFmt = MONEY;
    });
    er += 1;
  }

  // ===== ชีต 3: VO =====
  if (data.vos.length > 0) {
    const vs = wb.addWorksheet('งานเพิ่ม-ลด (VO)');
    vs.columns = [{ width: 12 }, { width: 34 }, { width: 24 }, { width: 16 }, { width: 12 }];
    titleRow(vs, 1, 'งานเพิ่ม-ลด (VO)', 5);
    headerRow(vs, 2, ['วันที่', 'ชื่องาน', 'หมวด', 'มูลค่า', 'สถานะ']);
    let vr = 3;
    for (const v of data.vos) {
      const row = [v.date, v.title, v.category, Math.round(v.revenue), v.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'];
      row.forEach((val, i) => {
        const cell = vs.getCell(vr, i + 1);
        cell.value = val as ExcelJS.CellValue;
        cell.font = { size: 10, name: FONT };
        cell.border = BORDER;
        if (i === 3) cell.numFmt = MONEY;
      });
      vr += 1;
    }
  }

  // ===== ชีต 4: กระแสเงินสด =====
  const cf = wb.addWorksheet('กระแสเงินสด');
  cf.columns = [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  titleRow(cf, 1, 'กระแสเงินสด', 5);
  const cfKpis: [string, number][] = [
    ['รับสุทธิแล้ว', cash.receivedNet],
    ['เงินประกันถูกหัก', cash.retentionHeld],
    ['จ่ายออกแล้ว', cash.paidOut],
    ['เงินสดสุทธิ', cash.netCash],
    ['งวดค้างรับ', cash.pendingPayments],
  ];
  let cr = 2;
  cfKpis.forEach(([l, v]) => {
    cf.getCell(cr, 1).value = l;
    cf.getCell(cr, 1).font = { bold: true, size: 11, name: FONT };
    cf.getCell(cr, 2).value = Math.round(v);
    cf.getCell(cr, 2).numFmt = MONEY;
    cf.getCell(cr, 2).font = { size: 11, name: FONT, color: { argb: v < 0 ? 'FFDC2626' : 'FF111111' }, bold: true };
    cr += 1;
  });
  cr += 1;
  headerRow(cf, cr, ['เดือน', 'เงินเข้า', 'เงินออก', 'สุทธิ', 'สะสม']);
  cr += 1;
  for (const m of cash.months) {
    const row = [m.month, Math.round(m.cashIn), Math.round(m.cashOut), Math.round(m.net), Math.round(m.cumulative)];
    row.forEach((v, i) => {
      const cell = cf.getCell(cr, i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 10, name: FONT, color: { argb: (i === 4 && m.cumulative < 0) ? 'FFDC2626' : 'FF111111' } };
      cell.border = BORDER;
      if (i >= 1) cell.numFmt = MONEY;
    });
    cr += 1;
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
