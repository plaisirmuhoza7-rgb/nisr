export interface QueuedAction {
  id: string;
  action: string;
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  attempts: number;
  lastError?: string;
  summary: string;
  workspace: string;
}

export interface CachedStateEnvelope<T = unknown> {
  key: string;
  data: T;
  savedAt: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}
