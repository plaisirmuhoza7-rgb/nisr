'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Leaf,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import LanguageToggle from '@/components/language-toggle';
import BrandLogo from '@/components/brand-logo';
import styles from './contact.module.css';

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  topic: string;
  hp: string;
}

const TOPICS_EN = ['General', 'Savings Groups', 'Partnerships', 'Support'];
const TOPICS_RW = ['Rusange', 'Itsinda & Ikimina', 'Ubufatanye', 'Ubufasha'];

export default function ContactPage() {
  const { t, isKinyarwanda } = useLanguage();
  const topics = isKinyarwanda ? TOPICS_RW : TOPICS_EN;

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    topic: topics[0],
    hp: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText('0782557168');
    setCopiedPhone(true);
    showToast(isKinyarwanda ? 'Nomero 0782557168 yakuweho!' : '0782557168 copied to clipboard!');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!form.name.trim()) {
      setErrorMessage(isKinyarwanda ? 'Andika amazina yawe.' : 'Please enter your name.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setErrorMessage(isKinyarwanda ? 'Andika imeri yuzuye.' : 'Please enter a valid email.');
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 5) {
      setErrorMessage(isKinyarwanda ? 'Andika ubutumwa burambuye.' : 'Please enter your message.');
      return;
    }

    setIsSubmitting(true);

    try {
      const subjectText = form.subject.trim() || form.topic;
      const payloadSubject = `[${form.topic}] ${subjectText}`;

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          subject: payloadSubject,
          message: form.message.trim(),
          hp: form.hp,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || (isKinyarwanda ? 'Kwohereza byanze. Gerageza nanone.' : 'Failed to send message. Please retry.'));
      }

      setSubmitted(true);
      setForm({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        topic: topics[0],
        hp: '',
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        {t.common.skipToContent}
      </a>

      {/* Clean Minimalist Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="HURIZA home">
          <BrandLogo size={32} />
          <span>HURIZA</span>
        </Link>
        <div className={styles.headerActions}>
          <LanguageToggle />
          <nav className={styles.navLinks} aria-label="Main navigation">
            <Link href="/">{t.nav.home}</Link>
            <Link href="/about">{t.nav.about}</Link>
            <Link href="/demo">{t.nav.demo}</Link>
            <Link href="/signup" className={styles.navCta}>
              {t.common.signUp} <ArrowRight size={13} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main id="main-content" className={styles.main}>
        {/* Minimalist Hero */}
        <section className={styles.hero}>
          <div className={styles.badge}>
            <span className={styles.yellowDot} aria-hidden="true" />
            {isKinyarwanda ? 'Turi hano ku bwawe' : 'We respond within 24 hours'}
          </div>
          <h1 className={styles.title}>
            {isKinyarwanda ? 'Kuvugana natwe.' : 'Let’s start a '}<span className={styles.titleAccent}>{isKinyarwanda ? 'Mu buryo bworoshye' : 'conversation.'}</span>
          </h1>
          <p className={styles.subtitle}>
            {isKinyarwanda
              ? 'Hamagara kuri 0782557168 cyangwa wohereze ubutumwa bugera kuri imeri yacu ako kanya.'
              : 'Call us directly at 0782557168 or send a direct message below. We are here to help.'}
          </p>
        </section>

        {/* 2-Column Minimalist Layout */}
        <div className={styles.contactGrid}>
          {/* Left Column: Direct Contact Info */}
          <div className={styles.sideColumn}>
            {/* Direct Hotline Card */}
            <div className={styles.hotlineCard}>
              <div className={styles.hotlineGlow} aria-hidden="true" />
              <div className={styles.hotlineHeader}>
                <span className={styles.hotlineTag}>
                  ★ {isKinyarwanda ? 'Murongo wihuse' : 'Direct Line'}
                </span>
                <PhoneCall size={18} color="#FACC15" />
              </div>
              <div className={styles.hotlineNumber}>0782557168</div>
              <div className={styles.hotlineHours}>
                {isKinyarwanda
                  ? 'Kuwa Mbere - Kuwa Gatandatu, 8:00 - 18:00 CAT'
                  : 'Mon - Sat: 8:00 AM - 6:00 PM CAT (Kigali)'}
              </div>
              <div className={styles.hotlineActions}>
                <a href="tel:0782557168" className={styles.callButton}>
                  <Phone size={14} /> {isKinyarwanda ? 'Hamagara ako kanya' : 'Call now'}
                </a>
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={handleCopyPhone}
                  title="Copy 0782557168"
                  aria-label="Copy phone number"
                >
                  {copiedPhone ? <Check size={16} color="#FACC15" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* WhatsApp */}
            <a
              href="https://wa.me/250782557168?text=Hello%20HURIZA%20Team%2C%20I%20would%20like%20to%20learn%20more."
              target="_blank"
              rel="noopener noreferrer"
              className={styles.channelCard}
            >
              <div className={styles.channelLeft}>
                <div className={styles.channelIcon}>
                  <MessageSquare size={18} />
                </div>
                <div className={styles.channelMeta}>
                  <small>WhatsApp</small>
                  <strong>+250 782 557 168</strong>
                </div>
              </div>
              <ArrowUpRight size={17} className={styles.channelActionIcon} />
            </a>

            {/* Email */}
            <a
              href="mailto:plaisirmuhoza7@gmail.com?subject=Inquiry%20via%20HURIZA"
              className={styles.channelCard}
            >
              <div className={styles.channelLeft}>
                <div className={styles.channelIcon}>
                  <Mail size={18} />
                </div>
                <div className={styles.channelMeta}>
                  <small>{isKinyarwanda ? 'Imeri' : 'Email'}</small>
                  <strong>plaisirmuhoza7@gmail.com</strong>
                </div>
              </div>
              <ArrowUpRight size={17} className={styles.channelActionIcon} />
            </a>

            {/* Location */}
            <div className={styles.channelCard} style={{ cursor: 'default' }}>
              <div className={styles.channelLeft}>
                <div className={styles.channelIcon}>
                  <MapPin size={18} />
                </div>
                <div className={styles.channelMeta}>
                  <small>{isKinyarwanda ? 'Icyicaro' : 'Location'}</small>
                  <strong>Kigali, Rwanda</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Form */}
          <div className={styles.formBox}>
            {submitted ? (
              <div className={styles.successView}>
                <div className={styles.successIcon}>
                  <CheckCircle2 size={30} />
                </div>
                <h3>{isKinyarwanda ? 'Ubutumwa bwakiriwe!' : 'Message received!'}</h3>
                <p>
                  {isKinyarwanda
                    ? 'Ubutumwa bwawe bwoherejwe kuri imeri yacu binyuze kuri Resend. Turagusubiza vuba cyane.'
                    : 'Your message was delivered directly via Resend to our inbox. We will be in touch promptly.'}
                </p>
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={() => setSubmitted(false)}
                >
                  {isKinyarwanda ? 'Ohereza ubundi butumwa' : 'Send another message'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className={styles.formHeader}>
                  <h2>{isKinyarwanda ? 'Twandikire' : 'Send a message'}</h2>
                  <p>
                    {isKinyarwanda
                      ? 'Ubutumwa bwawe buhita bwoherezwa kuri imeri yacu.'
                      : 'Fill in your details below and we will get back to you.'}
                  </p>
                </div>

                {errorMessage && (
                  <div className={styles.errorBox} role="alert">
                    {errorMessage}
                  </div>
                )}

                {/* Topic Pills */}
                <div className={styles.topics}>
                  {topics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`${styles.topicPill} ${form.topic === item ? styles.topicActive : ''}`}
                      onClick={() => setForm({ ...form, topic: item })}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {/* Row 1: Name & Email */}
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label htmlFor="contact-name">
                      {isKinyarwanda ? 'Amazina' : 'Your Name'} *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      className={styles.input}
                      placeholder={isKinyarwanda ? 'Amazina yawe' : 'e.g. John'}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="contact-email">
                      {isKinyarwanda ? 'Imeri' : 'Email Address'} *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      className={styles.input}
                      placeholder="name@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Field 2: Phone */}
                <div className={styles.field}>
                  <label htmlFor="contact-phone">
                    {isKinyarwanda ? 'Telefone (niba ubishaka)' : 'Phone (optional)'}
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    className={styles.input}
                    placeholder="0782557168"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Field 3: Message */}
                <div className={styles.field}>
                  <label htmlFor="contact-message">
                    {isKinyarwanda ? 'Ubutumwa' : 'Your Message'} *
                  </label>
                  <textarea
                    id="contact-message"
                    className={styles.textarea}
                    placeholder={
                      isKinyarwanda
                        ? 'Andika ubutumwa bwawe hano...'
                        : 'How can we help you or your group?'
                    }
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    disabled={isSubmitting}
                    rows={3}
                  />
                </div>

                {/* Honeypot field */}
                <input
                  type="text"
                  name="hp_trap"
                  className={styles.honeypot}
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.hp}
                  onChange={(e) => setForm({ ...form, hp: e.target.value })}
                />

                {/* Submit button */}
                <button
                  type="submit"
                  className={styles.sendButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      {isKinyarwanda ? 'Birimo koherezwa...' : 'Sending...'}
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      {isKinyarwanda ? 'Ohereza ubutumwa' : 'Send message'}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className={styles.footer}>
        <div>© {new Date().getFullYear()} HURIZA &bull; Kigali, Rwanda</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/about">{t.footer.about}</Link>
          <Link href="/privacy">{t.footer.privacy}</Link>
          <Link href="/terms">{t.footer.terms}</Link>
          <a href="tel:0782557168">0782557168</a>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast} role="status">
          <Check size={15} color="#FACC15" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
