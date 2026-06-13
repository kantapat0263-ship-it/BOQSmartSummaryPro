/**
 * boq-processor.ts — TypeScript port of boq_report.py (COST CONTROL),
 * with extra robustness over the original desktop tool:
 *   - flexible header detection (Thai/English synonyms, shifted columns)
 *   - warns instead of silently guessing when money columns aren't labelled
 *   - smarter dedup (unit normalization + rebar canonicalization)
 *
 * It reads a BOQ (.xlsx) workbook, extracts material/work line-items from every
 * sub-sheet, collapses duplicate items used across multiple buildings into a
 * single row (tracking how many buildings use each), and splits them by work
 * category.
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

/**
 * Normalize หน่วยนับ เพื่อให้ "ตร.ม." = "ตร.ม" = "ตารางเมตร" = "ม.²"
 * (ของซ้ำที่หน่วยเขียนต่างกันจะได้รวมกันได้)
 */
export function normUnit(unit: unknown): string {
  let s = String(unit).trim().toLowerCase();
  s = s.replace(/[.\s²]/g, ''); // ตร.ม. -> ตรม , m² -> m2(หลังถอด ² ออก)
  const map: Record<string, string> = {
    ตารางเมตร: 'ตรม', ตรม: 'ตรม', ม2: 'ตรม', sqm: 'ตรม', m2: 'ตรม', sqm2: 'ตรม',
    ลูกบาศก์เมตร: 'ลบม', ลบม: 'ลบม', ม3: 'ลบม', m3: 'ลบม', cum: 'ลบม',
    ตารางวา: 'ตรว', ตรว: 'ตรว',
    เมตร: 'ม', ม: 'ม', m: 'ม', เมตรยาว: 'ม',
    กิโลกรัม: 'กก', กก: 'กก', kg: 'กก',
    ตัน: 'ตัน', ton: 'ตัน', tonne: 'ตัน',
    ชุด: 'ชุด', set: 'ชุด',
    แผ่น: 'แผ่น', ท่อน: 'ท่อน', เส้น: 'เส้น', ต้น: 'ต้น', ตัว: 'ตัว',
    อัน: 'อัน', ชิ้น: 'ชิ้น', จุด: 'จุด', ลูก: 'ลูก', บาน: 'บาน',
  };
  return map[s] ?? s;
}

/**
 * Canonicalize ชื่อเหล็กเสริม (rebar) ให้ของเดียวกันที่เขียนต่างกันรวมได้:
 *   "เหล็กข้ออ้อย dia 12 มม." = "เหล็ก DB12" = "เหล็กข้ออ้อย Ø12"  -> เหล็ก|db|12
 *   "เหล็กเส้นกลม dia 9 มม."  = "เหล็กกลม RB9"                    -> เหล็ก|rb|9
 * คืน null ถ้าไม่ใช่เหล็กเสริม (ให้ไปใช้ key ปกติ) — กันรวมผิด
 */
function rebarKey(normalized: string): string | null {
  const s = normalized; // ผ่าน normKey มาแล้ว (lower, dia, ยุบช่องว่าง)
  let type: string | null = null;
  if (s.includes('ข้ออ้อย') || s.includes('ข้อ้อย') || /\bdb\s*\d/.test(s) || s.includes('deformed')) {
    type = 'db';
  } else if (s.includes('เส้นกลม') || s.includes('เหล็กกลม') || s.includes('กลมผิวเรียบ') || /\brb\s*\d/.test(s) || s.includes('round bar')) {
    type = 'rb';
  }
  if (!type) return null;

  const m =
    s.match(/dia\s*0*([0-9]+(?:\.[0-9]+)?)/) ||
    s.match(/\b(?:db|rb)\s*0*([0-9]+(?:\.[0-9]+)?)/) ||
    s.match(/0*([0-9]+(?:\.[0-9]+)?)\s*(?:มม|มิล|mm)/);
  if (!m) return null;
  const size = parseFloat(m[1]);

  // ถ้าระบุชั้นคุณภาพ (SD40 / SR24) ให้แยกไว้ — กันรวมข้ามเกรด
  const g = s.match(/\b(sd|sr)\s*0*([0-9]+)/);
  const grade = g ? `|${g[1]}${g[2]}` : '';
  return `เหล็ก|${type}|${size}${grade}`;
}

