/**
 * boq-report.ts — generates the styled .xlsx report (ports the openpyxl
 * writer in boq_report.py). Produces:
 *   1) "สรุปต่อหมวด"      — per-category totals + % share
 *   2) <ชีตละหมวด>        — deduped items per category + subtotal
 *   3) "วัสดุรวมทุกหมวด"   — items deduped across all categories
 */

import ExcelJS from 'exceljs';
import { CATS, itemsToRows, type Item, type ReportData } from './boq-processor';

const FONT = 'TH Sarabun New';
const MONEY = '#,##0.00';
const PCT = '0.0"%"';
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

function hdr(cell: ExcelJS.Cell, text: string, bg = 'FF1F4E78') {
  cell.value = text;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: FONT };
  cell.fill = fill(bg);
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = BORDER;
}

/** เขียนชีตตารางรายการวัสดุ (ใช้ทั้งชีตหมวด และชีตรวมทุกหมวด) */
function writeItemsSheet(ws: ExcelJS.Worksheet, rows: Item[], title: string, subtitle: string) {
  ws.mergeCells('A1:K1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { bold: true, size: 14, name: FONT };
  ws.mergeCells('A2:K2');
  ws.getCell('A2').value = subtitle;
  ws.getCell('A2').font = { size: 10, italic: true, color: { argb: 'FF808080' }, name: FONT };

  const headers = [
    'ลำดับ', 'รายการ', 'หน่วย', 'จำนวนรวม', 'ค่าวัสดุ/หน่วย',
    'ค่าวัสดุรวม', 'ค่าแรง/หน่วย', 'ค่าแรงรวม', 'รวมเป็นเงิน',
    'ใช้กี่อาคาร', 'อาคารที่ใช้',
  ];
  const hr = 4;
  headers.forEach((h, i) => hdr(ws.getCell(hr, i + 1), h));

  let sm = 0;
  let sl = 0;
  let st = 0;
  let r = hr + 1;
  rows.forEach((it, idx) => {
    const q = it.qty;
    const vals: Array<string | number> = [
      idx + 1, it.name, it.unit, q,
      q ? it.mat / q : 0, it.mat,
      q ? it.lab / q : 0, it.lab, it.tot,
      it.sheets.size, [...it.sheets].sort().join(', '),
    ];
    vals.forEach((v, ci) => {
      const c = ci + 1;
      const cell = ws.getCell(r, c);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 10, name: FONT };
      cell.border = BORDER;
      if (c === 4 || (c >= 5 && c <= 9)) cell.numFmt = MONEY;
      if (c === 2) cell.alignment = { wrapText: true, vertical: 'top' };
      else if (c === 3 || c === 10) cell.alignment = { horizontal: 'center' };
    });
    // เน้นรายการที่ใช้ข้ามอาคาร (>=2 อาคาร)
    if (it.sheets.size >= 2) ws.getCell(r, 10).fill = fill('FFFFF2CC');
    sm += it.mat;
    sl += it.lab;
    st += it.tot;
    r += 1;
  });

  // subtotal
  ws.getCell(r, 2).value = 'รวมทั้งหมด';
  ws.getCell(r, 2).font = { bold: true, size: 11, name: FONT };
  for (const [c, v] of [[6, sm], [8, sl], [9, st]] as const) {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.font = { bold: true, size: 11, name: FONT };
    cell.numFmt = MONEY;
  }
  for (let c = 1; c <= 11; c++) {
    ws.getCell(r, c).border = BORDER;
    ws.getCell(r, c).fill = fill('FFDDEBF7');
  }

  [7, 46, 9, 12, 12, 14, 12, 14, 15, 10, 18].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  if (rows.length) ws.autoFilter = `A${hr}:K${r - 1}`;
}

