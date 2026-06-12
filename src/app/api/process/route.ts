import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { extract, buildReportData, toDashboard } from '@/lib/boq-processor';
import { generateReport } from '@/lib/boq-report';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get('name') || 'boq-analysis.xlsx';
    const buffer = await req.arrayBuffer();

    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 });
    }

    // อ่านไฟล์ BOQ
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      return NextResponse.json(
        { error: 'อ่านไฟล์ไม่ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง' },
        { status: 400 },
      );
    }

    // แกะรายการ -> จัดหมวด -> รวมของซ้ำ (ตรรกะเดียวกับ boq_report.py)
    const meta = extract(workbook, filename);

    if (meta.byCat.size === 0) {
      return NextResponse.json(
        {
          error:
            'ไม่พบตารางรายการวัสดุในไฟล์นี้ (มองหาหัวตารางที่มี "ลำดับ", "รายการ", "หน่วย" ไม่เจอ) ' +
            'หากไฟล์ BOQ หน้าตาต่างจากของ กปภ. กรุณาแจ้งแอดมินเพื่อปรับโปรแกรม',
        },
        { status: 422 },
      );
    }

    const data = buildReportData(meta);
    const dashboard = toDashboard(data);

    // สร้างไฟล์รายงานสรุป (.xlsx) จริง แล้วส่งกลับเป็น base64 ให้ดาวน์โหลด
    const reportBuffer = await generateReport(data);
    const xlsx_b64 = reportBuffer.toString('base64');

    return NextResponse.json({
      filename,
      grand: dashboard.grand,
      items: dashboard.items,
      sheets: dashboard.sheets,
      raw_lines: dashboard.raw_lines,
      summary: dashboard.summary,
      materials: dashboard.materials,
      warnings: dashboard.warnings,
      xlsx_b64,
    });
  } catch (error: unknown) {
    console.error('Processing error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