/** ชื่อสำหรับแสดงผล: ตัดขีดนำหน้า + ยุบช่องว่าง (คงตัวพิมพ์เดิม) */
export function cleanName(desc: unknown): string {
  return String(desc).trim().replace(/^[\s\-–•·]+/, '').replace(/\s+/g, ' ');
}

/** คีย์สำหรับยุบของซ้ำ (ชื่อ normalize + rebar canonical + หน่วย normalize) */
export function dedupKey(desc: unknown, unit: unknown): string {
  const base = normKey(desc);
  const rk = rebarKey(base);
  return `${rk ?? base}${normUnit(unit)}`;
}

// ---------- header detection (ยืดหยุ่นขึ้น) ----------
const norm = (t: string) => t.replace(/\s+/g, '').toLowerCase();

function isDesc(t: string): boolean {
  const n = norm(t);
  return ['รายการ', 'รายละเอียด', 'รายการวัสดุ', 'รายการงาน', 'description', 'desc'].includes(n);
}
function isUnit(t: string): boolean {
  const n = norm(t);
  return ['หน่วย', 'หน่วยนับ', 'unit'].includes(n);
}
function isQty(t: string): boolean {
  const n = norm(t);
  return ['จำนวน', 'จำนวนรวม', 'ปริมาณ', 'ปริมาณงาน', 'qty', 'quantity'].includes(n);
}
/** คืนบทบาทของคอลัมน์เงิน (mat/lab/grand) จากข้อความหัวตาราง */
function moneyRole(t: string): 'mat' | 'lab' | 'grand' | null {
  const s = t;
  if (s.includes('รวมเป็นเงิน') || s.includes('รวมราคา') || s.includes('ราคารวม') || s.includes('รวมเงิน') || s.includes('รวมค่า') || /^amount$/i.test(s.trim()) || /^total$/i.test(s.trim())) {
    return 'grand';
  }
  if (s.includes('ค่าวัสดุ') || s.includes('ราคาวัสดุ') || norm(s) === 'วัสดุ' || /material/i.test(s)) return 'mat';
  if (s.includes('ค่าแรง') || s.includes('แรงงาน') || /labou?r/i.test(s)) return 'lab';
  return null;
}

export interface HeaderCols {
  desc: number;
  unit: number;
  qty: number;
  mat_total: number;
  lab_total: number;
  grand: number;
  header_row: number;
  /** true เมื่อหาคอลัมน์เงินจาก label ไม่ครบ ต้องเดาตำแหน่ง (อาจคลาดเคลื่อน) */
  moneyGuessed: boolean;
}

