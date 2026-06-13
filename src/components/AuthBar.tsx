"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Cloud, LogIn, LogOut, Loader2 } from 'lucide-react';
import { supabase, supabaseEnabled, signInWithEmail, signOut } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AuthBarProps {
  onAuthChange?: () => void;
}

export function AuthBar({ onAuthChange }: AuthBarProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  // เก็บ callback ล่าสุดไว้ใน ref เพื่อให้ subscribe ครั้งเดียว (กัน re-subscribe loop)
  const onAuthChangeRef = useRef(onAuthChange);
  onAuthChangeRef.current = onAuthChange;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user?.email ?? null);
      // เรียก reload เฉพาะตอนล็อกอิน/ออกจริง ไม่ใช่ตอน INITIAL_SESSION (กันลูป)
      if (event !== 'INITIAL_SESSION') onAuthChangeRef.current?.();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabaseEnabled) return null; // ยังไม่ตั้งค่า cloud -> ใช้ local เงียบๆ

  const handleLogin = async () => {
    const e = window.prompt('กรอกอีเมลเพื่อรับลิงก์เข้าสู่ระบบ');
    if (!e) return;
    setBusy(true);
    try {
      await signInWithEmail(e.trim());
      toast({ title: 'ส่งลิงก์แล้ว', description: `เปิดอีเมล ${e} แล้วคลิกลิงก์เพื่อเข้าสู่ระบบ` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'เข้าสู่ระบบไม่สำเร็จ', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    toast({ title: 'ออกจากระบบแล้ว', description: 'กลับไปใช้การบันทึกในเครื่อง' });
  };

  return (
    <div className="flex items-center justify-end gap-3 mb-6">
      <div className="flex items-center gap-2 text-sm bg-white/70 backdrop-blur rounded-full px-4 py-2 border border-border/60 shadow-sm">
        <Cloud className={`w-4 h-4 ${email ? 'text-emerald-500' : 'text-muted-foreground'}`} />
        {email ? (
          <>
            <span className="font-medium text-primary max-w-[180px] truncate" title={email}>{email}</span>
            <button onClick={handleLogout} disabled={busy} className="ml-1 inline-flex items-center gap-1 text-muted-foreground hover:text-destructive font-bold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} ออก
            </button>
          </>
        ) : (
          <button onClick={handleLogin} disabled={busy} className="inline-flex items-center gap-1.5 font-bold text-primary hover:text-secondary">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            เข้าสู่ระบบ (บันทึกขึ้น cloud / แชร์ทีม)
          </button>
        )}
      </div>
    </div>
  );
}
