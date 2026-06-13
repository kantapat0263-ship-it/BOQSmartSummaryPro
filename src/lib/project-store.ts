/**
 * project-store.ts — บันทึก/เปิดโครงการที่วิเคราะห์แล้ว ลงในเครื่อง (IndexedDB)
 * ทำงานในเบราว์เซอร์ทันที ไม่ต้องตั้งค่า/ล็อกอิน — ข้อมูลไม่หายเมื่อปิดแอป
 * (เป็นชั้น "บันทึกโครงการ" ของ Phase 2 แบบ local-first; ต่อ cloud/ทีมได้ภายหลัง)
 */

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
  // ผลวิเคราะห์เต็ม (ProcessResult) เก็บไว้เพื่อเปิดดู/ดาวน์โหลดซ้ำ
  result: unknown;
}

function hasIDB(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
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

export async function saveProject(p: SavedProject): Promise<void> {
  if (!hasIDB()) throw new Error('เบราว์เซอร์ไม่รองรับการบันทึก (IndexedDB)');
  await run('readwrite', (s) => s.put(p));
}

export async function listProjects(): Promise<SavedProject[]> {
  if (!hasIDB()) return [];
  const all = await run<SavedProject[]>('readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getProject(id: string): Promise<SavedProject | undefined> {
  if (!hasIDB()) return undefined;
  return run<SavedProject | undefined>('readonly', (s) => s.get(id));
}

export async function deleteProject(id: string): Promise<void> {
  if (!hasIDB()) return;
  await run('readwrite', (s) => s.delete(id));
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
