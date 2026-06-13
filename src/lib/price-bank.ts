/**
 * price-bank.ts — คลังราคากลางของบริษัท (รวมราคาวัสดุจากทุก BOQ ของทุกคน)
 * - บันทึก: ทุกครั้งที่ "บันทึกโครงการ" จะเก็บราคาต่อหน่วยของวัสดุลงคลัง (ตาราง material_prices)
 * - อ่าน: เวลาวิเคราะห์ไฟล์ จะดึงราคาเฉลี่ยที่บริษัทเคยเห็น มาเทียบว่าแพง/ถูกกว่าปกติ
 * ทำงานเฉพาะเมื่อล็อกอิน + ตั้งค่า Supabase แล้ว (ไม่งั้น no-op อย่างเงียบๆ)
 */
import { supabase, currentUser } from './supabase';

export interface PriceStat {
  avg: number;
  count: number;
  min: number;
  max: number;
}

export interface PriceItem {
  key: string;
  name: string;
  unit: string;
  unitRate: number;
}

/** บันทึกราคาวัสดุของโครงการลงคลัง (idempotent ต่อ source_id) */
export async function recordPrices(sourceId: string, projectName: string, items: PriceItem[]): Promise<void> {
  const u = await currentUser();
  if (!u || !supabase) return;
  try {
    // ลบของเดิมของโครงการนี้ก่อน แล้วใส่ใหม่ (กันซ้ำ/ตกค้าง)
    await supabase.from('material_prices').delete().eq('source_id', sourceId);
    const rows = items
      .filter((it) => it.unitRate > 0 && it.key)
      .map((it, i) => ({
        id: `${sourceId}:${i}`,
        source_id: sourceId,
        mkey: it.key,
        name: it.name,
        unit: it.unit,
        unit_rate: it.unitRate,
        project_name: projectName,
        user_id: u.id,
      }));
    if (rows.length) await supabase.from('material_prices').insert(rows);
  } catch {
    /* เงียบ — ตารางอาจยังไม่ถูกสร้าง */
  }
}

/** ดึงสถิติราคาที่บริษัทเคยเห็น ต่อ key (เฉลี่ย/จำนวน/ต่ำสุด/สูงสุด) */
export async function getPriceStats(keys: string[]): Promise<Map<string, PriceStat>> {
  const out = new Map<string, PriceStat>();
  const u = await currentUser();
  if (!u || !supabase || keys.length === 0) return out;
  try {
    const uniq = [...new Set(keys.filter(Boolean))];
    const { data, error } = await supabase
      .from('material_prices')
      .select('mkey, unit_rate')
      .in('mkey', uniq)
      .limit(5000);
    if (error || !data) return out;
    const agg = new Map<string, number[]>();
    for (const r of data as { mkey: string; unit_rate: number }[]) {
      const a = agg.get(r.mkey) ?? [];
      a.push(r.unit_rate);
      agg.set(r.mkey, a);
    }
    for (const [k, arr] of agg) {
      const sum = arr.reduce((s, x) => s + x, 0);
      out.set(k, { avg: sum / arr.length, count: arr.length, min: Math.min(...arr), max: Math.max(...arr) });
    }
  } catch {
    /* เงียบ */
  }
  return out;
}
