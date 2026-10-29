import type { QueuedAction, CachedStateEnvelope } from './types';

const DB_NAME = 'huriza_offline_db';
const DB_VERSION = 1;
const STORE_STATE = 'state_cache';
const STORE_OUTBOX = 'offline_outbox';

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      return reject(new Error('IndexedDB is not available.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        outboxStore.createIndex('by_status', 'status', { unique: false });
        outboxStore.createIndex('by_created', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// LocalStorage fallbacks
const LS_STATE_PREFIX = 'huriza_state_cache:';
const LS_OUTBOX_KEY = 'huriza_offline_outbox';

function getLocalStorageOutbox(): QueuedAction[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(LS_OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageOutbox(actions: QueuedAction[]): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(LS_OUTBOX_KEY, JSON.stringify(actions));
  } catch {}
}

export async function getCachedState<T>(key: string): Promise<CachedStateEnvelope<T> | null> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_STATE, 'readonly');
        const store = tx.objectStore(STORE_STATE);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as CachedStateEnvelope<T>) || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage on error
    }
  }

  if (hasLocalStorage()) {
    try {
      const raw = localStorage.getItem(`${LS_STATE_PREFIX}${key}`);
      return raw ? (JSON.parse(raw) as CachedStateEnvelope<T>) : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function setCachedState<T>(key: string, data: T): Promise<void> {
  const envelope: CachedStateEnvelope<T> = {
    key,
    data,
    savedAt: new Date().toISOString()
  };

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_STATE, 'readwrite');
        const store = tx.objectStore(STORE_STATE);
        const req = store.put(envelope);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch {
      // Fallback to localStorage on error
    }
  }

  if (hasLocalStorage()) {
    try {
      localStorage.setItem(`${LS_STATE_PREFIX}${key}`, JSON.stringify(envelope));
    } catch {}
  }
}

export async function enqueueAction(
  item: Omit<QueuedAction, 'id' | 'createdAt' | 'status' | 'attempts'>
): Promise<QueuedAction> {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const queued: QueuedAction = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0
  };

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_OUTBOX);
        const req = store.put(queued);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return queued;
    } catch {
      // Fallback to localStorage on error
    }
  }

  if (hasLocalStorage()) {
    const outbox = getLocalStorageOutbox();
    outbox.push(queued);
    saveLocalStorageOutbox(outbox);
  }

  return queued;
}

export async function getAllActions(): Promise<QueuedAction[]> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_OUTBOX, 'readonly');
        const store = tx.objectStore(STORE_OUTBOX);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = (req.result as QueuedAction[]) || [];
          results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage on error
    }
  }

  if (hasLocalStorage()) {
    const outbox = getLocalStorageOutbox();
    outbox.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return outbox;
  }

  return [];
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  const all = await getAllActions();
  return all.filter((a) => a.status === 'pending' || a.status === 'failed');
}

export async function updateAction(id: string, update: Partial<QueuedAction>): Promise<void> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_OUTBOX);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          if (!getReq.result) {
            resolve();
            return;
          }
          const updated = { ...getReq.result, ...update };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
      return;
    } catch {
      // Fallback to localStorage on error
    }
  }

  if (hasLocalStorage()) {
    const outbox = getLocalStorageOutbox();
    const index = outbox.findIndex((a) => a.id === id);
    if (index !== -1) {
      outbox[index] = { ...outbox[index], ...update };
      saveLocalStorageOutbox(outbox);
    }
  }
}

export async function removeAction(id: string): Promise<void> {
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_OUTBOX);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch {
      // Fallback to localStorage on error
    }
  }

  if (hasLocalStorage()) {
    const outbox = getLocalStorageOutbox().filter((a) => a.id !== id);
    saveLocalStorageOutbox(outbox);
  }
}

export async function clearSyncedActions(): Promise<void> {
  const all = await getAllActions();
  const synced = all.filter((a) => a.status === 'synced');
  for (const item of synced) {
    await removeAction(item.id);
  }
}
