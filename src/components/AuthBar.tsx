"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Cloud, LogOut, Loader2, UserPlus, LogIn, X } from 'lucide-react';
import { supabase, supabaseEnabled, signUpPassword, signInPassword, signOut } from '@/lib/supabase';

interface AuthBarProps {
  onAuthChange?: () => void;
}

type Msg = { type: 'ok' | 'err'; text: string } | null;

export function AuthBar({ onAuthChange }: AuthBarProps) {
  const [email, setEmail] = useState<string | null>(null); // อีเมลที่ล็อกอินอยู่
  const [open, setOpen] = useState(false); // เปิดฟอร์มไหม
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const onAuthChangeRef = useRef(onAuthChange);
  onAuthChangeRef.current = onAuthChange;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user?.email ?? null);
      if (event !== 'INITIAL_SESSION') onAuthChangeRef.current?.();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabaseEnabled) return null;

  const validate = (): string | null => {
    if (!emailInput.trim() || !emailInput.includes('@')) return 'กรุณากรอกอีเมลให้ถูกต้อง';
    if (password.length < 6) return 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';
    return null;
  };

  const doSignUp = async () => {
    const v = validate(); if (v) { setMsg({ type: 'err', text: v }); return; }
    setBusy(true); setMsg(null);
    try {
      const { needConfirm } = await signUpPassword(emailInput.trim(), password);
      if (needConfirm) {
        setMsg({ type: 'ok', text: 'สมัครแล้ว — ต้องยืนยันอีเมลก่อนเข้าใช้ (หรือให้แอดมินปิด Confirm email)' });
      } else {
        setMsg({ type: 'ok', text: 'สมัครและเข้าสู่ระบบสำเร็จ ✓' });
        setOpen(false); setPassword('');
      }
    } catch (err: any) {
      const m = /already registered/i.test(err.message) ? 'อีเมลนี้สมัครแล้ว — กด "เข้าสู่ระบบ" แทน' : err.message;
      setMsg({ type: 'err', text: m });
    } finally { setBusy(false); }
  };

  const doSignIn = async () => {
    const v = validate(); if (v) { setMsg({ type: 'err', text: v }); return; }
    setBusy(true); setMsg(null);
    try {
      await signInPassword(emailInput.trim(), password);
      setMsg({ type: 'ok', text: 'เข้าสู่ระบบสำเร็จ ✓' });
      setOpen(false); setPassword('');
    } catch (err: any) {
      const m = /invalid login/i.test(err.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : err.message;
      setMsg({ type: 'err', text: m });
    } finally { setBusy(false); }
  };

  const handleLogout = async () => {
    setBusy(true); await signOut(); setBusy(false);
  };

  // ----- ล็อกอินอยู่แล้ว -----
  if (email) {
    return (
      <div className="flex items-center justify-end gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm bg-white/70 backdrop-blur rounded-full px-4 py-2 border border-border/60 shadow-sm">
          <Cloud className="w-4 h-4 text-emerald-500" />
          <span className="font-medium text-primary max-w-[200px] truncate" title={email}>{email}</span>
          <button onClick={handleLogout} disabled={busy} className="ml-1 inline-flex items-center gap-1 text-muted-foreground hover:text-destructive font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} ออก
          </button>
        </div>
      </div>
    );
  }

  // ----- ยังไม่ล็อกอิน -----
  return (
    <div className="flex flex-col items-end gap-2 mb-6">
      {!open ? (
        <button onClick={() => { setOpen(true); setMsg(null); }} className="inline-flex items-center gap-2 text-sm font-bold text-primary bg-white/70 backdrop-blur rounded-full px-4 py-2 border border-border/60 shadow-sm hover:text-secondary">
          <Cloud className="w-4 h-4" /> เข้าสู่ระบบ / สมัคร (บันทึกขึ้น cloud)
        </button>
      ) : (
        <div className="w-full max-w-sm bg-white rounded-2xl border border-border/60 shadow-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-primary flex items-center gap-2"><Cloud className="w-5 h-5" /> เข้าสู่ระบบ (cloud)</h4>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <input
            type="email" placeholder="อีเมล" value={emailInput} autoComplete="email"
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full rounded-xl border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSignIn(); }}
            className="w-full rounded-xl border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {msg && (
            <p className={`text-sm font-medium ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
          )}
          <div className="flex gap-2">
            <button onClick={doSignIn} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 font-bold hover:bg-primary/90 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} เข้าสู่ระบบ
            </button>
            <button onClick={doSignUp} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-primary text-primary rounded-xl py-2.5 font-bold hover:bg-primary/5 disabled:opacity-60">
              <UserPlus className="w-4 h-4" /> สมัคร
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">ครั้งแรกกด "สมัคร" · ครั้งต่อไปกด "เข้าสู่ระบบ"</p>
        </div>
      )}
    </div>
  );
}
