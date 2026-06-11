/**
 * boq-processor.ts — TypeScript port of boq_report.py (COST CONTROL)
 * -----------------------------------------------------------------
 * Reads a BOQ (.xlsx) workbook, extracts material/work line-items from every
 * sub-sheet, collapses duplicate items used across multiple buildings into a
 * single row (tracking how many buildings use each), and splits them by work
 * category. This mirrors the original openpyxl script 1:1 so the web app
 * produces the same numbers as the desktop tool.
 */

import type ExcelJS from 'exceljs';

// ขึ้นต้นไฟล์ผลลัพธ์ (กันสแกนซ้ำตัวเอง)
export const OUT_PREFIX = '[สรุปวัสดุ] ';
// ชีตที่ไม่ใช่ตารางวัสดุ
const SKIP_SHEET_KEYWORDS = ['สรุป', 'ค่าดำเนินการ', 'cover', 'ปก'];
// รหัสหมวดหลัก X.Y.Z (เช่น 5.2.3)
const SECTION_CODE = /^\d+\.\d+\.\d+/;

// ---------- นิยามหมวดงาน (order -> ชื่อเต็ม, ชื่อแท็บชีต) ----------
// order เป็นทั้งลำดับการแสดงผลและคีย์ภายใน
export const CATS: Record<number, [string, string]> = {
  1: ['งานโครงสร้างและฐานราก-ตอม่อ', '1.โครงสร้าง-ฐานราก'],
  2: ['งานสถาปัตยกรรม', '2.สถาปัตยกรรม'],
  3: ['งานหลังคา', '3.หลังคา'],
  4: ['งานระบบปรับอากาศและพัดลมระบายอากาศ', '4.ปรับอากาศ-ระบายอากาศ'],
  5: ['งานไฟฟ้าแสงสว่างและเต้ารับ', '5.ไฟฟ้า-เต้ารับ'],
  6: ['งานรื้อถอน', '6.รื้อถอน'],
  7: ['งานถนน', '7.ถนน'],
  8: ['งานรั้ว-ประตู-ป้าย', '8.รั้ว-ประตู-ป้าย'],
  9: ['งานระบายน้ำ', '9.ระบายน้ำ'],
  10: ['งานภูมิทัศน์', '10.ภูมิทัศน์'],
  11: ['งานดิน-ป้องกันดินพัง', '11.งานดิน-ป้องกันดินพัง'],
  12: ['งานเจาะสำรวจชั้นดิน', '12.เจาะสำรวจชั้นดิน'],
  99: ['งานอื่นๆ', '99.อื่นๆ'],
};

/** แมปชื่อหัวข้อหมวด (X.Y.Z) -> เลขหมวดหลัก (first-match wins) */
export function categorize(sectionName: unknown): number {
  const s = String(sectionName).replace(/\s+/g, ' ').trim();
  if (s.includes('รื้อถอน')) return 6;
  if (s.includes('ปรับอากาศ') || s.includes('พัดลมระบาย')) return 4;
  if (s.includes('ไฟฟ้า') || s.includes('แสงสว่าง') || s.includes('เต้ารับ')) return 5;
  if (s.includes('หลังคา')) return 3;
  if (s.includes('สถาปัตยกรรม')) return 2;
  if (s.includes('โครงสร้าง') || s.includes('ฐานราก') || s.includes('ตอม่อ')) return 1;
  if (s.includes('ถนน')) return 7;
  if (s.includes('รั้ว') || s.includes('ป้าย')) return 8;
  if (s.includes('ระบายน้ำ')) return 9;
  if (s.includes('ภูมิทัศน์')) return 10;
  if (s.includes('เจาะสำรวจ') || s.includes('ทดสอบ')) return 12;
  if (s.includes('ขุด') || s.includes('ถม') || s.includes('ปรับระดับดิน') || s.includes('ป้องกันดินพัง')) return 11;
  return 99;
}

// ---------- helpers ----------

/**
 * Extract the effective value of an ExcelJS cell, mirroring openpyxl's
 * `data_only=True` (cached formula results, plain rich text, etc.).
 */
function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    const o = v as Record<string, unknown>;
    if ('result' in o) return o.result ?? null; // formula -> cached result
    if ('error' in o) return null; // error cell
    if ('richText' in o) {
      return (o.richText as Array<{ text: string }>).map((t) => t.text).join('');
    }
    if ('text' in o) return o.text; // hyperlink
    return null;
  }
  return v;
}

