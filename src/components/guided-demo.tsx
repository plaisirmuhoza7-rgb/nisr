'use client';
import {FUNDRAISING_ENABLED} from '@/lib/competition';

import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight, Check, ChevronRight, HeartHandshake, Landmark, ShieldCheck, Sparkles, Users, Wallet, Activity} from 'lucide-react';
import ProductPreview from './product-preview';
import UssdDemo from './ussd-demo';
import LanguageToggle from './language-toggle';
import BrandLogo from './brand-logo';
import {calculateScenario, scenarioPreset} from '@/lib/guardian';
import {useLanguage} from '@/lib/i18n/context';
import s from './guided-demo.module.css';

const workspaceKeys = ['personal', 'groups', 'fundraising', 'cooperative'] as const;
type Workspace = typeof workspaceKeys[number];

const workspaceIcons: Record<Workspace, typeof Wallet> = {
  personal: Wallet,
  groups: Users,
  fundraising: HeartHandshake,
  cooperative: Landmark,
};

export default function GuidedDemo({initialWorkspace='personal'}:{initialWorkspace?:Workspace}){
  const { t, isKinyarwanda } = useLanguage();
  const [active,setActive]=useState<Workspace>(initialWorkspace);
  const [loan,setLoan]=useState(4500000);
  const input={...scenarioPreset('healthy'),requests:1,loanAmount:loan,contributions:0,expectedRepayments:0};
  const result=calculateScenario(input);

  const rwf = (amount:number) => `${amount.toLocaleString(isKinyarwanda ? 'rw-RW' : 'en-RW')} ${t.common.rwf}`;

  const workspacesData: Record<Workspace, { label: string; description: string }> = {
    personal: {
      label: isKinyarwanda ? 'Intego Bwite' : 'Personal',
      description: isKinyarwanda ? 'Shyiraho intego, sobanukirwa ubwizigame bwawe bwite, kandi utandukanye imari yawe n’iy’itsinda.' : 'Set a goal, understand your own savings, and keep group-held money separate.',
    },
    groups: {
      label: isKinyarwanda ? 'Amatsinda' : 'Savings Groups',
      description: isKinyarwanda ? 'Suzuma imisanzu, icyiciro cy’ubwizigame kiriho, ikigega kirinzwe, n’inshingano zo kwemeza inguzanyo.' : 'Review contributions, the current savings cycle, reserves, and approval responsibilities.',
    },
    fundraising: {
      label: isKinyarwanda ? 'Inkunga' : 'Fund',
      description: isKinyarwanda ? 'Kurikirana ubukangurambaga kuva ku misanzu yemejwe kugeza ku gukoresha amafaranga byemejwe mu bwisanzure.' : 'Follow a community campaign from confirmed contributions to independently approved spending.',
    },
    cooperative: {
      label: isKinyarwanda ? 'Koperative' : 'Cooperative',
      description: isKinyarwanda ? 'Reba hamwe imigabane y’abanyamuryango, amafaranga akora, n’imishinga y’ishoramari yifujwe.' : 'See member capital, operating cash, and proposed investments together.',
    },
  };

  const current = workspacesData[active];

  return <main className={s.page}>
    <header className={s.header}>
      <Link href="/" className={s.brand}><BrandLogo size={32} /> HURIZA</Link>
      <nav aria-label="Demo navigation">
        <a href="#workspaces">{isKinyarwanda ? 'Imyanya y’akazi' : 'Workspaces'}</a>
        <a href="#guardian">Guardian</a>
        <a href="#ussd">USSD</a>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <LanguageToggle />
        <Link href="/signup" className={s.button}>{t.common.signUp} <ArrowRight size={16}/></Link>
      </div>
    </header>

    <section className={s.intro}>
      <span className={s.eyebrow}>{t.demo.tag}</span>
      <h1 style={{ whiteSpace: 'pre-line' }}>{t.demo.title}</h1>
      <p>{t.demo.subtitle}</p>
      <div className={s.disclosure}>
        <ShieldCheck size={18}/>
        <span>{t.demo.disclosure}</span>
      </div>
    </section>

    <section id="workspaces" className={s.section} aria-labelledby="workspace-title">
      <div className={s.sectionHead}>
        <div>
          <span className={s.eyebrow}>{t.demo.step1Tag}</span>
          <h2 id="workspace-title">{t.demo.step1Title}</h2>
        </div>
        <p>{t.demo.step1Desc}</p>
      </div>
      <div className={s.tabs} role="group" aria-label="Choose a workspace">
        {workspaceKeys.filter(id => FUNDRAISING_ENABLED || id !== 'fundraising').map((id) => {
          const Icon = workspaceIcons[id];
          return (
            <button key={id} className={active===id?s.activeTab:undefined} aria-pressed={active===id} onClick={()=>setActive(id)}>
              <Icon size={17}/>{workspacesData[id].label}
            </button>
          );
        })}
      </div>
      <div className={s.preview} aria-live="polite">
        <ProductPreview workspace={active}/>
      </div>
      <div className={s.previewFoot}>
        <p>{current.description}</p>
        <Link href={`/signup?workspace=${active}`}>{isKinyarwanda ? `Tangira ubu muri ${current.label}` : `Get started with ${current.label}`} <ChevronRight size={16}/></Link>
      </div>
      <div className={s.note}>
        {isKinyarwanda ? 'Ibi bikorwa byose bikoresha inyandiko z’urugero, si iza konti yawe nyakuri.' : 'These previews use example records, not your account data. Organization permissions require verified creation or trusted membership.'}
      </div>
    </section>

    <section id="guardian" className={`${s.section} ${s.guardian}`} aria-labelledby="guardian-title">
      <div className={s.sectionHead}>
        <div>
          <span className={s.eyebrow}>{t.demo.step2Tag}</span>
          <h2 id="guardian-title">{t.demo.step2Title}</h2>
        </div>
        <p>{t.demo.step2Desc}</p>
      </div>
      <div className={s.scenarioGrid}>
        <div className={s.assumptions}>
          <div className={s.cardLabel}><Sparkles size={18}/> {isKinyarwanda ? 'IGERAGEZA RY’ITSINDA' : 'SYNTHETIC GROUP SCENARIO'}</div>
          <div className={s.row}><span>{isKinyarwanda ? 'Amafaranga atangira' : 'Starting cash'}</span><strong>5,000,000 {t.common.rwf}</strong></div>
          <div className={s.row}><span>{isKinyarwanda ? 'Ikigega gisabwa · 20%' : 'Required reserve · 20%'}</span><strong>1,000,000 {t.common.rwf}</strong></div>
          <div className={s.row}><span>{isKinyarwanda ? 'Ateganyijwe kwinjira' : 'Expected inflows'}</span><strong>0 {t.common.rwf}</strong></div>
          <label className={s.range}>
            <span>{isKinyarwanda ? 'Inguzanyo nshya isabwa' : 'Proposed new loan'} <strong>{rwf(loan)}</strong></span>
            <input type="range" min={0} max={5000000} step={50000} value={loan} onChange={event=>setLoan(Number(event.target.value))}/>
          </label>
          <div className={s.presets}>
            <button onClick={()=>setLoan(150000)}>{isKinyarwanda ? 'Itekanye' : 'Comfortable'}</button>
            <button onClick={()=>setLoan(3900000)}>{isKinyarwanda ? 'Iremereye' : 'Tight buffer'}</button>
            <button onClick={()=>setLoan(4500000)}>{isKinyarwanda ? 'Ikigega kibuzeho' : 'Reserve breach'}</button>
          </div>
          <small>{isKinyarwanda ? 'Ibi birabarwa n’uburyo bw’imibare bukoreshwa muri HURIZA. Nta nyungu cyangwa amafaranga y’inyongera bibarwamo.' : 'Calculated by the same integer RWF scenario engine used in the application. No interest, fees, or future inflows assumed.'}</small>
        </div>
        <div className={`${s.recommendation} ${result.status==='critical'?s.critical:result.status==='warning'?s.warning:s.healthy}`} aria-live="polite">
          <span className={s.cardLabel}><ShieldCheck size={18}/> {isKinyarwanda ? 'INAMA YA GUARDIAN' : 'GUARDIAN EXPLAINS'}</span>
          <h3>{result.status==='critical'?(isKinyarwanda?'Banza urinde ikigega.':'Protect the reserve first.'):result.status==='warning'?(isKinyarwanda?'Siga umwanya w’ikigega.':'Leave room for uncertainty.'):(isKinyarwanda?'Ikigega kirarinzwe neza.':'The modeled reserve holds.')}</h3>
          <strong className={s.cash}>{rwf(result.cashAfter)}</strong>
          <span>{isKinyarwanda ? 'Amafaranga asigara nyuma y’inguzanyo' : 'Cash after the proposed loan'}</span>
          <div className={s.reserveBar} aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,Number(BigInt(Math.max(0,result.cashAfter))*100n/5000000n)))}%`}}/></div>
          <p>{result.explanation}</p>
          <div className={s.resultFoot}><Check size={17}/> {isKinyarwanda ? 'Ibarura risobanutse · Bisaba kwemezwa n’abantu' : 'Transparent calculation · Human approval required'}</div>
        </div>
      </div>
      <p className={s.note}>{isKinyarwanda ? 'Igerageza gusa. Ntabwo ryemeza inguzanyo nyir’izina cyangwa ngo rihindure inyandiko z’imari. Ibyemezo bisuzumwa n’abayobozi b’itsinda.' : 'Simulation only. This does not approve a loan, assess personal creditworthiness, or change the ledger. Actual decisions also check membership, obligations, pending commitments, and group policy.'}</p>
      <Link className={s.textLink} href="/login?next=%2Fapp%2Fsimulator">{isKinyarwanda ? 'Fungura igerageza ry’imari muri konti yawe' : 'Open the scenario lab in your account'} <ArrowRight size={16}/></Link>
    </section>

    <section id="ussd" className={s.section}>
      <div className={s.sectionHead}>
        <div>
          <span className={s.eyebrow}>{t.demo.step3Tag}</span>
          <h2>{t.demo.step3Title}</h2>
        </div>
        <p>{t.demo.step3Desc}</p>
      </div>
      <UssdDemo/>
    </section>

    <section className={s.next}>
      <span className={s.eyebrow}>{t.demo.nextStepTag}</span>
      <h2>{t.demo.nextStepTitle}</h2>
      <p>{t.demo.nextStepDesc}</p>
      <div>
        <Link className={s.button} href="/signup">{t.demo.createAccount} <ArrowRight size={17}/></Link>
        <Link className={s.textLink} href="/app/groups/start">{t.demo.createOrJoin} <ArrowRight size={16}/></Link>
      </div>
    </section>

    <footer className={s.footer}>
      <Link href="/">HURIZA · {t.common.brandTagline}</Link>
      <span>{t.common.demoDisclosure}</span>
      <Link href="/methodology">{t.footer.methodology}</Link>
    </footer>
  </main>;
}