/** ชีตหน้าแรก: สรุปยอดต่อหมวด + สัดส่วน */
function writeOverview(ws: ExcelJS.Worksheet, data: ReportData) {
  const { meta, catTotals, grand } = data;
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'สรุปต่อหมวดงาน';
  ws.getCell('A1').font = { bold: true, size: 16, name: FONT };
  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = `ไฟล์: ${meta.src}`;
  ws.getCell('A2').font = { size: 10, name: FONT };
  ws.mergeCells('A3:F3');
  ws.getCell('A3').value =
    `อ่าน ${meta.sheets.length} ชีตงาน | รายการดิบ ${meta.raw_lines.toLocaleString('en-US')} บรรทัด`;
  ws.getCell('A3').font = { size: 10, italic: true, color: { argb: 'FF808080' }, name: FONT };

  const hr = 5;
  ['ลำดับ', 'หมวดงาน', 'จำนวนรายการ', 'ค่าวัสดุรวม', 'ค่าแรงรวม', 'รวมเป็นเงิน', '% โครงการ']
    .forEach((h, i) => hdr(ws.getCell(hr, i + 1), h));

  let r = hr + 1;
  let n = 1;
  const orders = [...catTotals.keys()].sort((a, b) => a - b);
  for (const order of orders) {
    const t = catTotals.get(order)!;
    const label = CATS[order]?.[0] ?? CATS[99][0];
    const pct = grand ? (t.tot / grand) * 100 : 0;
    const vals: Array<string | number> = [n, label, t.count, t.mat, t.lab, t.tot, pct];
    vals.forEach((v, ci) => {
      const c = ci + 1;
      const cell = ws.getCell(r, c);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { size: 11, name: FONT };
      cell.border = BORDER;
      if (c >= 4 && c <= 6) cell.numFmt = MONEY;
      else if (c === 7) cell.numFmt = PCT;
      else if (c === 3) cell.alignment = { horizontal: 'center' };
    });
    if (t.tot === 0) ws.getCell(r, 7).value = '—';
    r += 1;
    n += 1;
  }

  // grand total
  let tm = 0;
  let tl = 0;
  for (const t of catTotals.values()) {
    tm += t.mat;
    tl += t.lab;
  }
  ws.getCell(r, 2).value = 'รวมทั้งโครงการ';
  ws.getCell(r, 2).font = { bold: true, size: 12, name: FONT };
  for (const [c, v] of [[4, tm], [5, tl], [6, grand]] as const) {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.font = { bold: true, size: 12, name: FONT };
    cell.numFmt = MONEY;
  }
  ws.getCell(r, 7).value = 100;
  ws.getCell(r, 7).numFmt = PCT;
  ws.getCell(r, 7).font = { bold: true, name: FONT };
  for (let c = 1; c <= 7; c++) {
    ws.getCell(r, c).border = BORDER;
    ws.getCell(r, c).fill = fill('FFDDEBF7');
  }

  [7, 36, 13, 16, 16, 16, 11].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.views = [{ state: 'frozen', ySplit: 5 }];
}

/** สร้างไฟล์รายงาน (.xlsx) เป็น Buffer */
export async function generateReport(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // 1) overview
  writeOverview(wb.addWorksheet('สรุปต่อหมวด'), data);

  // 2) ชีตละหมวด (เฉพาะหมวดที่มีรายการ)
  const orders = [...data.meta.byCat.keys()].sort((a, b) => a - b);
  for (const order of orders) {
    const bucket = data.meta.byCat.get(order)!;
    if (bucket.size === 0) continue;
    const [label, tab] = CATS[order] ?? CATS[99];
    const ws = wb.addWorksheet(tab.slice(0, 31));
    const srcs = [...(data.meta.sectionsSeen.get(order) ?? [])].sort().join(' / ');
    writeItemsSheet(ws, itemsToRows(bucket), `หมวด: ${label}`, srcs ? `รวมจากหัวข้อ BOQ: ${srcs}` : '');
  }

  // 3) วัสดุรวมทุกหมวด
  const gw = wb.addWorksheet('วัสดุรวมทุกหมวด');
  writeItemsSheet(
    gw,
    itemsToRows(data.globalItems),
    'วัสดุรวมทุกหมวด (รวมซ้ำข้ามหมวด)',
    `ไฟล์: ${data.meta.src} | ${data.globalItems.size.toLocaleString('en-US')} รายการ`,
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as unknown as ArrayBuffer);
}
