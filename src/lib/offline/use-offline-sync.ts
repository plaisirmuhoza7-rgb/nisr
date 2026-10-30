'use client';

import { useEffect, useState, useCallback } from 'react';
import type { QueuedAction, SyncStatus } from './types';
import { syncEngine } from './sync-engine';
import { getAllActions, removeAction, clearSyncedActions } from './storage';

export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    // Keep server and first browser render identical; the subscription reads the actual status after hydration.
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null
  });
  const [actions, setActions] = useState<QueuedAction[]>([]);

  const loadActions = useCallback(async () => {
    try {
      const items = await getAllActions();
      setActions(items);
    } catch {}
  }, []);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
      void loadActions();
    });

    const handleSyncComplete = () => {
      void loadActions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('huriza:sync-complete', handleSyncComplete);
    }

    void loadActions();

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('huriza:sync-complete', handleSyncComplete);
      }
    };
  }, [loadActions]);

  const syncNow = useCallback(async () => {
    const res = await syncEngine.syncNow();
    await loadActions();
    return res;
  }, [loadActions]);

  const deleteAction = useCallback(async (id: string) => {
    await removeAction(id);
    await loadActions();
  }, [loadActions]);

  const clearCompleted = useCallback(async () => {
    await clearSyncedActions();
    await loadActions();
  }, [loadActions]);

  return {
    ...status,
    actions,
    syncNow,
    deleteAction,
    clearCompleted,
    refreshActions: loadActions
  };
}
