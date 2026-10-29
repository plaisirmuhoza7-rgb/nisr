'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp, Clock3, PiggyBank, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { savingsPlan } from '@/lib/guardian';
import { useLanguage } from '@/lib/i18n/context';
import styles from './finance-planning.module.css';

const LIMIT = 1_000_000_000_000n;

type FieldResult = { value: number | null; error: string };

function readInteger(raw: string, label: string, min: bigint, max: bigint, isRw: boolean): FieldResult {
  if (!raw) return { value: null, error: isRw ? `${label} irakenewe.` : `${label} is required.` };
  if (!/^\d+$/.test(raw)) return { value: null, error: isRw ? 'Injiza imibare yuzuye gusa.' : 'Enter whole numbers only.' };
  const normalized = raw.replace(/^0+(?=\d)/, '');
  if (normalized.length > max.toString().length) {
    return { value: null, error: isRw ? `${label} igomba kuba hagati ya ${min.toLocaleString('rw-RW')} na ${max.toLocaleString('rw-RW')}.` : `${label} must be between ${min.toLocaleString('en-RW')} and ${max.toLocaleString('en-RW')}.` };
  }
  const amount = BigInt(normalized);
  if (amount < min || amount > max) {
    return { value: null, error: isRw ? `${label} igomba kuba hagati ya ${min.toLocaleString('rw-RW')} na ${max.toLocaleString('rw-RW')}.` : `${label} must be between ${min.toLocaleString('en-RW')} and ${max.toLocaleString('en-RW')}.` };
  }
  return { value: Number(amount), error: '' };
}