/** หาแถวหัวตาราง + ตำแหน่งคอลัมน์ (ยืดหยุ่น รองรับ BOQ หลายแบบ) หรือ null */
export function findHeader(ws: ExcelJS.Worksheet): HeaderCols | null {
  const maxRow = Math.min(ws.rowCount, 15);
  const maxCol = Math.min(ws.columnCount, 20);
  for (let r = 1; r <= maxRow; r++) {
    const rowtext: Array<[number, string]> = [];
    for (let c = 1; c <= maxCol; c++) {
      const v = cellValue(ws.getCell(r, c));
      if (v !== null && v !== undefined && String(v).trim() !== '') rowtext.push([c, String(v).trim()]);
    }

    const col: Partial<HeaderCols> = {};
    const found = { mat: false, lab: false, grand: false };
    for (const [c, t] of rowtext) {
      if (col.desc === undefined && isDesc(t)) col.desc = c;
      else if (col.unit === undefined && isUnit(t)) col.unit = c;
      else if (col.qty === undefined && isQty(t)) col.qty = c;
      const mr = moneyRole(t);
      if (mr === 'mat' && !found.mat) {
        // ถ้า label มีคำว่า "รวม" (เช่น ค่าวัสดุรวม) = คอลัมน์ยอดอยู่ตรงนั้นเลย; ไม่งั้นยอดอยู่ถัดไป 1 ช่อง
        col.mat_total = t.includes('รวม') ? c : c + 1;
        found.mat = true;
      } else if (mr === 'lab' && !found.lab) {
        col.lab_total = t.includes('รวม') ? c : c + 1;
        found.lab = true;
      } else if (mr === 'grand' && !found.grand) {
        col.grand = c;
        found.grand = true;
      }
    }

    // แถวนี้เป็นหัวตารางก็ต่อเมื่อระบุ รายการ + หน่วย + จำนวน ได้ครบ
    if (col.desc !== undefined && col.unit !== undefined && col.qty !== undefined) {
      const q = col.qty;
      // คอลัมน์เงินที่หา label ไม่เจอ -> เดาตำแหน่งโดยอิงจากคอลัมน์จำนวน (มาตรฐาน กปภ.)
      const moneyGuessed = !found.mat || !found.lab || !found.grand;
      col.mat_total ??= q + 2;
      col.lab_total ??= q + 4;
      col.grand ??= q + 5;
      col.header_row = r;
      col.moneyGuessed = moneyGuessed;
      return col as HeaderCols;
    }
  }
  return null;
}

// ---------- self-check: หา "ยอดรวมที่ไฟล์ระบุเอง" ไว้เทียบกับยอดที่คำนวณ ----------
// คำที่บ่งบอกแถวยอดรวม (โครงการ/หมวด) — ใช้จับ "ยอดอ้างอิงในไฟล์"
const TOTAL_KEYS = [
  'รวมราคา', 'รวมทั้งโครงการ', 'รวมทั้งสิ้น', 'รวมเป็นเงินทั้งสิ้น', 'ราคารวมทั้งสิ้น',
  'รวมราคาทั้งหมด', 'grand total', 'sub total', 'subtotal',
];

/** สแกนทุกชีต หาแถวที่เป็น "ยอดรวม" แล้วเก็บค่าตัวเลขสูงสุดของแถวนั้น */
function findStatedTotals(wb: ExcelJS.Workbook): number[] {
  const out: number[] = [];
  wb.eachSheet((ws) => {
    const maxRow = ws.rowCount;
    const maxCol = Math.min(ws.columnCount, 20);
    for (let r = 1; r <= maxRow; r++) {
      let text = '';
      let maxNum = 0;
      let hasNum = false;
      for (let c = 1; c <= maxCol; c++) {
        const v = cellValue(ws.getCell(r, c));
        if (v === null || v === undefined) continue;
        if (typeof v === 'number' && isFinite(v)) {
          if (Math.abs(v) > Math.abs(maxNum)) maxNum = v;
          hasNum = true;
        } else {
          text += ' ' + String(v);
        }
      }
      if (!hasNum || maxNum <= 0) continue;
      const low = text.toLowerCase();
      if (TOTAL_KEYS.some((k) => low.includes(k))) out.push(maxNum);
    }
  });
  return out;
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
  warnings: string[];
  statedTotals: number[];
}

