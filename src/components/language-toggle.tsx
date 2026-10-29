'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import styles from './language-toggle.module.css';

interface LanguageToggleProps {
  compact?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export default function LanguageToggle({
  compact = false,
  theme = 'light',
  className = '',
}: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectLanguage = (lang: 'en' | 'rw') => {
    setLanguage(lang);
    setOpen(false);
  };

  return (
    <div
      className={`${styles.container} ${compact ? styles.compact : ''} ${
        theme === 'dark' ? styles.dark : ''
      } ${className}`}
      ref={dropdownRef}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.globeButton} ${open ? styles.globeButtonActive : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Change language / Guhitamo ururimi"
        title={language === 'en' ? 'Language: English' : 'Ururimi: Ikinyarwanda'}
      >
        <Globe size={compact ? 16 : 18} className={styles.globeIcon} aria-hidden="true" />
        <span className={styles.badge}>{language.toUpperCase()}</span>
      </button>

      {open && (
        <div className={styles.dropdown} role="menu" aria-label="Languages">
          <div className={styles.dropdownTitle}>
            {language === 'rw' ? 'Hitamo ururimi' : 'Select language'}
          </div>
          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${language === 'en' ? styles.menuItemActive : ''}`}
            onClick={() => selectLanguage('en')}
          >
            <div className={styles.itemText}>
              <strong>English</strong>
              <small>EN</small>
            </div>
            {language === 'en' && (
              <span className={styles.check}>
                <Check size={14} aria-hidden="true" />
              </span>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${language === 'rw' ? styles.menuItemActive : ''}`}
            onClick={() => selectLanguage('rw')}
          >
            <div className={styles.itemText}>
              <strong>Ikinyarwanda</strong>
              <small>RW</small>
            </div>
            {language === 'rw' && (
              <span className={styles.check}>
                <Check size={14} aria-hidden="true" />
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
