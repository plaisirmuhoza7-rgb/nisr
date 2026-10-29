'use client';

import { useLanguage } from '@/lib/i18n/context';
import type { QueuedAction } from '@/lib/offline/types';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  X,
  Smartphone,
  Download
} from 'lucide-react';
import styles from './sync-modal.module.css';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
  actions: QueuedAction[];
  onSyncNow: () => Promise<{ synced: number; failed: number }>;
  onDeleteAction: (id: string) => Promise<void>;
  onClearCompleted: () => Promise<void>;
  deferredPrompt?: any;
  onInstallApp?: () => void;
}

export default function SyncModal({
  isOpen,
  onClose,
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncTime,
  lastError,
  actions,
  onSyncNow,
  onDeleteAction,
  onClearCompleted,
  deferredPrompt,
  onInstallApp
}: SyncModalProps) {
  const { isKinyarwanda } = useLanguage();

  if (!isOpen) return null;

  const syncedCount = actions.filter((a) => a.status === 'synced').length;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={`${styles.statusDot} ${isOnline ? styles.online : styles.offline}`}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            </div>
            <div>
              <h3>
                {isKinyarwanda ? 'Guhuza Amakuru n’Imikoreshereze' : 'Offline & Sync Center'}
              </h3>
              <p>
                {isOnline
                  ? isKinyarwanda
                    ? 'Wifashishije umurongo (Online) — Amakuru arahuzwa n’umubitsi'
                    : 'Connected to network — Live sync ready'
                  : isKinyarwanda
                    ? 'Nta murongo uriho (Offline) — Ibikorwa birabikwa muri telefone'
                    : 'Operating offline — All activity saved locally on your device'}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* PWA Mobile App Install Section */}
        {deferredPrompt && (
          <div className={styles.installBanner}>
            <div className={styles.installIcon}>
              <Smartphone size={22} />
            </div>
            <div className={styles.installCopy}>
              <strong>
                {isKinyarwanda ? 'Shyira Porogaramu kuri Telefone' : 'Install HURIZA Mobile App'}
              </strong>
              <small>
                {isKinyarwanda
                  ? 'Koresha HURIZA ku buryo bwa mobile n’iyo nta murongo w’interineti.'
                  : 'Fast mobile app experience with 100% offline access and instant loading.'}
              </small>
            </div>
            <button className={styles.installAction} onClick={onInstallApp}>
              <Download size={15} /> {isKinyarwanda ? 'Yishyireho' : 'Install'}
            </button>
          </div>
        )}

        {/* Summary Card */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryItem}>
            <span>{isKinyarwanda ? 'Ibikeneye guhuzwa' : 'Pending in queue'}</span>
            <strong className={pendingCount > 0 ? styles.amberText : styles.greenText}>
              {pendingCount}
            </strong>
          </div>
          <div className={styles.summaryItem}>
            <span>{isKinyarwanda ? 'Ibyamaze kwakirwa' : 'Synced on server'}</span>
            <strong>{syncedCount}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>{isKinyarwanda ? 'Igihe giheruka' : 'Last synchronized'}</span>
            <small>
              {lastSyncTime
                ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : isKinyarwanda
                  ? 'Ntibirakorwa'
                  : 'Not yet'}
            </small>
          </div>
        </div>

        {/* Action Controls */}
        <div className={styles.controlRow}>
          <button
            className={`${styles.button} ${styles.primaryBtn}`}
            onClick={() => void onSyncNow()}
            disabled={!isOnline || isSyncing || pendingCount === 0}
          >
            <RefreshCw size={15} className={isSyncing ? styles.spin : ''} />
            {isSyncing
              ? isKinyarwanda
                ? 'Birahuza amakuru…'
                : 'Synchronizing now…'
              : isKinyarwanda
                ? 'Huza Amakuru Ubu (Sync Now)'
                : 'Sync Now'}
          </button>

          {syncedCount > 0 && (
            <button
              className={`${styles.button} ${styles.quietBtn}`}
              onClick={() => void onClearCompleted()}
            >
              <Trash2 size={14} />
              {isKinyarwanda ? 'Siba ibyarangiye' : 'Clear completed'}
            </button>
          )}
        </div>

        {lastError && (
          <div className={styles.errorNotice}>
            <AlertCircle size={16} />
            <span>{lastError}</span>
          </div>
        )}

        {/* Queue Items List */}
        <div className={styles.listContainer}>
          <div className={styles.listHeader}>
            <h4>{isKinyarwanda ? 'Urutonde rw’ibikorwa byo guhuza' : 'Queued Outbox Transactions'}</h4>
            <span className={styles.listBadge}>{actions.length}</span>
          </div>

          {actions.length === 0 ? (
            <div className={styles.emptyOutbox}>
              <CheckCircle2 size={32} />
              <p>
                {isKinyarwanda
                  ? 'Nta gikorwa gitegereje guhuzwa. Byose birahuza neza!'
                  : 'All transactions are synchronized with the server. Your outbox is clean!'}
              </p>
            </div>
          ) : (
            <div className={styles.actionList}>
              {actions.map((item) => (
                <div key={item.id} className={styles.actionRow}>
                  <div className={styles.actionMeta}>
                    <div className={styles.actionHeading}>
                      <span className={styles.actionTitle}>{item.summary}</span>
                      <span className={`${styles.badge} ${styles[item.status]}`}>
                        {item.status === 'pending' && (
                          <>
                            <Clock size={11} /> {isKinyarwanda ? 'Bitegereje' : 'Pending'}
                          </>
                        )}
                        {item.status === 'syncing' && (
                          <>
                            <RefreshCw size={11} className={styles.spin} />{' '}
                            {isKinyarwanda ? 'Birahuza…' : 'Syncing…'}
                          </>
                        )}
                        {item.status === 'synced' && (
                          <>
                            <CheckCircle2 size={11} /> {isKinyarwanda ? 'Byahuye' : 'Synced'}
                          </>
                        )}
                        {item.status === 'failed' && (
                          <>
                            <AlertCircle size={11} /> {isKinyarwanda ? 'Byanze' : 'Failed'}
                          </>
                        )}
                      </span>
                    </div>

                    <div className={styles.actionSub}>
                      <span>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <span>·</span>
                      <span className={styles.workspaceTag}>{item.workspace}</span>
                      {item.attempts > 1 && (
                        <span>
                          · {item.attempts} {isKinyarwanda ? 'igeragezwa' : 'attempts'}
                        </span>
                      )}
                    </div>

                    {item.lastError && (
                      <div className={styles.itemError}>
                        <AlertCircle size={12} /> {item.lastError}
                      </div>
                    )}
                  </div>

                  <div className={styles.actionBtns}>
                    <button
                      className={styles.deleteBtn}
                      title={isKinyarwanda ? 'Kuraho' : 'Discard action'}
                      onClick={() => void onDeleteAction(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
