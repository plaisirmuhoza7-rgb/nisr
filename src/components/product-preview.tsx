'use client';

import {
  Activity, ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays,
  Check, CircleDollarSign, Clock3, Coins, HandHeart, Landmark, ShieldCheck,
  Sparkles, Users, Wallet, Wheat,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import styles from './product-preview.module.css';

type Workspace = 'personal' | 'groups' | 'fundraising' | 'cooperative';
type ProductPreviewProps = { workspace: Workspace; compact?: boolean };

const workspaceIcon: Record<Workspace, typeof Wallet> = {
  personal: Wallet, groups: Users, fundraising: HandHeart, cooperative: Wheat,
};

export default function ProductPreview({ workspace, compact = false }: ProductPreviewProps) {
  const { t, isKinyarwanda } = useLanguage();
  const money = (amount: number) => `${amount.toLocaleString(isKinyarwanda ? 'rw-RW' : 'en-US')} ${t.common.rwf}`;

  const examples: Record<Workspace, {
    eyebrow: string; title: string; mark: string; description: string;
    metrics: { label: string; value: string; note: string; direction?: 'up' | 'down' }[];
  }> = {
    personal: {
      eyebrow: isKinyarwanda ? 'IMARI BWITE · INCAMAKE' : 'PERSONAL · OVERVIEW',
      title: isKinyarwanda ? 'Amafaranga yawe mu mucyo' : 'Your money, in focus',
      mark: 'P',
      description: isKinyarwanda ? 'Ishusho yoroshye y’intego, imisanzu n’ahazaza.' : 'A simple view of goals, contributions and what comes next.',
      metrics: [
        { label: isKinyarwanda ? 'Ubwizigame buhari' : 'Available savings', value: money(248_500), note: isKinyarwanda ? 'Mu ntego bwite zose' : 'Across personal goals', direction: 'up' },
        { label: isKinyarwanda ? 'Amafaranga y’ishuri' : 'School fees goal', value: money(165_000), note: isKinyarwanda ? `66% bya ${money(250_000)}` : '66% of RWF 250,000', direction: 'up' },
        { label: isKinyarwanda ? 'Umusanzu utaha' : 'Next contribution', value: money(15_000), note: isKinyarwanda ? 'Wateganyijwe · 28 Ukw' : 'Planned · 28 Oct' },
      ],
    },
    groups: {
      eyebrow: isKinyarwanda ? 'AMATSINDA · ITSINDA' : 'SAVINGS GROUPS · ITSINDA',
      title: isKinyarwanda ? 'Itsinda Ubumwe' : 'Ubumwe Savings Circle',
      mark: 'U',
      description: isKinyarwanda ? 'Icyiciro gifite imisanzu isobanutse, inshingano n’ikigega kirinzwe.' : 'A shared cycle with clear contributions, obligations and reserve.',
      metrics: [
        { label: isKinyarwanda ? 'Amafaranga y’itsinda' : 'Treasury cash', value: money(3_250_000), note: isKinyarwanda ? 'Ay’icyitegererezo' : 'Illustrative group balance', direction: 'up' },
        { label: isKinyarwanda ? 'Aho icyiciro kigeze' : 'Cycle progress', value: isKinyarwanda ? 'Icyiciro cya 7 kuri 12' : 'Round 7 of 12', note: isKinyarwanda ? 'Abanyamuryango 24 · buri kwezi' : '24 members · monthly' },
        { label: isKinyarwanda ? 'Ikigega kirinzwe' : 'Reserve held', value: money(1_000_000), note: isKinyarwanda ? 'Ikigega cy’itsinda' : 'Policy reserve' },
      ],
    },
    fundraising: {
      eyebrow: isKinyarwanda ? 'IKIGEGA · UBUKANGURAMBAGA' : 'HURIZA FUND · CAMPAIGNS',
      title: isKinyarwanda ? 'Guteranya inkunga mu mucyo' : 'Community giving, organized',
      mark: 'F',
      description: isKinyarwanda ? 'Kurikirana intego z’ubukangurambaga n’amafaranga yasohotse yemejwe.' : 'Follow campaign targets, received gifts and approved spending.',
      metrics: [
        { label: isKinyarwanda ? 'Ibikoresho by’ishuri' : 'School supplies', value: money(1_840_000), note: isKinyarwanda ? `73.6% bya ${money(2_500_000)}` : '73.6% of RWF 2,500,000', direction: 'up' },
        { label: isKinyarwanda ? 'Impano zakiriwe' : 'Received gifts', value: '46', note: isKinyarwanda ? 'Inyandiko z’icyitegererezo' : 'Synthetic demo records' },
        { label: isKinyarwanda ? 'Bitegereje kwemezwa' : 'Awaiting review', value: isKinyarwanda ? 'Ubusabe 2' : '2 requests', note: isKinyarwanda ? 'Kwemeza mbere yo kwishyura' : 'Approval before payment' },
      ],
    },
    cooperative: {
      eyebrow: isKinyarwanda ? 'KOPERATIVE · IMARI' : 'COOPERATIVE · POSITION',
      title: isKinyarwanda ? 'Koperative Imena' : 'Imena Producers Cooperative',
      mark: 'I',
      description: isKinyarwanda ? 'Ishusho y’amafaranga ahari, imigabane n’imishinga yifujwe.' : 'A compact view of cash, member capital and proposals for review.',
      metrics: [
        { label: isKinyarwanda ? 'Amafaranga ahari' : 'Cash available', value: money(6_480_000), note: isKinyarwanda ? 'Nyuma y’amasoko yishyuwe' : 'After recorded expenses', direction: 'up' },
        { label: isKinyarwanda ? 'Imigabane y’abanyamuryango' : 'Share capital', value: money(12_250_000), note: isKinyarwanda ? 'Imisanzu y’imigabane' : 'Member contributions' },
        { label: isKinyarwanda ? 'Umusaruro w’iki gihembwe' : 'Revenue this quarter', value: money(2_140_000), note: isKinyarwanda ? 'Imibare y’icyitegererezo' : 'Illustrative activity', direction: 'up' },
      ],
    },
  };

  const labels: Record<Workspace, { caption: string; rows: [string, string, string][] }> = {
    personal: {
      caption: isKinyarwanda ? 'Ibikorwa biheruka' : 'Recent activity',
      rows: [
        ['23 Ukw', isKinyarwanda ? 'Kuzigama ku ntego bwite' : 'Personal goal savings', `+${money(10_000)}`],
        ['19 Ukw', isKinyarwanda ? 'Umusanzu w’itsinda · urugero' : 'Group contribution · demo', `−${money(5_000)}`],
        ['12 Ukw', isKinyarwanda ? 'Kuzigama ku ntego bwite' : 'Personal goal savings', `+${money(10_000)}`]
      ],
    },
    groups: {
      caption: isKinyarwanda ? 'Ibikorwa by’icyiciro' : 'Cycle activity',
      rows: [
        ['24 Ukw', isKinyarwanda ? 'Imisanzu y’abanyamuryango' : 'Member contributions', `+${money(120_000)}`],
        ['22 Ukw', isKinyarwanda ? 'Kwishyura inguzanyo · urugero' : 'Loan repayment · simulated', `+${money(35_000)}`],
        ['20 Ukw', isKinyarwanda ? 'Gushyira mu kigega kirinzwe' : 'Reserve allocation', money(25_000)]
      ],
    },
    fundraising: {
      caption: isKinyarwanda ? 'Ibikorwa by’ubukangurambaga' : 'Campaign activity',
      rows: [
        ['24 Ukw', isKinyarwanda ? 'Ibikoresho by’ishuri · impano' : 'School supplies · gift', `+${money(50_000)}`],
        ['22 Ukw', isKinyarwanda ? 'Ubuzima rusange · impano' : 'Community health · gift', `+${money(25_000)}`],
        ['21 Ukw', isKinyarwanda ? 'Ubusabe bwo gutwara ibintu' : 'Transport request · review', isKinyarwanda ? 'Biracyasuzumwa' : 'Pending']
      ],
    },
    cooperative: {
      caption: isKinyarwanda ? 'Ibikorwa by’imari' : 'Financial activity',
      rows: [
        ['24 Ukw', isKinyarwanda ? 'Kugurisha umusaruro' : 'Produce sales · example', `+${money(340_000)}`],
        ['22 Ukw', isKinyarwanda ? 'Umusanzu w’imigabane' : 'Member share contribution', `+${money(125_000)}`],
        ['18 Ukw', isKinyarwanda ? 'Umushinga wo kubika ibiribwa' : 'Storage proposal', isKinyarwanda ? 'Amajwi 8' : '8 votes']
      ],
    },
  };

  const example = examples[workspace];
  const details = labels[workspace];
  const Icon = workspaceIcon[workspace];
  const progress = workspace === 'personal' ? 66 : workspace === 'fundraising' ? 74 : workspace === 'groups' ? 58 : 71;

  return (
    <section className={`${styles.preview} ${compact ? styles.compact : ''}`} aria-label={`${workspace} workspace preview`}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.brandMark}><Icon size={17} strokeWidth={2.1} /></span><span>huriza<small>{isKinyarwanda ? 'UMWANYA W’IMARI' : 'FINANCIAL WORKSPACE'}</small></span></div>
        <div className={styles.topActions}><span className={styles.period}><CalendarDays size={14} /> {isKinyarwanda ? 'Ukwakira 2026' : 'Oct 2026'}</span><span className={styles.avatar} aria-label="Illustrative workspace">{example.mark}</span></div>
      </header>
      {compact ? <div className={styles.compactBody}>
        <div className={styles.compactHeading}><span className={styles.eyebrow}><span />{example.eyebrow}</span><h3>{example.title}</h3><p>{example.description}</p></div>
        <div className={styles.compactMetrics}>
          {example.metrics.map((metric, index) => (
            <article className={styles.compactMetric} key={metric.label}>
              <span className={styles.compactMetricIcon}>{index === 0 ? <CircleDollarSign size={16} /> : index === 1 ? <Coins size={16} /> : <Clock3 size={16} />}</span>
              <span className={styles.compactMetricCopy}><b>{metric.label}</b><small>{metric.note}</small></span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
        <div className={styles.compactDisclosure}><ShieldCheck size={14}/><span>{isKinyarwanda ? 'Inyandiko z’icyitegererezo gusa · nta mafaranga yimurwa' : 'Illustrative synthetic records · no real-world outcomes implied'}</span></div>
      </div> : <div className={styles.body}>
        <div className={styles.heading}>
          <div><span className={styles.eyebrow}><span />{example.eyebrow}</span><h3>{example.title}</h3><p>{example.description}</p></div>
          <span className={styles.secure}><ShieldCheck size={14} /> {isKinyarwanda ? 'Inyandiko z’umucyo' : 'Clear records'}</span>
        </div>
        <div className={styles.metrics}>
          {example.metrics.map((metric, index) => (
            <article className={styles.metric} key={metric.label}>
              <div className={styles.metricHead}><span>{metric.label}</span><span className={`${styles.metricIcon} ${index === 1 ? styles.tint : ''}`}>{index === 0 ? <CircleDollarSign size={16} /> : index === 1 ? <Coins size={16} /> : <Clock3 size={16} />}</span></div>
              <strong>{metric.value}</strong>
              <small>{metric.direction === 'up' ? <ArrowUpRight size={13} /> : metric.direction === 'down' ? <ArrowDownRight size={13} /> : <Check size={13} />}{metric.note}</small>
            </article>
          ))}
        </div>
        <div className={styles.lower}>
          <article className={styles.chartCard}>
            <div className={styles.cardTitle}><div><span className={styles.cardEyebrow}>{isKinyarwanda ? 'MURI MAKE' : 'AT A GLANCE'}</span><h4>{workspace === 'groups' ? (isKinyarwanda ? 'Icyiciro cy’ubwizigame' : 'Savings cycle') : (isKinyarwanda ? 'Intambwe yatewe' : 'Progress over time')}</h4></div><span className={styles.trend}><ArrowUpRight size={14} /> {isKinyarwanda ? 'Biri ku murongo' : 'On track'}</span></div>
            <div className={styles.chart} role="img" aria-label="Illustrative progress trend, steadily increasing">
              <div className={styles.yLabels}><span>100k</span><span>50k</span><span>0</span></div>
              <div className={styles.plot}><div className={styles.gridlines}><i /><i /><i /></div><div className={styles.bars}>
                {[31, 42, 38, 54, 49, 65, 57, 75, 70, 88, progress].map((height, index) => <span className={index === 10 ? styles.currentBar : ''} style={{ height: `${height}%` }} key={`${height}-${index}`} />)}
              </div><div className={styles.xLabels}><span>{isKinyarwanda ? 'Kam' : 'Jun'}</span><span>{isKinyarwanda ? 'Kan' : 'Aug'}</span><span>{isKinyarwanda ? 'Ukw' : 'Oct'}</span></div></div>
            </div>
            <div className={styles.chartFoot}><span><i className={styles.legend} /> {isKinyarwanda ? 'Ibikorwa byanditswe' : 'Recorded activity'}</span><span>{isKinyarwanda ? 'Icyitegererezo' : 'Synthetic example'}</span></div>
          </article>
          <article className={styles.activityCard}>
            <div className={styles.cardTitle}><div><span className={styles.cardEyebrow}>{isKinyarwanda ? 'IBYA HERUKA' : 'LATEST ENTRIES'}</span><h4>{details.caption}</h4></div><span className={styles.more}>•••</span></div>
            <div className={styles.activityRows}>{details.rows.map(([date, name, amount], index) => <div className={styles.activityRow} key={`${name}-${date}`}><span className={`${styles.rowIcon} ${index === 1 ? styles.rowSoft : ''}`}>{workspace === 'cooperative' ? <Landmark size={15} /> : workspace === 'fundraising' ? <HandHeart size={15} /> : <Coins size={15} />}</span><span className={styles.rowCopy}><b>{name}</b><small>{date} · {isKinyarwanda ? 'urugero' : 'illustrative'}</small></span><strong className={amount.startsWith('+') ? styles.positive : ''}>{amount}</strong></div>)}</div>
            <div className={styles.summary}><span><Sparkles size={14} /> {isKinyarwanda ? 'Incamake' : 'Example summary'}</span><b>{workspace === 'groups' ? (isKinyarwanda ? 'Ikigega kiragaragara' : 'Reserve kept visible') : (isKinyarwanda ? 'Intambwe iroroshye gukurikira' : 'Progress is easy to follow')}</b></div>
          </article>
        </div>
        <div className={styles.disclosure}><ShieldCheck size={14} /><span>{isKinyarwanda ? 'Inyandiko zose ziri hano ni iz’icyitegererezo. Nta musaruro nyakuri zishingiraho.' : 'Illustrative synthetic records. These figures do not establish real-world outcomes.'}</span></div>
      </div>}
    </section>
  );
}