/** อ่าน 1 ไฟล์ -> โครงสร้างที่ยุบซ้ำแล้ว แยกตามหมวด */
export function extract(wb: ExcelJS.Workbook, src: string): ExtractMeta {
  const byCat = new Map<number, Map<string, Item>>();
  const sectionsSeen = new Map<number, Set<string>>();
  const warnings: string[] = [];
  let rawLines = 0;
  const usedSheets: string[] = [];

  wb.eachSheet((ws) => {
    const title = ws.name;
    if (SKIP_SHEET_KEYWORDS.some((k) => title.toLowerCase().includes(k.toLowerCase()))) return;
    const col = findHeader(ws);
    if (!col) return;
    usedSheets.push(title);
    if (col.moneyGuessed) {
      warnings.push(
        `ชีต "${title}": ตรวจไม่พบหัวคอลัมน์เงินชัดเจน (ค่าวัสดุ/ค่าแรง/รวมเป็นเงิน) ` +
          `จึงใช้ตำแหน่งโดยประมาณ — ตัวเลขในชีตนี้อาจคลาดเคลื่อน ควรตรวจสอบ`,
      );
    }
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
      const key = dedupKey(desc, unitS);
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

  // เตือนเมื่อจัดหมวดไม่ได้ (ไม่พบรหัส X.Y.Z) ของตกลง "งานอื่นๆ" ทั้งหมด
  if (byCat.size === 1 && byCat.has(99) && rawLines > 0) {
    warnings.push(
      'ไม่พบรหัสหมวดงาน (รูปแบบ X.Y.Z) ในไฟล์ จึงไม่สามารถแยกหมวดได้ — ' +
        'รวมทุกรายการไว้ใน "งานอื่นๆ" (ยอดรวมยังถูกต้อง)',
    );
  }

  return { src, raw_lines: rawLines, sheets: usedSheets, byCat, sectionsSeen, warnings, statedTotals: findStatedTotals(wb) };
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

/** รายการวัสดุระดับ item (สำหรับตารางค้นหา/Pareto/เทียบราคาบนเว็บ) */
export interface MaterialRow {
  cat: string;
  name: string;
  unit: string;
  qty: number;
  mat: number;
  lab: number;
  tot: number;
  unitRate: number; // ราคาต่อหน่วยจริง = tot / qty
  buildings: number; // ใช้กี่อาคาร
  buildingList: string;
}

/** ผลการตรวจยอด (เทียบยอดคำนวณ กับ ยอดที่ระบุในไฟล์) */
export interface VerifyResult {
  status: 'match' | 'over' | 'under' | 'unknown';
  statedTotal: number | null; // ยอดอ้างอิงสูงสุดที่พบในไฟล์
  computed: number;
  diffPct: number;
}

export interface DashboardResult {
  grand: number;
  items: number;
  sheets: number;
  raw_lines: number;
  summary: SummaryRow[];
  materials: MaterialRow[];
  warnings: string[];
  verify: VerifyResult;
}

function buildVerify(grand: number, stated: number[]): VerifyResult {
  const maxStated = stated.length ? Math.max(...stated) : null;
  let status: VerifyResult['status'] = 'unknown';
  let diffPct = 0;
  if (maxStated && maxStated > 0) {
    diffPct = ((grand - maxStated) / maxStated) * 100;
    const matchedAny = stated.some((v) => Math.abs(grand - v) <= Math.max(v, grand) * 0.02);
    if (grand > maxStated * 1.05) status = 'over';
    else if (matchedAny) status = 'match';
    else if (grand < maxStated * 0.5) status = 'under';
    else status = 'unknown';
  }
  return { status, statedTotal: maxStated, computed: grand, diffPct };
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

  // รายการวัสดุระดับ item (หนึ่งแถวต่อ หมวด+รายการ) เรียงตามยอดมากสุด
  const materials: MaterialRow[] = [];
  const orders = [...meta.byCat.keys()].sort((a, b) => a - b);
  for (const order of orders) {
    const label = CATS[order]?.[0] ?? CATS[99][0];
    for (const it of meta.byCat.get(order)!.values()) {
      materials.push({
        cat: label,
        name: it.name,
        unit: it.unit,
        qty: it.qty,
        mat: it.mat,
        lab: it.lab,
        tot: it.tot,
        unitRate: it.qty ? it.tot / it.qty : 0,
        buildings: it.sheets.size,
        buildingList: [...it.sheets].sort().join(', '),
      });
    }
  }
  materials.sort((a, b) => b.tot - a.tot);

  const items = [...catTotals.values()].reduce((acc, t) => acc + t.count, 0);

  return {
    grand,
    items,
    sheets: meta.sheets.length,
    raw_lines: meta.raw_lines,
    summary,
    materials,
    warnings: meta.warnings,
    verify: buildVerify(grand, meta.statedTotals),
  };
}
