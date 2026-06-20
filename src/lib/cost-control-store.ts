/**
 * cost-control-store.ts — บันทึก/เปิดข้อมูลคุมต้นทุน (1 ก้อนต่อ 1 โครงการ)
 * - ล็อกอินแล้ว (Supabase) -> เก็บ cloud (ตาราง cost_control)
 * - ยังไม่ล็อกอิน        -> เก็บในเครื่อง (IndexedDB)
 */
import { supabase, currentUser } from './supabase';
import { emptyCostControl, type CostControlData } from './cost-control';

const DB_NAME = 'pac-cost-control-data';
const STORE = 'cost_control';
const VERSION = 1;

function hasIDB(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'projectId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

// ---------- cloud ----------
async function cloudSave(data: CostControlData, uid: string): Promise<void> {
  const { error } = await supabase!.from('cost_control').upsert({
    project_id: data.projectId,
    user_id: uid,
    data,
    updated_at: new Date(data.updatedAt).toISOString(),
  });
  if (error) throw error;
}
async function cloudLoad(projectId: string): Promise<CostControlData | undefined> {
  const { data } = await supabase!
    .from('cost_control')
    .select('data')
    .eq('project_id', projectId)
    .maybeSingle();
  return data ? ((data as { data: CostControlData }).data) : undefined;
}

// ---------- unified ----------
export async function loadCostControl(projectId: string): Promise<CostControlData> {
  const u = await currentUser();
  let found: CostControlData | undefined;
  if (u && supabase) found = await cloudLoad(projectId);
  else if (hasIDB()) found = await run<CostControlData | undefined>('readonly', (s) => s.get(projectId));
  if (!found) return emptyCostControl(projectId);
  // เติมฟิลด์ที่อาจหายไป (กันข้อมูลเก่า)
  return {
    ...emptyCostControl(projectId),
    ...found,
    overheadBudget: found.overheadBudget ?? 0,
    progress: found.progress ?? {},
    entries: found.entries ?? [],
    vos: found.vos ?? [],
  };
}

export async function saveCostControl(data: CostControlData): Promise<void> {
  const payload = { ...data, updatedAt: Date.now() };
  const u = await currentUser();
  if (u && supabase) return cloudSave(payload, u.id);
  if (!hasIDB()) throw new Error('เบราว์เซอร์ไม่รองรับการบันทึก');
  await run<void>('readwrite', (s) => s.put(payload));
}
