'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import BrandLogo from './brand-logo';
import { useLanguage } from '@/lib/i18n/context';
import LanguageToggle from './language-toggle';
import styles from './landing-navigation.module.css';

export default function LandingNavigation() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();

  const links = [
    { label: t.nav.home, href: '/' },
    { label: t.nav.solutions, href: '#solutions' },
    { label: t.nav.guardian, href: '#guardian' },
    { label: t.nav.fundraising, href: '#fundraising' },
    { label: t.nav.about, href: '/about' },
    { label: t.nav.contact, href: '/contact' },
  ];

  useEffect(() => {
    if (!open) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const manageKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === triggerRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', manageKeyboard);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', manageKeyboard);
    };
  }, [open]);

  const close = () => setOpen(false);

  return <header className={styles.header}>
    <Link href="/" className={styles.brand} aria-label="HURIZA home" onClick={close}><BrandLogo size={36} priority /><strong>HURIZA</strong></Link>
    <nav className={styles.desktopNav} aria-label={t.nav.explore}>{links.map((link)=><Link href={link.href} key={link.href}>{link.label}</Link>)}</nav>
    <div className={styles.actions}>
      <LanguageToggle />
      <Link href="/login" className={styles.signIn}>{t.common.signIn}</Link>
      <Link href="/signup" className={styles.start}>{t.common.signUp} <ArrowRight size={15}/></Link>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className={styles.mobileToggle}><LanguageToggle compact /></span>
      <button ref={triggerRef} className={styles.menuButton} type="button" aria-label={open?t.nav.menuClose:t.nav.menuOpen} aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button>
    </div>
    {open&&<><button className={styles.scrim} type="button" aria-label={t.nav.menuClose} onClick={()=>{close();triggerRef.current?.focus();}}/><nav ref={drawerRef} id="mobile-navigation" className={styles.drawer} aria-label={t.nav.explore} aria-modal="true" role="dialog"><div className={styles.drawerHead}><strong>{t.nav.explore}</strong><div style={{display:'flex',alignItems:'center',gap:'8px'}}><LanguageToggle compact/><button type="button" aria-label={t.nav.menuClose} onClick={()=>{close();triggerRef.current?.focus();}}><X size={19}/></button></div></div>{links.map((link)=><Link href={link.href} key={link.href} onClick={close}>{link.label}<span>↗</span></Link>)}<div className={styles.drawerActions}><Link href="/login" onClick={close}>{t.common.signIn}</Link><Link href="/signup" className={styles.drawerStart} onClick={close}>{t.common.signUp} <ArrowRight size={15}/></Link></div></nav></>}
  </header>;
}


