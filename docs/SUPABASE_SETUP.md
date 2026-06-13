# ตั้งค่า Supabase (cloud / ล็อกอิน / แชร์ทีม)

แอปทำงานได้โดย **ไม่ต้องมี Supabase** (จะเก็บโครงการในเครื่องด้วย IndexedDB)
ถ้าต้องการ **ล็อกอิน + บันทึกขึ้น cloud + ใช้ข้ามเครื่อง** ให้ทำ 3 ขั้นนี้:

## 1) Environment Variables (บน Vercel)
ตั้งใน Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL = <Project URL จาก Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon public key จาก Supabase>
```
> หาได้ที่ Supabase → Project Settings → API
> (ถ้า sync Supabase กับ Vercel ผ่าน integration แล้ว ค่าพวกนี้อาจถูกใส่ให้อัตโนมัติ — ตรวจชื่อให้ตรง)

## 2) สร้างตาราง + สิทธิ์ (รัน SQL)
Supabase → SQL Editor → วางไฟล์ [`supabase/schema.sql`](../supabase/schema.sql) ทั้งหมด → Run

## 3) ตั้งค่า Auth
Supabase → Authentication → URL Configuration:
- **Site URL** = `https://boq-smart-summary-pro.vercel.app` (โดเมนจริงของคุณ)
- เพิ่ม Redirect URLs ให้ครอบคลุมโดเมน preview ด้วยถ้าต้องการ

ระบบล็อกอินใช้ **magic link ทางอีเมล** (ไม่ต้องตั้งรหัสผ่าน) — Supabase มีบริการอีเมลให้ในตัว
> ถ้าใช้งานเยอะ แนะนำตั้ง SMTP ของตัวเอง (Auth → Email) กันอีเมลตกหล่น/ติด rate limit

## เสร็จแล้วเป็นยังไง
- ขึ้นปุ่ม **"เข้าสู่ระบบ (cloud)"** มุมบนของหน้า
- ล็อกอินแล้ว → กด "บันทึกโครงการ" จะเก็บขึ้น cloud (เห็นได้ทุกเครื่องที่ล็อกอินอีเมลเดียวกัน)
- ยังไม่ล็อกอิน → เก็บในเครื่องเหมือนเดิม

> ความปลอดภัย: เปิด Row Level Security แล้ว — ผู้ใช้เห็นเฉพาะโครงการของตัวเอง
> "แชร์ทั้งทีม" เพิ่มได้ภายหลัง (ตาราง teams + ปรับ policy)
