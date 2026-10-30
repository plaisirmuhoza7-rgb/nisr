'use client';

import Link from 'next/link';
import s from '../info.module.css';
import { BRAND } from '@/lib/brand';
import { useLanguage } from '@/lib/i18n/context';
import LanguageToggle from '@/components/language-toggle';
import BrandLogo from '@/components/brand-logo';

export default function Methodology() {
  const { t, isKinyarwanda } = useLanguage();

  return (
    <main className={s.page}>
      <header className={s.nav}>
        <Link className={s.brand} href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BrandLogo size={28} /> {BRAND.name.toLowerCase()}</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <LanguageToggle />
          <nav className={s.links}>
            <Link href="/about">{t.footer.about}</Link>
            <Link href="/demo">{t.footer.productDemo}</Link>
          </nav>
        </div>
      </header>
      <div className={s.main}>
        <p className={s.eyebrow}>{isKinyarwanda ? 'Uko HURIZA ikora' : 'How HURIZA works'}</p>
        <h1 className={s.title}>
          {isKinyarwanda ? <>Ibyashingiweho byumvikana.<br/>Imyanzuro isobanutse.</> : <>Clear assumptions.<br/>Understandable decisions.</>}
        </h1>
        <p className={s.intro}>
          {isKinyarwanda
            ? 'HURIZA ni urubuga rw’icyitegererezo rw’imari rusange. Ingero zose ziri hano ni iz’igerageza; ntabwo ari amakuru y’abantu nyakuri cyangwa amatsinda ariho.'
            : 'HURIZA is a financial workspace prototype. Product examples are fictional and labeled; they are not reports about real people, groups or outcomes.'}
        </p>
        <div className={s.grid}>
          <article className={s.card}>
            <h2>{isKinyarwanda ? 'Gahunda yo kuzigama' : 'Savings plans'}</h2>
            <p>{isKinyarwanda ? 'Ibarura ry’ubwizigame bwite rikoresha amafaranga y’u Rwanda yuzuye (Frw). Nta nyungu z’umurengera, amafaranga y’inyongera, cyangwa ihinduka rya konti bibamo.' : 'Personal projections use whole Rwandan francs and round monthly contributions up to the next franc. They include no interest, fees, provider activity or account changes.'}</p>
          </article>
          <article className={s.card}>
            <h2>{isKinyarwanda ? 'Uburyo bw’amatsinda' : 'Group models'}</h2>
            <p>{isKinyarwanda ? 'Itsinda n’Ikimina byerekanwa nk’uburyo bubiri butandukanye bwo kuzigama mu matsinda, bifite imikorere n’igihe cy’ubwishyu bitandukanye. Ibikorwa byose ni iby’icyitegererezo.' : 'Itsinda and Ikimina are represented as separate group savings models, with different contribution and payout timing. Group activity in the public demo is simulated.'}</p>
          </article>
          <article className={s.card}>
            <h2>{isKinyarwanda ? 'Igerageza rya Guardian' : 'Guardian scenarios'}</h2>
            <p>{isKinyarwanda ? 'Ibarura rya Guardian rishingira ku mibare yashyizwemo kugira ngo ryerekane uko icyemezo cyifujwe cyahindura ikigega. Ni igikoresho cyo gusobanura kandi ntiryemeza inguzanyo.' : 'Guardian calculations use stated inputs to show how a proposed decision could affect a reserve. A scenario is explanatory and cannot approve or perform a transaction.'}</p>
          </article>
          <article className={s.card}>
            <h2>{isKinyarwanda ? 'Umutekano n’inyandiko' : 'Access and records'}</h2>
            <p>{isKinyarwanda ? 'Imyanya y’akazi icungirwa kuri buri konti n’uburenganzira bw’itsinda. Inyandiko zose z’imari n’ubwishyu muri iri gerageza ntizikora ku mafaranga nyakuri.' : 'Private workspaces are scoped to an account and authorized organization membership. Demonstration records and payment flows do not move real money.'}</p>
          </article>
        </div>
        <div className={s.banner}>
          {isKinyarwanda
            ? 'Iri gerageza ntabwo ari banki, ikigo cyemewe cyo kwakira ubwizigame, ibiro by’inguzanyo, cyangwa uburyo bwo kwishyura.'
            : 'This prototype is not a bank, licensed deposit-taker, official credit bureau, or live payment processor.'}
        </div>
      </div>
      <footer className={s.foot}>
        <span>{t.common.brandTagline}</span>
        <Link href="/">{isKinyarwanda ? '← Subira ahabanza' : 'Back to HURIZA home →'}</Link>
      </footer>
    </main>
  );
}
