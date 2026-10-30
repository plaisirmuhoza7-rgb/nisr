import type { QueuedAction, SyncStatus } from './types';
import { getAllActions, getPendingActions, updateAction, removeAction, clearSyncedActions } from './storage';

type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notify();
        void this.syncNow();
      });

      window.addEventListener('offline', () => {
        this.notify();
      });

      // Listen for Service Worker background sync messages
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'HURIZA_SYNC_REQUESTED') {
            void this.syncNow();
          }
        });
      }
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    void this.getStatus().then((status) => listener(status));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getStatus(): Promise<SyncStatus> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pending = await getPendingActions();
    return {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError
    };
  }

  private notify(): void {
    void this.getStatus().then((status) => {
      this.listeners.forEach((listener) => {
        try {
          listener(status);
        } catch (e) {
          console.error('[SyncEngine] Listener error:', e);
        }
      });
    });
  }

  public async syncNow(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pending = await getPendingActions();

      for (const item of pending) {
        // Attempt sending to server
        await updateAction(item.id, {
          status: 'syncing',
          attempts: item.attempts + 1
        });
        this.notify();

        try {
          const res = await fetch(item.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });

          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            await updateAction(item.id, {
              status: 'synced',
              lastError: undefined
            });
            syncedCount++;
          } else {
            // Server error / rejection
            const errMsg = data.error || `Server responded with status ${res.status}`;
            await updateAction(item.id, {
              status: 'failed',
              lastError: errMsg
            });
            failedCount++;
            this.lastError = errMsg;
          }
        } catch (fetchErr) {
          // Network interruption mid-sync: keep it pending to try next time
          console.warn('[SyncEngine] Network failed during sync attempt:', fetchErr);
          await updateAction(item.id, {
            status: 'pending'
          });
          // Abort further requests since connection was lost
          break;
        }

        this.notify();
      }

      this.lastSyncTime = new Date().toISOString();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('huriza:sync-complete', {
            detail: { synced: syncedCount, failed: failedCount }
          })
        );
      }
    } catch (err) {
      console.error('[SyncEngine] Sync error:', err);
      this.lastError = err instanceof Error ? err.message : 'Synchronization failed.';
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return { synced: syncedCount, failed: failedCount };
  }
}

export const syncEngine = new SyncEngine();

export function describeAction(payload: Record<string, unknown>, isRw: boolean): string {
  const action = String(payload.action || 'action');
  const amount = typeof payload.amount === 'number' ? `${payload.amount.toLocaleString()} Frw` : '';

  switch (action) {
    case 'contribute':
      return isRw
        ? `Umusanzu w’itsinda${amount ? ` (${amount})` : ''}`
        : `Group contribution${amount ? ` (${amount})` : ''}`;
    case 'createGoal':
      return isRw
        ? `Intego yo kuzigama: ${payload.name || ''}`
        : `Savings goal: ${payload.name || ''}`;
    case 'addGoalSavings':
      return isRw
        ? `Kuzigama ku ntego${amount ? ` (${amount})` : ''}`
        : `Added savings to goal${amount ? ` (${amount})` : ''}`;
    case 'deleteGoal':
      return isRw ? 'Gusiba intego yo kuzigama' : 'Deleted savings goal';
    case 'recordPersonalExpense':
      return isRw
        ? `Amafaranga yasohotse${amount ? ` (${amount})` : ''}: ${payload.note || payload.category || ''}`
        : `Personal expense${amount ? ` (${amount})` : ''}: ${payload.note || payload.category || ''}`;
    case 'recordPersonalIncome':
      return isRw
        ? `Amafaranga yinjiye${amount ? ` (${amount})` : ''}: ${payload.source || ''}`
        : `Personal income${amount ? ` (${amount})` : ''}: ${payload.source || ''}`;
    case 'requestLoan':
      return isRw
        ? `Gusaba inguzanyo${amount ? ` (${amount})` : ''}`
        : `Loan request${amount ? ` (${amount})` : ''}`;
    case 'repay':
      return isRw
        ? `Kwishyura inguzanyo${amount ? ` (${amount})` : ''}`
        : `Loan repayment${amount ? ` (${amount})` : ''}`;
    case 'confirmPayment':
      return isRw ? 'Kwemeza ubwishyu' : 'Payment confirmation';
    default:
      return `${action}${amount ? ` (${amount})` : ''}`;
  }
}
