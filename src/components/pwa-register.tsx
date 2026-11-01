'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import styles from './pwa-install.module.css';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type Platform = 'ios' | 'android' | 'desktop';
type InstallContextValue = { ready: boolean; installed: boolean; install: () => void };
const InstallContext = createContext<InstallContextValue>({ ready: false, installed: false, install: () => {} });
const DISMISSED_KEY = 'huriza-install-banner-dismissed';

export default function PwaRegister({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const { isKinyarwanda: rw } = useLanguage();

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop');
    const display = window.matchMedia('(display-mode: standalone)');
    const updateDisplay = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    updateDisplay();
    setReady(true);
    const capturePrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setShowInstructions(false); };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', onInstalled);
    display.addEventListener('change', updateDisplay);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('[HURIZA PWA] Service worker registration note:', error));
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', onInstalled);
      display.removeEventListener('change', updateDisplay);
    };
  }, []);

  const install = () => {
    if (!prompt) { setShowInstructions(true); return; }
    const deferred = prompt;
    setPrompt(null);
    void deferred.prompt().then(() => deferred.userChoice).catch(() => setShowInstructions(true));
  };

  return <InstallContext.Provider value={{ ready, installed, install }}>
    {children}
    {showInstructions && !installed && <aside className={styles.guide} aria-labelledby="install-guide-title">
      <button type="button" className={styles.close} onClick={() => setShowInstructions(false)} aria-label={rw ? 'Funga' : 'Close'}><X size={18} /></button>
      <span className={styles.icon}><Smartphone size={20} aria-hidden="true" /></span>
      <h2 id="install-guide-title">{rw ? 'Shyira HURIZA ku gikoresho cyawe' : 'Install HURIZA on your device'}</h2>
      <p>{platform === 'ios'
        ? (rw ? 'Fungura uru rubuga muri Safari, ukande Share, hanyuma uhitemo Add to Home Screen na Add.' : 'Open this page in Safari, tap Share, then choose Add to Home Screen and tap Add.')
        : platform === 'android'
          ? (rw ? 'Fungura menu ya browser (⋮), uhitemo Install app cyangwa Add to Home screen, hanyuma wemeze.' : 'Open your browser menu (⋮), choose Install app or Add to Home screen, and confirm.')
          : (rw ? 'Muri Chrome cyangwa Edge, fungura menu ya browser maze uhitemo Install HURIZA cyangwa Install this site as an app.' : 'In Chrome or Edge, open the browser menu and choose Install HURIZA or Install this site as an app.')}</p>
    </aside>}
  </InstallContext.Provider>;
}

export function InstallButton({ variant = 'default' }: { variant?: 'default' | 'footer' }) {
  const { ready, installed, install } = useContext(InstallContext);
  const { isKinyarwanda: rw } = useLanguage();
  if (!ready || installed) return null;
  return <button type="button" className={variant === 'footer' ? styles.footerButton : styles.button} onClick={install}><Download size={16} aria-hidden="true" />{rw ? 'Shyiraho HURIZA' : 'Install HURIZA app'}</button>;
}

export function InstallBanner() {
  const { ready, installed } = useContext(InstallContext);
  const { isKinyarwanda: rw } = useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ready || installed) return;
    try { if (localStorage.getItem(DISMISSED_KEY)) return; } catch { /* Storage can be unavailable. */ }
    const timer = window.setTimeout(() => setVisible(true), 8000);
    return () => window.clearTimeout(timer);
  }, [ready, installed]);
  if (!visible || installed) return null;
  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* Dismiss for this visit. */ }
  };
  return <aside className={styles.banner} aria-label={rw ? 'Shyiraho HURIZA' : 'Install HURIZA'}>
    <button type="button" className={styles.close} onClick={dismiss} aria-label={rw ? 'Funga' : 'Dismiss'}><X size={18} /></button>
    <span className={styles.icon}><Smartphone size={20} aria-hidden="true" /></span>
    <div><strong>{rw ? 'HURIZA hafi yawe' : 'Keep HURIZA close'}</strong><p>{rw ? 'Shyira HURIZA kuri terefoni cyangwa mudasobwa yawe.' : 'Add HURIZA to your phone or computer for easy access.'}</p></div>
    <InstallButton />
  </aside>;
}
