# 📋 HANDOFF — PAC Cost Control (BOQ Web App)

> เอกสารส่งต่องาน ใช้เริ่มงานต่อในแชท/เซสชันใหม่ได้ทันที

## 1) โปรเจกต์คืออะไร
- เว็บแอปวิเคราะห์ BOQ สำหรับบริษัทรับเหมา (PAC Cost Control)
- Stack: **Next.js 15 + TypeScript + Tailwind + ExcelJS**, deploy บน **Vercel**
- Live: https://boq-smart-summary-pro.vercel.app (เปิด Vercel Deployment Protection อยู่ → คนนอกได้ 403)
- Repo: `kantapat0263-ship-it/BOQSmartSummaryPro`
- Branch dev: `claude/local-program-web-app-pijgzu` · production = `main` (Vercel auto-deploy จาก main)

## 2) ทำอะไรได้แล้ว (อยู่บน main)
- อ่าน BOQ 2 ฟอร์แมต: **กปภ.** (รหัสหมวด X.Y.Z) และ **PAC** (หัวข้อหมวดเป็นข้อความ + รหัสอยู่คอลัมน์ชื่อ)
- **Auto-Reconcile**: ถ้ายอดคำนวณสูงเกินยอดที่ไฟล์ประกาศ → ตัดบล็อกสรุป/ชีตซ้ำ จนยอดตรง (PAC: 74M→25.5M)
- **Self-check**: เทียบยอดคำนวณ vs ยอดในไฟล์ → match/over/under
- แยกหมวด, รวมของซ้ำข้ามอาคาร, Pareto (Top cost drivers)
- ตารางวัสดุ ค้นหา/กรอง/**เทียบราคาอ้างอิง→ส่วนต่าง** (จำค่าด้วย localStorage + Export CSV)
- **เครื่องจำลองแนวโน้มต้นทุน** (อัตราแยกตามหมวด + ผลต่อกำไร)
- ดาวน์โหลดรายงาน **Excel มีสูตรจริง** (=SUM, ราคา/หน่วย, %, ลิงก์ข้ามชีต)
- **PWA** ติดตั้งลง Desktop ได้ (ไอคอน PAC)
- **บันทึก/เปิดโครงการในเครื่อง** (IndexedDB) — ไม่หายเมื่อปิดแอป

ไฟล์สมองหลัก: `src/lib/boq-processor.ts` (อ่าน/จัดหมวด/reconcile/verify), `src/lib/boq-report.ts` (Excel),
`src/app/api/process/route.ts` (API), `src/app/page.tsx` (UI)

## 3) งานที่ค้างอยู่ — Phase 2 Cloud (Supabase) ⬅️ ทำต่อตรงนี้
**โค้ดเขียนเสร็จแล้ว แต่ยังอยู่บน feature branch (`claude/local-program-web-app-pijgzu`) ยังไม่ขึ้น main**
- ไฟล์ที่เพิ่ม: `src/lib/supabase.ts`, `src/lib/project-store.ts` (unified cloud/local),
  `src/components/AuthBar.tsx`, `supabase/schema.sql`, `docs/SUPABASE_SETUP.md`
- พฤติกรรม: **ถ้ามี env Supabase + ล็อกอิน → เก็บ cloud; ถ้าไม่มี → เก็บในเครื่อง (ไม่พัง)**
- ล็อกอิน = magic link ทางอีเมล · เก็บต่อ user (Row Level Security)
- ⚠️ โค้ด cloud **ยังไม่ได้ทดสอบสด** (ไม่มีคีย์ตอนเขียน)

### สิ่งที่ต้องทำให้ครบ (ลำดับนี้)
1. **[ผู้ใช้] สร้าง Supabase project ใหม่** สำหรับแอปนี้ (org แยกจากงานอื่น, region = Singapore)
   - หมายเหตุ: org "store-purchase" ที่มีอยู่เป็นงานอื่น ห้ามใช้ปน
2. **[ผู้ใช้] เอาคีย์**: Supabase → Project Settings → **API** → ได้ `Project URL` + `anon public key`
3. **[ผู้ใช้] ตั้ง env บน Vercel** (ทั้ง Production + Preview) แล้ว **redeploy**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```
   (NEXT_PUBLIC_ ฝังตอน build → ต้องตั้งก่อน deploy)
4. **[ผู้ใช้] รัน SQL**: Supabase → SQL Editor → วาง `supabase/schema.sql` → Run
5. **[ผู้ใช้] ตั้ง Auth URL**: Supabase → Authentication → URL Configuration →
   Site URL = `https://boq-smart-summary-pro.vercel.app` (+ redirect `.../**`)
6. **[ผู้ช่วย/แชทใหม่] merge feature → main** (push main) เพื่อให้ production มีโค้ด cloud → Vercel redeploy
7. **ทดสอบ**: ปุ่ม "เข้าสู่ระบบ (cloud)" โผล่ → ล็อกอิน → กด "บันทึกโครงการ" → เช็คว่าขึ้น cloud + เห็นข้ามเครื่อง

## 4) งานต่อยอด (ทำหลัง cloud ใช้ได้)
- **แชร์ทั้งทีม**: เพิ่มตาราง `teams` + แก้ RLS (ตอนนี้เห็นเฉพาะของตัวเอง)
- **ย้ายของ local → cloud** ตอนล็อกอินครั้งแรก (อ่าน IndexedDB แล้ว upsert ขึ้น Supabase)
- เปลี่ยน magic link → **Google OAuth** ถ้าต้องการ
- ลบ dependency `firebase` ที่ไม่ใช้แล้วออกจาก package.json
- **คลังราคา (price history)** → ป้อนเข้าเครื่องจำลองแนวโน้ม (trend จากข้อมูลจริง)
- จำ **โปรไฟล์ฟอร์แมต** (auto-reconcile + บันทึกวิธีอ่านต่อแหล่งไฟล์)

## 5) Git / Deploy workflow
- พัฒนาบน branch `claude/local-program-web-app-pijgzu` → push
- ขึ้น production: fast-forward `main` ให้ตรง feature แล้ว `git push origin main` (ต้องขอ permission ผู้ใช้ทุกครั้ง)
- Vercel: main → production, branch อื่น → preview
- คอมมิตล่าสุด feature: Supabase cloud (`2473a21`) · main ล่าสุด: local save (`5db979a`)

## 6) ข้อควรระวัง
- อย่า commit คีย์/secret ลง git (อยู่ใน env เท่านั้น)
- `npm run build` ต้องผ่านเสมอก่อน push (Vercel จะ deploy ตาม main อัตโนมัติ)
- โค้ด cloud graceful: ถ้าลืมตั้ง env แอปจะกลับไปใช้ local ไม่ error
- ทดสอบ cloud บน preview/prod จริงหลังตั้งคีย์ (เทสต์ในเครื่อง dev ที่ไม่มีคีย์ไม่ได้)
- รัน build/test: `npm install && npm run build` · เครื่องมือ test ใช้ tsx + fake-indexeddb (ติดตั้ง --no-save ตอนทดสอบ)
