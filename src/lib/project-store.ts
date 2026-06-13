/**
 * project-store.ts — บันทึก/เปิดโครงการ
 * - ล็อกอินแล้ว (มี Supabase cloud) -> เก็บบน cloud (sync ข้ามเครื่อง/แชร์ได้)
 * - ยังไม่ล็อกอิน / ไม่มี cloud      -> เก็บในเครื่อง (IndexedDB) เหมือนเดิม
 */
import { supabase, currentUser } from './supabase';

const DB_NAME = 'pac-cost-control';
const STORE = 'projects';
const VERSION = 1;

export interface SavedProject {
  id: string;
  name: string;
  savedAt: number;
  fileName: string;
  fileSize: number;
  grand: number;
  result: unknown;
}

// ---------- local (IndexedDB) ----------
function hasIDB(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
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

const localSave = (p: SavedProject) => run<void>('readwrite', (s) => s.put(p));
const localList = async (): Promise<SavedProject[]> => {
  if (!hasIDB()) return [];
  const all = await run<SavedProject[]>('readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => b.savedAt - a.savedAt);
};
const localGet = (id: string) => run<SavedProject | undefined>('readonly', (s) => s.get(id));
const localDelete = (id: string) => run<void>('readwrite', (s) => s.delete(id));

// ---------- cloud (Supabase) ----------
interface Row {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  grand: number;
  result: unknown;
  saved_at: string;
}
const rowToProject = (r: Row): SavedProject => ({
  id: r.id,
  name: r.name,
  savedAt: new Date(r.saved_at).getTime(),
  fileName: r.file_name,
  fileSize: r.file_size,
  grand: r.grand,
  result: r.result,
});

async function cloudSave(p: SavedProject, uid: string): Promise<void> {
  const { error } = await supabase!.from('projects').upsert({
    id: p.id,
    user_id: uid,
    name: p.name,
    file_name: p.fileName,
    file_size: p.fileSize,
    grand: p.grand,
    result: p.result,
    saved_at: new Date(p.savedAt).toISOString(),
  });
  if (error) throw error;
}
async function cloudList(): Promise<SavedProject[]> {
  const { data, error } = await supabase!
    .from('projects')
    .select('*')
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data as Row[] | null ?? []).map(rowToProject);
}
async function cloudGet(id: string): Promise<SavedProject | undefined> {
  const { data } = await supabase!.from('projects').select('*').eq('id', id).maybeSingle();
  return data ? rowToProject(data as Row) : undefined;
}
async function cloudDelete(id: string): Promise<void> {
  const { error } = await supabase!.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ---------- unified (เลือก cloud/local อัตโนมัติ) ----------
export async function saveProject(p: SavedProject): Promise<void> {
  const u = await currentUser();
  if (u && supabase) return cloudSave(p, u.id);
  if (!hasIDB()) throw new Error('เบราว์เซอร์ไม่รองรับการบันทึก');
  await localSave(p);
}

export async function listProjects(): Promise<SavedProject[]> {
  const u = await currentUser();
  if (u && supabase) return cloudList();
  return localList();
}

export async function getProject(id: string): Promise<SavedProject | undefined> {
  const u = await currentUser();
  if (u && supabase) return cloudGet(id);
  return localGet(id);
}

export async function deleteProject(id: string): Promise<void> {
  const u = await currentUser();
  if (u && supabase) return cloudDelete(id);
  await localDelete(id);
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ตอนนี้กำลังเก็บที่ไหน: 'cloud' (ล็อกอินแล้ว) หรือ 'local' (เครื่องนี้) */
export async function storageMode(): Promise<'cloud' | 'local'> {
  const u = await currentUser();
  return u && supabase ? 'cloud' : 'local';
}
