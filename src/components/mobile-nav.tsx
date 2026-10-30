'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import {
  Wallet,
  Users,
  Landmark,
  HeartHandshake,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  X
} from 'lucide-react';
import styles from './mobile-nav.module.css';
import { useState } from 'react';

interface MobileNavProps {
  onOpenSync: () => void;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  deferredPrompt?: any;
  onInstallApp?: () => void;
  workspaces?: string[];
}

export default function MobileNav({
  onOpenSync,
  isOnline,
  isSyncing,
  pendingCount,
  deferredPrompt,
  onInstallApp,
  workspaces
}: MobileNavProps) {
  const pathname = usePathname();
  const { isKinyarwanda } = useLanguage();
  const [dismissInstall, setDismissInstall] = useState(false);

  // Filter items based on user's authorized workspaces if provided
  const hasAccess = (ws: string) => !workspaces || workspaces.includes(ws);

  return (
    <>
      {/* Optional Mobile PWA Install Banner */}
      {deferredPrompt && !dismissInstall && (
        <aside className={styles.installBanner} aria-label="Install App">
          <div className={styles.installInfo}>
            <span className={styles.appIcon}>H</span>
            <div>
              <strong>{isKinyarwanda ? 'Koresha nka Porogaramu' : 'Install HURIZA App'}</strong>
              <small>
                {isKinyarwanda
                  ? 'Fungura vuba, ikore n’iyo nta murongo.'
                  : 'Fast mobile app with offline sync support.'}
              </small>
            </div>
          </div>
          <div className={styles.installBtns}>
            <button className={styles.installBtn} onClick={onInstallApp}>
              <Download size={13} /> {isKinyarwanda ? 'Yishyireho' : 'Install'}
            </button>
            <button
              className={styles.dismissBtn}
              onClick={() => setDismissInstall(true)}
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav className={styles.bottomBar} aria-label="Mobile Navigation">
        {hasAccess('personal') && (
          <Link
            href="/app/personal"
            className={`${styles.tabItem} ${pathname === '/app/personal' ? styles.active : ''}`}
          >
            <Wallet size={20} />
            <span>{isKinyarwanda ? 'Bwite' : 'Personal'}</span>
          </Link>
        )}

        {hasAccess('groups') && (
          <Link
            href="/app/groups"
            className={`${styles.tabItem} ${pathname === '/app/groups' ? styles.active : ''}`}
          >
            <Users size={20} />
            <span>{isKinyarwanda ? 'Amatsinda' : 'Groups'}</span>
          </Link>
        )}

        {hasAccess('cooperative') && (
          <Link
            href="/app/cooperative"
            className={`${styles.tabItem} ${pathname === '/app/cooperative' ? styles.active : ''}`}
          >
            <Landmark size={20} />
            <span>{isKinyarwanda ? 'Koperative' : 'Coop'}</span>
          </Link>
        )}

        {hasAccess('fundraising') && (
          <Link
            href="/app/fundraising"
            className={`${styles.tabItem} ${pathname === '/app/fundraising' ? styles.active : ''}`}
          >
            <HeartHandshake size={20} />
            <span>{isKinyarwanda ? 'Ikigega' : 'Fund'}</span>
          </Link>
        )}

        {/* Sync Center Tab Item */}
        <button
          type="button"
          onClick={onOpenSync}
          className={`${styles.tabItem} ${styles.syncTab} ${
            !isOnline ? styles.offlineTab : pendingCount > 0 ? styles.pendingTab : ''
          }`}
          aria-label={
            isKinyarwanda
              ? `Guhuza amakuru (${pendingCount} bitegereje)`
              : `Sync Center (${pendingCount} pending)`
          }
        >
          <div className={styles.iconContainer}>
            {isSyncing ? (
              <RefreshCw size={20} className={styles.spin} />
            ) : !isOnline ? (
              <WifiOff size={20} />
            ) : (
              <Wifi size={20} />
            )}
            {pendingCount > 0 && <span className={styles.badge}>{pendingCount}</span>}
          </div>
          <span>
            {isSyncing
              ? isKinyarwanda
                ? 'Birahuza…'
                : 'Syncing…'
              : !isOnline
                ? isKinyarwanda
                  ? 'Nta murongo'
                  : 'Offline'
                : isKinyarwanda
                  ? 'Guhuza'
                  : 'Sync'}
          </span>
        </button>
      </nav>
    </>
  );
}
