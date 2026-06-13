/**
 * supabase.ts — เชื่อม Supabase (cloud) แบบ "ทางเลือก"
 * ถ้าตั้ง env ไว้ (บน Vercel) จะใช้ cloud ได้; ถ้าไม่มี ก็ใช้ local-first ต่อไป (ไม่พัง)
 *
 * ต้องตั้ง Environment Variables บน Vercel:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anon);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/** อีเมลผู้ใช้ปัจจุบัน (null ถ้ายังไม่ล็อกอิน/ไม่มี cloud) */
export async function currentUser(): Promise<{ id: string; email: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? '' } : null;
}

/** สมัครสมาชิกด้วยอีเมล + รหัสผ่าน (ถ้าปิด "Confirm email" ใน Supabase จะล็อกอินทันที) */
export async function signUpPassword(email: string, password: string): Promise<{ needConfirm: boolean }> {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า cloud (Supabase)');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // ถ้ามี session = ล็อกอินเลย; ถ้าไม่มี = ต้องยืนยันอีเมลก่อน
  return { needConfirm: !data.session };
}

/** เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน */
export async function signInPassword(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า cloud (Supabase)');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