export default function FinancePlanning() {
  const { t, isKinyarwanda } = useLanguage();
  const [targetText, setTargetText] = useState('120000');
  const [savedText, setSavedText] = useState('35000');
  const [monthsText, setMonthsText] = useState('8');

  const money = (amount: number) => `${amount.toLocaleString(isKinyarwanda ? 'rw-RW' : 'en-RW')} ${t.common.rwf}`;

  const target = readInteger(targetText, isKinyarwanda ? 'Amafaranga y’intego' : 'Savings target', 1n, LIMIT, isKinyarwanda);
  const saved = readInteger(savedText, isKinyarwanda ? 'Ayo umaze kuzigama' : 'Current saved amount', 0n, LIMIT, isKinyarwanda);
  const months = readInteger(monthsText, isKinyarwanda ? 'Umubare w’amezi' : 'Number of months', 1n, 600n, isKinyarwanda);
  const valid = target.value !== null && saved.value !== null && months.value !== null;
  const plan = useMemo(() => {
    if (!valid) return null;
    try {
      return savingsPlan(target.value!, saved.value!, months.value!);
    } catch {
      return null;
    }
  }, [valid, target.value, saved.value, months.value]);

  const progress = valid && target.value !== null && saved.value !== null
    ? Number((BigInt(Math.min(saved.value, target.value)) * 100n) / BigInt(target.value))
    : 0;
  const completed = plan?.remaining === 0;

  return (
    <section className={styles.section} aria-labelledby="finance-planning-title">
      <div className={styles.heading}>
        <span className={styles.eyebrow}>{t.planner.eyebrow}</span>
        <h2 id="finance-planning-title" style={{ whiteSpace: 'pre-line' }}>{t.planner.title}</h2>
        <p>{t.planner.subtitle}</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.formCard}>
          <div className={styles.cardTop}>
            <span className={styles.iconBadge}><Target size={20} aria-hidden="true" /></span>
            <div>
              <h3>{isKinyarwanda ? 'Gahunda yawe yo kuzigama' : 'Your savings plan'}</h3>
              <p>{isKinyarwanda ? 'Hindura umubare uwo ari wo wose maze urebe uko bihinduka.' : 'Change any value to see the projection update.'}</p>
            </div>
          </div>

          <div className={styles.inputs}>
            <label className={styles.field} htmlFor="savings-target">
              <span>{isKinyarwanda ? 'Intego yo kuzigama' : 'Savings target'} <small>{t.common.rwf}</small></span>
              <input id="savings-target" type="text" inputMode="numeric" autoComplete="off" value={targetText} onChange={event => setTargetText(event.target.value)} aria-invalid={!!target.error} aria-describedby={target.error ? 'target-error' : 'target-help'} />
              <small id={target.error ? 'target-error' : 'target-help'} className={target.error ? styles.error : styles.hint} aria-live="polite">{target.error || (isKinyarwanda ? `Kuva kuri 1 kugeza kuri 1,000,000,000,000 ${t.common.rwf}` : 'From 1 to 1,000,000,000,000 RWF')}</small>
            </label>
            <label className={styles.field} htmlFor="savings-current">
              <span>{isKinyarwanda ? 'Ayo wamaze kubika' : 'Already saved'} <small>{t.common.rwf}</small></span>
              <input id="savings-current" type="text" inputMode="numeric" autoComplete="off" value={savedText} onChange={event => setSavedText(event.target.value)} aria-invalid={!!saved.error} aria-describedby={saved.error ? 'saved-error' : 'saved-help'} />
              <small id={saved.error ? 'saved-error' : 'saved-help'} className={saved.error ? styles.error : styles.hint} aria-live="polite">{saved.error || (isKinyarwanda ? 'Koresha 0 niba ugitangira bushya' : 'Use 0 if you are starting fresh')}</small>
            </label>
            <label className={styles.field} htmlFor="savings-months">
              <span>{isKinyarwanda ? 'Igihe cyo kuzigama' : 'Time to save'} <small>{t.common.months}</small></span>
              <input id="savings-months" type="text" inputMode="numeric" autoComplete="off" value={monthsText} onChange={event => setMonthsText(event.target.value)} aria-invalid={!!months.error} aria-describedby={months.error ? 'months-error' : 'months-help'} />
              <small id={months.error ? 'months-error' : 'months-help'} className={months.error ? styles.error : styles.hint} aria-live="polite">{months.error || (isKinyarwanda ? 'Hitamo amezi 1 kugeza kuri 600' : 'Choose 1 to 600 months')}</small>
            </label>
          </div>

          <div className={styles.synthetic}>
            <Sparkles size={14} aria-hidden="true" /> {isKinyarwanda ? 'Imibare y’urugero ni iy’igerageza. Shyiramo intego zawe bwite.' : 'Sample values are synthetic. Enter your own assumptions.'}
          </div>
        </div>

        <div className={styles.projectionCard}>
          <div className={styles.projectionTop}>
            <span className={styles.projectionIcon}><PiggyBank size={21} aria-hidden="true" /></span>
            <span className={styles.projectionLabel}>{isKinyarwanda ? 'IBARURA RY’UKWEZI' : 'MONTHLY PROJECTION'}</span>
            <span className={styles.localTag}><ShieldCheck size={13} aria-hidden="true" /> {isKinyarwanda ? 'Hano gusa' : 'Local only'}</span>
          </div>
          {valid && plan ? <>
            <div className={styles.amount} aria-live="polite" aria-atomic="true">
              {completed ? (isKinyarwanda ? 'Intego yagezweho' : 'Goal reached') : money(plan.perPeriod)}
              {!completed && <span> {t.common.perMonth}</span>}
            </div>
            <p className={styles.projectionCopy}>
              {completed
                ? (isKinyarwanda ? 'Amafaranga ufite ubu amaze kurenga cyangwa kungana n’intego wihaye.' : 'Your current saved amount already meets this target.')
                : (isKinyarwanda ? `Teganya kubika nibura ${money(plan.perPeriod)} buri kwezi mu mezi ${months.value} kugira ngo ugere ku ntego yawe.` : `Set aside about ${money(plan.perPeriod)} each month for ${months.value} months to reach your target.`)}
            </p>
            <div className={styles.progressBlock}>
              <div className={styles.progressLabels}>
                <span>{isKinyarwanda ? 'Intambwe' : 'Progress'}</span>
                <strong>{progress}%</strong>
              </div>
              <div className={styles.track} role="progressbar" aria-label="Savings goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.progressAmounts}>
                <span>{money(saved.value!)}</span>
                <span>{isKinyarwanda ? 'kuri' : 'of'} {money(target.value!)}</span>
              </div>
            </div>
            <div className={styles.planFacts}>
              <div><span><Target size={15} aria-hidden="true" /> {isKinyarwanda ? 'Intego' : 'Goal'}</span><b>{money(target.value!)}</b></div>
              <div><span><Clock3 size={15} aria-hidden="true" /> {isKinyarwanda ? 'Igihe' : 'Time'}</span><b>{months.value} {t.common.months}</b></div>
            </div>
          </> : <div className={styles.invalidState} role="status">
            <CircleHelp size={20} />
            <span>{isKinyarwanda ? 'Kosora imibare yagaragajwe kugira ngo urebe ibarura.' : 'Fix the highlighted values to see your savings projection.'}</span>
          </div>}
          <p className={styles.disclaimer}>{isKinyarwanda ? 'Ibarura ry’icyitegererezo gusa · nta nyungu cyangwa amafaranga y’ubwisungane · nta mafaranga yimurwa.' : 'Projection only · no interest or fees included · no real transactions or account updates.'}</p>
        </div>
      </div>

      <div className={styles.nextSteps}>
        <div className={styles.nextIntro}>
          <span className={styles.eyebrow}>{isKinyarwanda ? 'UBURYO BWO KUZIGAMA' : 'WAYS TO SAVE'}</span>
          <h3>{isKinyarwanda ? 'Hitamo umuvuduko ukubereye.' : 'Choose a rhythm that fits.'}</h3>
          <p>{isKinyarwanda ? 'Intego bwite n’ubwizigame bw’amatsinda bikora mu buryo butandukanye.' : 'Personal goals and shared savings follow different paths.'}</p>
          <Link href="/app/simulator" className={styles.scenarioLink}>{isKinyarwanda ? 'Genzura ibyemezo by’imari' : 'Explore demo scenarios'} <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        <Link href="/app/personal" className={styles.routeCard}>
          <span className={styles.routeIcon}><ArrowUpRight size={19} aria-hidden="true" /></span>
          <span><b>{isKinyarwanda ? 'Umwanya w’imari bwite' : 'Personal workspace'}</b><small>{isKinyarwanda ? 'Suzuma ubwizigame bwawe n’intego mu ibanga' : 'Review your private savings and goals'}</small></span>
          <ArrowRight className={styles.routeArrow} size={17} aria-hidden="true" />
        </Link>
        <Link href="/app/groups/start" className={styles.routeCard}>
          <span className={styles.routeIcon}><ArrowDownRight size={19} aria-hidden="true" /></span>
          <span><b>{isKinyarwanda ? 'Itsinda cyangwa Ikimina' : 'Itsinda or Ikimina'}</b><small>{isKinyarwanda ? 'Gereranya amatsinda abika akagabana n’ahererekanya' : 'Compare accumulating and rotating group models'}</small></span>
          <ArrowRight className={styles.routeArrow} size={17} aria-hidden="true" />
        </Link>
      </div>
      <p className={styles.groupDisclosure}>{isKinyarwanda ? 'Ibikorwa by’amatsinda muri iri gerageza ni iby’icyitegererezo. Iki gikoresho ntigitanga uburenganzira mu matsinda.' : 'Group activity in this prototype is simulated. This planning tool grants no organization access or permissions.'}</p>
    </section>
  );
}
