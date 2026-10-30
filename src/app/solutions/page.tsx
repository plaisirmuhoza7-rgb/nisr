'use client';

import Link from 'next/link';
import s from '../info.module.css';
import Calculator from './calculator';
import { BRAND } from '@/lib/brand';
import { useLanguage } from '@/lib/i18n/context';
import LanguageToggle from '@/components/language-toggle';
import BrandLogo from '@/components/brand-logo';

export default function Solutions() {
  const { t, isKinyarwanda } = useLanguage();

  const cards: [string, string][] = isKinyarwanda ? [
    ['Amatsinda yo kuzigama', 'Inyandiko z’imisanzu, kwemeza inguzanyo mu bwisanzure, n’umucyo mu kigega. Gahunda yo kwishyura yagombye guhura n’ubushobozi bw’itsinda.'],
    ['Amakoperative', 'Inyandiko z’imigabane, imari ikora, no kureba imishinga muri gahunda imwe y’umuryango.'],
    ['Gushyira mu bikorwa n’ubufasha', 'Gutunganya porogaramu, gutangiza amatsinda, amahugurwa n’ubufasha buhoraho byajyana na serivisi z’imiryango.']
  ] : [
    ['Savings groups', 'Contribution records, independent loan approvals, and treasury visibility. A subscription would need to match a group’s capacity and demonstrated value.'],
    ['Cooperatives', 'Capital records, operating finance, and scenario planning in one organizational workspace.'],
    ['Implementation & support', 'Configuration, onboarding, training, and support could accompany organizational subscriptions.']
  ];

  return (
    <main className={s.page}>
      <header className={s.nav}>
        <Link className={s.brand} href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BrandLogo size={28} /> {BRAND.name.toLowerCase()}</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <LanguageToggle />
          <nav className={s.links}>
            <Link href="/about">{t.footer.about}</Link>
            <Link href="/demo?workspace=groups" className={s.button}>{isKinyarwanda ? 'Aho amatsinda akorera ↗' : 'Explore Groups workspace ↗'}</Link>
          </nav>
        </div>
      </header>
      <div className={s.main}>
        <p className={s.eyebrow}>{isKinyarwanda ? 'Ibisubizo ku nzego · Igitekerezo cy’umurongo' : 'Institutional solutions · Product hypothesis'}</p>
        <h1 className={s.title}>
          {isKinyarwanda ? <>Umucyo mu mari ku nzego<br/>zishyigikiye amatsinda.</> : <>Financial clarity for the<br/>organizations behind communities.</>}
        </h1>
        <p className={s.intro}>
          {isKinyarwanda
            ? 'Mu gihe kizaza, uburyo bwa HURIZA bushobora kuzana raporo zihamye, imiyoborere ifite umucyo, no gucunga neza umutungo w’amatsinda yo kuzigama n’amakoperative.'
            : 'A future HURIZA subscription could bring consistent reporting, transparent governance, and explainable treasury planning to savings groups and cooperatives.'}
        </p>
        <div className={s.grid}>
          {cards.map(([title, body]) => (
            <article className={s.card} key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <section className={s.section}>
          <Calculator />
        </section>
        <p className={s.intro}>
          {isKinyarwanda
            ? 'Nta bakiriya, ubufatanye bw’inzego, serivisi z’imari zemewe, cyangwa amafaranga byinjizwa byigambwa. Umucyo mu mari w’ibanze ugomba gukomeza kuboneka. Ibitekerezo by’ubucuruzi bisaba kubanza kwemezwa n’abakiriya nyir’izina.'
            : 'No customers, institutional partnerships, licensed financial services, or revenue are claimed. Basic financial transparency should remain accessible. Commercial hypotheses require direct customer validation.'}
        </p>
      </div>
      <footer className={s.foot}>
        <span>{t.common.brandTagline}</span>
        <Link href="/methodology">{isKinyarwanda ? 'Uko HURIZA ikora →' : 'How HURIZA works →'}</Link>
      </footer>
    </main>
  );
}