/** แปลงเป็นตัวเลข; ถ้าเป็นข้อความ (เช่น 'ไม่รวม') คืน 0 */
function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/**
 * Normalize อัจฉริยะ เพื่อจับ "ของซ้ำ"
 * - ตัด bullet/ขีดนำหน้า, ยุบช่องว่าง, 'dia.'='dia'='Ø', ตัวอังกฤษพิมพ์เล็ก
 * - *ไม่* แตะตัวเลข/ขนาด -> dia 16 กับ dia 20 ยังแยกกัน
 */
export function normKey(name: unknown): string {
  let s = String(name).trim();
  s = s.replace(/^[\s\-–•·.]+/, '');
  s = s.replace(/Ø/g, 'dia').replace(/ø/g, 'dia').replace(/Φ/g, 'dia').replace(/φ/g, 'dia');
  s = s.replace(/\bdia\b\.?/gi, 'dia');
  s = s.replace(/\bdia\./gi, 'dia');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

/** ชื่อสำหรับแสดงผล: ตัดขีดนำหน้า + ยุบช่องว่าง (คงตัวพิมพ์เดิม) */
export function cleanName(desc: unknown): string {
  return String(desc).trim().replace(/^[\s\-–•·]+/, '').replace(/\s+/g, ' ');
}

export interface HeaderCols {
  desc: number;
  unit: number;
  qty: number;
  mat_total: number;
  lab_total: number;
  grand: number;
  header_row: number;
}

/** หาแถวหัวตาราง + ตำแหน่งคอลัมน์ (BOQ มาตรฐาน กปภ.) หรือ null */
export function findHeader(ws: ExcelJS.Worksheet): HeaderCols | null {
  const maxRow = Math.min(ws.rowCount, 15);
  const maxCol = Math.min(ws.columnCount, 15);
  for (let r = 1; r <= maxRow; r++) {
    const rowtext: Array<[number, string]> = [];
    for (let c = 1; c <= maxCol; c++) {
      const v = cellValue(ws.getCell(r, c));
      if (v !== null && v !== undefined) rowtext.push([c, String(v).trim()]);
    }
    const joined = rowtext.map(([, t]) => t).join(' ');
    if (joined.includes('ลำดับ') && joined.includes('รายการ') && joined.includes('หน่วย')) {
      const col: Partial<HeaderCols> = {};
      for (const [c, t] of rowtext) {
        if (t === 'รายการ' && col.desc === undefined) col.desc = c;
        else if (t === 'หน่วย') col.unit = c;
        else if (t === 'จำนวน') col.qty = c;
        else if (t.includes('ค่าวัสดุ')) col.mat_total = c + 1;
        else if (t.includes('ค่าแรง')) col.lab_total = c + 1;
        else if (t.includes('รวมเป็นเงิน')) col.grand = c;
      }
      if (col.desc !== undefined && col.unit !== undefined && col.qty !== undefined) {
        col.mat_total ??= 6;
        col.lab_total ??= 8;
        col.grand ??= 9;
        col.header_row = r;
        return col as HeaderCols;
      }
    }
  }
  return null;
}

// ---------- core ----------
export interface Item {
  name: string;
  unit: string;
  qty: number;
  mat: number;
  lab: number;
  tot: number;
  sheets: Set<string>;
}

function blankItem(name: string, unit: string): Item {
  return { name, unit, qty: 0, mat: 0, lab: 0, tot: 0, sheets: new Set() };
}

export interface ExtractMeta {
  src: string;
  raw_lines: number;
  sheets: string[];
  byCat: Map<number, Map<string, Item>>;
  sectionsSeen: Map<number, Set<string>>;
}

/** อ่าน 1 ไฟล์ -> โครงสร้างที่ยุบซ้ำแล้ว แยกตามหมวด */
export function extract(wb: ExcelJS.Workbook, src: string): ExtractMeta {
  const byCat = new Map<number, Map<string, Item>>();
  const sectionsSeen = new Map<number, Set<string>>();
  let rawLines = 0;
  const usedSheets: string[] = [];

  wb.eachSheet((ws) => {
    const title = ws.name;
    if (SKIP_SHEET_KEYWORDS.some((k) => title.toLowerCase().includes(k.toLowerCase()))) return;
    const col = findHeader(ws);
    if (!col) return;
    usedSheets.push(title);
    const sheetTag = title.trim().split(/\s+/)[0] || title;
    let curCat = 99; // ก่อนเจอหมวดแรก -> อื่นๆ

    for (let r = col.header_row + 1; r <= ws.rowCount; r++) {
      const c1 = col.desc > 1 ? cellValue(ws.getCell(r, col.desc - 1)) : cellValue(ws.getCell(r, 1));
      const desc = cellValue(ws.getCell(r, col.desc));
      const unit = cellValue(ws.getCell(r, col.unit));
      const qty = cellValue(ws.getCell(r, col.qty));

      // แถวหัวข้อหมวดหลัก X.Y.Z -> เปลี่ยนหมวดปัจจุบัน
      if (typeof c1 === 'string' && SECTION_CODE.test(c1.trim()) && desc) {
        curCat = categorize(desc);
        if (!sectionsSeen.has(curCat)) sectionsSeen.set(curCat, new Set());
        sectionsSeen.get(curCat)!.add(String(desc).replace(/\s+/g, ' ').trim());
        continue;
      }

      // คัดเฉพาะ "บรรทัดของจริง"
      if (!desc || !unit) continue;
      if (typeof qty !== 'number' || qty === 0) continue;
      if (String(desc).trim().startsWith('รวม')) continue;

      const mat = num(cellValue(ws.getCell(r, col.mat_total)));
      const lab = num(cellValue(ws.getCell(r, col.lab_total)));
      const tot = num(cellValue(ws.getCell(r, col.grand))) || mat + lab;
      const unitS = String(unit).trim();
      const key = `${normKey(desc)} ${unitS.toLowerCase()}`;
      rawLines += 1;

      if (!byCat.has(curCat)) byCat.set(curCat, new Map());
      const bucket = byCat.get(curCat)!;
      let it = bucket.get(key);
      if (!it) {
        it = blankItem(cleanName(desc), unitS);
        bucket.set(key, it);
      }
      it.qty += qty;
      it.mat += mat;
      it.lab += lab;
      it.tot += tot;
      it.sheets.add(sheetTag);
    }
  });

  return { src, raw_lines: rawLines, sheets: usedSheets, byCat, sectionsSeen };
}

// ---------- report data (totals / global merge) ----------
export interface CatTotal {
  mat: number;
  lab: number;
  tot: number;
  count: number;
}

export interface ReportData {
  meta: ExtractMeta;
  catTotals: Map<number, CatTotal>;
  grand: number;
  globalItems: Map<string, Item>;
}

export function buildReportData(meta: ExtractMeta): ReportData {
  const catTotals = new Map<number, CatTotal>();
  let grand = 0;
  for (const [order, bucket] of meta.byCat) {
    let mat = 0;
    let lab = 0;
    let tot = 0;
    for (const i of bucket.values()) {
      mat += i.mat;
      lab += i.lab;
      tot += i.tot;
    }
    catTotals.set(order, { mat, lab, tot, count: bucket.size });
    grand += tot;
  }

  // รวมทุกหมวด (global) — รวมซ้ำข้ามหมวด
  const globalItems = new Map<string, Item>();
  for (const bucket of meta.byCat.values()) {
    for (const [key, it] of bucket) {
      let g = globalItems.get(key);
      if (!g) {
        g = blankItem(it.name, it.unit);
        globalItems.set(key, g);
      }
      g.qty += it.qty;
      g.mat += it.mat;
      g.lab += it.lab;
      g.tot += it.tot;
      for (const s of it.sheets) g.sheets.add(s);
    }
  }

  return { meta, catTotals, grand, globalItems };
}

/** เรียงตามยอดเงินมากสุด */
export function itemsToRows(bucket: Map<string, Item>): Item[] {
  return [...bucket.values()].sort((a, b) => b.tot - a.tot);
}

// ---------- JSON summary for the dashboard ----------
export interface SummaryRow {
  cat: string;
  count: number;
  mat: number;
  lab: number;
  tot: number;
  pct: number;
}

export interface DashboardResult {
  grand: number;
  items: number;
  sheets: number;
  raw_lines: number;
  summary: SummaryRow[];
}

export function toDashboard(data: ReportData): DashboardResult {
  const { catTotals, grand, meta } = data;
  const summary: SummaryRow[] = [...catTotals.entries()]
    .map(([order, t]) => ({
      cat: CATS[order]?.[0] ?? CATS[99][0],
      count: t.count,
      mat: t.mat,
      lab: t.lab,
      tot: t.tot,
      pct: grand ? (t.tot / grand) * 100 : 0,
    }))
    .sort((a, b) => b.tot - a.tot);

  const items = [...catTotals.values()].reduce((acc, t) => acc + t.count, 0);

  return {
    grand,
    items,
    sheets: meta.sheets.length,
    raw_lines: meta.raw_lines,
    summary,
  };
}
