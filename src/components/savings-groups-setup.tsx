'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, PiggyBank, RotateCw, UsersRound } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import {stepAfterModelChange,validateGroupSchedule} from '@/lib/group-setup-validation';
import styles from './savings-groups-setup.module.css';

export type SavingsModel = 'ACCUMULATING' | 'ROTATING';
export type SavingsGroupDraft = {
  model: SavingsModel;
  name: string;
  description: string;
  location: string;
  contact: string;
  memberCount: number;
  contributionAmount: number;
  frequency: 'weekly' | 'monthly';
  startDate: string;
  cycleEndDate: string;
  shareOutDate: string;
  administrator: string;
  rotationOrder: string;
  reservePercent: number;
  acceptsRules: boolean;
};

type Props = {
  currentGroupName: string | null;
  onCreate?: (draft: SavingsGroupDraft) => Promise<boolean>;
  onJoin?: (code: string) => Promise<boolean>;
};

const initial: SavingsGroupDraft = {
  model: 'ACCUMULATING', name: '', description: '', location: '', contact: '', memberCount: 5,
  contributionAmount: 5000, frequency: 'monthly', startDate: '', cycleEndDate: '', shareOutDate: '', administrator: '', rotationOrder: '',
  reservePercent: 10, acceptsRules: false,
};

type NumericDraftKey = 'memberCount' | 'contributionAmount' | 'reservePercent';
function safeNonNegativeInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export default function SavingsGroupsSetup({ currentGroupName, onCreate, onJoin }: Props) {
  const { t, isKinyarwanda } = useLanguage();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [stepError, setStepError] = useState('');
  const translatedErrors:Record<string,string>={
    'Enter a valid start date.':'Shyiramo itariki yo gutangira yemewe.',
    'Enter a valid cycle end date.':'Shyiramo itariki yo kurangiza icyiciro yemewe.',
    'Enter a valid payout date.':'Shyiramo itariki yo kugabana yemewe.',
    'Enter a contact phone number.':'Shyiramo nimero ya telefone yemewe.',
    'Enter the group location.':'Shyiramo aho itsinda rikorera.',
    'Cycle dates must follow the start date and share-out must follow the savings cycle':'Amatariki agomba gukurikirana: gutangira, kurangiza, hanyuma kugabana.',
    'Your session expired. Sign in in another tab, then return here and submit again.':'Igihe cyo kwinjira cyarangiye. Injira ahandi, hanyuma ugaruke hano wongere utangize itsinda.',
  };
  const displayedMessage=isKinyarwanda?(translatedErrors[message]??message):message;
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  const [inviteCode, setInviteCode] = useState('');
  const [numericValues, setNumericValues] = useState<Partial<Record<NumericDraftKey, string>>>({});
  const members = Math.max(1, draft.memberCount);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedModel = sessionStorage.getItem('huriza-signup-group-model');
      if (savedModel === 'ROTATING' || savedModel === 'ACCUMULATING') {
        setDraft(d => ({ ...d, model: savedModel }));
      }
    }
  }, []);

  const steps = isKinyarwanda ? [
    'Amakuru y’itsinda',
    'Amabwiriza y’abanyamuryango n’imisanzu',
    draft.model === 'ROTATING' ? 'Amabwiriza yo guhererekanya' : 'Icyiciro cy’ubwizigame n’ikigega',
    'Suzuma maze utangize'
  ] : [
    'Group details',
    'Member & contribution rules',
    draft.model === 'ROTATING' ? 'Rotation & payout rules' : 'Savings cycle & reserves',
    'Review & create'
  ];

  const set = <K extends keyof SavingsGroupDraft>(key: K, value: SavingsGroupDraft[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const selectModel = (model:SavingsModel) => {
    if (model === draft.model) return;
    set('model',model);
    setStep(current => stepAfterModelChange(current,draft.model,model));
    setStepError('');
    setMessage('');
  };

  const submit = async () => {
    if (!onCreate || !draft.acceptsRules) return;
    setSaving(true); setMessage('');
    try {
      if (await onCreate(draft)) {
        setMessage(isKinyarwanda ? 'Gushyiraho itsinda byoherejwe.' : 'Your group setup was submitted.');
        setMode('home');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isKinyarwanda ? 'Ntitwabashije gutangiza itsinda. Ongera ugerageze.' : 'We could not submit this group setup. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const next = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStepError('');
    if (step === 2) {
      const scheduleError=validateGroupSchedule(draft);
      if (scheduleError==='dates') {
        setStepError(isKinyarwanda ? 'Reba amatariki: itariki yo gutangira, kurangiza n’iyo kugabana bigomba gukurikirana neza.' : 'Check the dates: start, cycle end, and share-out dates must be in the right order.');
        return;
      }
      if (scheduleError==='recipients') {
          setStepError(isKinyarwanda ? `Andika amazina yihariye ${draft.memberCount} neza, rimwe kuri buri murongo.` : `Enter exactly ${draft.memberCount} unique recipient names, one per line.`);
          return;
      }
    }
    setStep((n) => Math.min(3, n + 1));
  };

  const field = (label: string, key: keyof SavingsGroupDraft, type = 'text', help?: string) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <input
        type={type}
        required={key !== 'description' && key !== 'rotationOrder'}
        min={type === 'number' ? (key === 'memberCount' ? 2 : key === 'reservePercent' ? 0 : 1) : undefined}
        max={type === 'number' ? (key === 'memberCount' ? 500 : key === 'reservePercent' ? 100 : Number.MAX_SAFE_INTEGER) : undefined}
        minLength={type === 'text' || type === 'tel' ? (key === 'name' || key === 'location' ? 2 : key === 'contact' ? 3 : undefined) : undefined}
        maxLength={type === 'text' || type === 'tel' ? (key === 'name' || key === 'location' ? 100 : key === 'administrator' ? 120 : 150) : undefined}
        step={type === 'number' ? 1 : undefined}
        value={type === 'number' ? numericValues[key as NumericDraftKey] ?? String(draft[key]) : String(draft[key])}
        onChange={(e) => {
          if (type !== 'number') { set(key, e.target.value as never); return; }
          const raw = e.target.value;
          setNumericValues((old) => ({ ...old, [key]: raw }));
          const parsed = safeNonNegativeInteger(raw);
          if (parsed !== null) set(key, parsed as never);
        }}
      />
      {help && <small>{help}</small>}
    </label>
  );

  return <section className={styles.root} aria-label="Savings groups">
    <div className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>{isKinyarwanda ? 'AMATSINDA YO KUZIGAMA' : 'SAVINGS GROUPS'}</span>
        <h2>{isKinyarwanda ? 'Amatsinda yawe yo kuzigama' : 'Your savings groups'}</h2>
        <p>{isKinyarwanda ? 'Hitamo uburyo itsinda rizigama.' : 'Choose how your group will save.'}</p>
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={() => { setMode(mode === 'join' ? 'home' : 'join'); setMessage(''); }}>
          <UsersRound size={16}/> {isKinyarwanda ? 'Injira mu itsinda' : 'Join a group'}
        </button>
        <button className={styles.primary} onClick={() => { setMode(mode === 'create' ? 'home' : 'create'); setStep(0); setMessage(''); }}>
          <span>＋</span> {isKinyarwanda ? 'Tangiza itsinda rishya' : 'Create a group'}
        </button>
      </div>
    </div>

    {message && !(mode === 'create' && step === 3) && <p ref={messageRef} tabIndex={-1} className={styles.message} role="status">{displayedMessage} {message.startsWith('Your session expired.')&&<a href="/login?next=%2Fapp%2Fgroups%2Fstart" target="_blank" rel="noreferrer">{isKinyarwanda?'Fungura aho winjirira':'Open sign-in'}</a>}</p>}

    {mode === 'home' && <div className={styles.list}>
      {currentGroupName ? (
        <article className={styles.groupRow}>
          <span className={styles.groupIcon}><UsersRound size={19}/></span>
          <div>
            <b>{currentGroupName}</b>
            <small>{isKinyarwanda ? 'Umwanya w’itsinda ririho · ibikorwa byose ni iby’icyitegererezo' : 'Current group workspace · all financial activity is simulated'}</small>
          </div>
          <span className={styles.memberBadge}>{isKinyarwanda ? 'Umwanya w’umunyamuryango' : 'Member workspace'}</span>
        </article>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><PiggyBank size={23}/></span>
          <div>
            <b>{isKinyarwanda ? 'Urutonde rw’amatsinda yawe rutangirira hano' : 'Your group list starts here'}</b>
            <p>{isKinyarwanda ? 'Kwinjira mu itsinda bisaba ubutumire bw’umuyobozi waryo.' : 'Join an existing group with an administrator invitation.'}</p>
          </div>
        </div>
      )}
      <div className={styles.modelStrip}>
        <span><CircleHelp size={16}/> {isKinyarwanda ? 'Uburyo bubiri bw’itsinda burahari' : 'Two group models available'}</span>
        <button onClick={() => { setMode('create'); setStep(0); }}>
          {isKinyarwanda ? 'Reba uburyo bwombi' : 'See both models'} <ArrowRight size={15}/>
        </button>
      </div>
    </div>}

    {mode === 'join' && <div className={styles.joinPanel}>
      <span className={styles.emptyIcon}><UsersRound size={22}/></span>
      <div>
        <h3>{isKinyarwanda ? 'Injira ukoresheje ubutumire' : 'Join by invitation'}</h3>
        <p>{isKinyarwanda ? 'Injiza kode y’ubutumire bw’itsinda.' : 'Enter your group invitation code.'}</p>
        <label className={styles.field}>
          <span>{isKinyarwanda ? 'Kode y’ubutumire' : 'Invitation code'}</span>
          <input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))} maxLength={24} required/>
        </label>
        <button className={styles.primary} disabled={!onJoin||inviteCode.length!==24||saving} onClick={async()=>{
          if(!onJoin)return;
          setSaving(true);
          setMessage('');
          try {
            if(await onJoin(inviteCode)) setMessage(isKinyarwanda ? 'Winjiye mu itsinda.' : 'You joined the group.');
          } catch(error) {
            setMessage(error instanceof Error?error.message:(isKinyarwanda ? 'Ntibyakunze kwinjira muri iri tsinda. Ongera ugerageze.' : 'We could not join this group. Please try again.'));
          } finally {
            setSaving(false);
          }
        }}>
          {saving?(isKinyarwanda?'Biratunganywa…':'Joining…'):(isKinyarwanda?'Injira mu itsinda':'Join group')} <ArrowRight size={15}/>
        </button>
        <button className={styles.textButton} onClick={() => setMode('home')}>
          <ArrowLeft size={15}/> {isKinyarwanda ? 'Subira ku matsinda' : 'Back to groups'}
        </button>
      </div>
    </div>}

    {mode === 'create' && <div className={styles.createPanel}>
      <div className={styles.panelTop}>
        <div>
          <span className={styles.eyebrow}>{isKinyarwanda ? 'GUTANGIZA ITSINDA RISHYA' : 'NEW GROUP SETUP'}</span>
          <h3>{isKinyarwanda ? 'Itsinda ryanyu rizajya rizigama rite?' : 'How does your group save?'}</h3>
          <p>{isKinyarwanda ? 'Hitamo uburyo mwumvikanyeho.' : 'Choose the model your group agreed to.'}</p>
        </div>
        <button className={styles.close} onClick={() => setMode('home')} aria-label={t.common.close}>×</button>
      </div>
      <div className={styles.choices}>
        <button className={`${styles.choice} ${draft.model === 'ACCUMULATING' ? styles.choiceSelected : ''}`} onClick={() => selectModel('ACCUMULATING')} aria-pressed={draft.model === 'ACCUMULATING'}>
          <span className={styles.choiceIcon}><PiggyBank size={24}/></span>
          <span className={styles.choiceText}>
            <b>Itsinda <small>{isKinyarwanda ? 'KUBITSA NO KUGABANA' : 'SAVE & SHARE'}</small></b>
            <span>{isKinyarwanda ? 'Abanyamuryango batanga imisanzu, bakagabana ubwizigame ku mpera z’icyiciro.' : 'Members contribute and share savings at the end of the cycle.'}</span>
          </span>
          {draft.model === 'ACCUMULATING' && <Check className={styles.selectedCheck} size={19}/>}
        </button>
        <button className={`${styles.choice} ${draft.model === 'ROTATING' ? styles.choiceSelected : ''}`} onClick={() => selectModel('ROTATING')} aria-pressed={draft.model === 'ROTATING'}>
          <span className={styles.choiceIcon}><RotateCw size={24}/></span>
          <span className={styles.choiceText}>
            <b>Ikimina <small>{isKinyarwanda ? 'GUTANGA NO GUHEREREKANYA' : 'CONTRIBUTE & ROTATE'}</small></b>
            <span>{isKinyarwanda ? 'Abanyamuryango batanga umusanzu buri nshuro, maze umwe agahabwa ikusanyijwe.' : 'Members contribute each round; one member receives the pool in turn.'}</span>
          </span>
          {draft.model === 'ROTATING' && <Check className={styles.selectedCheck} size={19}/>}
        </button>
      </div>
      <div className={styles.wizard}>
        <div className={styles.progress}><span style={{ width: `${(step + 1) * 25}%` }}/></div>
        <div className={styles.stepHead}>
          <span>{isKinyarwanda ? `INTAMBWE ${step + 1} KURI 4` : `STEP ${step + 1} OF 4`}</span>
          <b>{steps[step]}</b>
        </div>
        {step < 3 ? (
          <form className={styles.form} onSubmit={next}>
            {step === 0 && <div className={styles.formGrid}>
              {field(isKinyarwanda ? 'Izina ry’itsinda' : 'Group name', 'name')}
              {field(isKinyarwanda ? 'Aho rikorera (Akarere/Umurenge)' : 'Location', 'location')}
              {field(isKinyarwanda ? 'Amazina y’umuyobozi' : 'Administrator name', 'administrator')}
              {field(isKinyarwanda ? 'Aderesi ya telefone' : 'Contact information', 'contact', 'tel')}
              <label className={`${styles.field} ${styles.wide}`}>
                <span>{isKinyarwanda ? 'Ibisobanuro' : 'Description'} <small>{isKinyarwanda ? '(ntibitegetswe)' : '(optional)'}</small></span>
                <textarea maxLength={500} value={draft.description} onChange={e => set('description', e.target.value)} rows={3}/>
              </label>
            </div>}
            {step === 1 && <div className={styles.formGrid}>
              {field(isKinyarwanda ? 'Umubare w’abanyamuryango bitezwe' : 'Expected members', 'memberCount', 'number')}
              {field(draft.model === 'ROTATING' ? (isKinyarwanda ? 'Umusanzu kuri buri munyamuryango ku nshuro (Frw)' : 'Contribution per member, each round (RWF)') : (isKinyarwanda ? 'Umusanzu kuri buri munyamuryango (Frw)' : 'Contribution amount per member (RWF)'), 'contributionAmount', 'number')}
              <label className={styles.field}>
                <span>{isKinyarwanda ? 'Uko imisanzu itangwa' : 'Contribution frequency'}</span>
                <select value={draft.frequency} onChange={e => set('frequency', e.target.value as 'weekly' | 'monthly')}>
                  <option value="weekly">{isKinyarwanda ? 'Buri cyumweru' : 'Weekly'}</option>
                  <option value="monthly">{isKinyarwanda ? 'Buri kwezi' : 'Monthly'}</option>
                </select>
              </label>
              {draft.model === 'ACCUMULATING' && field(isKinyarwanda ? 'Ikigega gito kirinzwe (%)' : 'Minimum reserve (%)', 'reservePercent', 'number')}
            </div>}
            {step === 2 && <div className={styles.formGrid}>
              {field(isKinyarwanda ? 'Itariki yo gutangira' : 'Start date', 'startDate', 'date')}
              {draft.model === 'ROTATING' ? <>
                <label className={styles.field}>
                  <span>{isKinyarwanda ? 'Itariki y’ubwishyu bwa mbere' : 'First payout date'}</span>
                  <input type="date" value={draft.shareOutDate} onChange={e => set('shareOutDate', e.target.value)} required/>
                </label>
                <label className={`${styles.field} ${styles.wide}`}>
                  <span>{isKinyarwanda ? 'Urutonde rw’abazagenda bishyurwa' : 'Agreed recipient order'}</span>
                  <textarea maxLength={draft.memberCount * 121} value={draft.rotationOrder} onChange={e => set('rotationOrder', e.target.value)} rows={4} placeholder={isKinyarwanda ? 'Umunyamuryango umwe kuri buri murongo, ku rutonde rwemerejwe' : 'One member per line, in agreed order'} required/>
                  <small>{isKinyarwanda ? 'Andika amazina y’abanyamuryango mu rutonde rwumvikanyweho.' : 'Enter one registered account name per line.'}</small>
                </label>
              </> : <>
                <label className={styles.field}>
                  <span>{isKinyarwanda ? 'Impera z’icyiciro cy’imisanzu' : 'Contribution cycle ends'}</span>
                  <input type="date" value={draft.cycleEndDate} onChange={e => set('cycleEndDate', e.target.value)} required/>
                </label>
                <label className={styles.field}>
                  <span>{isKinyarwanda ? 'Itariki yo kugabana ubwizigame' : 'Planned share-out date'}</span>
                  <input type="date" value={draft.shareOutDate} onChange={e => set('shareOutDate', e.target.value)} required/>
                </label>
                <div className={styles.note}>
                  <Clock3 size={17}/>
                  <span>{isKinyarwanda ? 'Mbere yo kugabana, genzura imisanzu, inguzanyo n’inshingano byemejwe.' : 'Confirm contributions, loans and obligations before sharing out.'}</span>
                </div>
              </>}
            </div>}
            {stepError && <p className={styles.message} role="alert">{stepError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.secondary} onClick={() => { setStepError(''); setStep(n => Math.max(0, n - 1)); }} disabled={step === 0}>
                <ArrowLeft size={15}/> {t.common.back}
              </button>
              <button type="submit" className={styles.primary}>
                {t.common.continue} <ArrowRight size={15}/>
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.review}>
            <div className={styles.reviewGrid}>
              <div><small>{isKinyarwanda ? 'ITSINDA' : 'GROUP'}</small><b>{draft.name || '—'} · {draft.model === 'ACCUMULATING' ? 'Itsinda' : 'Ikimina'} · {draft.location || '—'}</b></div>
              <div><small>{isKinyarwanda ? 'UMUSANZU' : 'CONTRIBUTION'}</small><b>{members} {isKinyarwanda ? 'abanyamuryango' : 'members'} × {draft.contributionAmount.toLocaleString()} {t.common.rwf} · {draft.frequency === 'weekly' ? (isKinyarwanda ? 'buri cyumweru' : 'weekly') : (isKinyarwanda ? 'buri kwezi' : 'monthly')}</b></div>
              <div><small>{isKinyarwanda ? 'AMATARIKI' : 'DATES'}</small><b>{draft.startDate} → {draft.model === 'ACCUMULATING' ? `${draft.cycleEndDate} → ` : ''}{draft.shareOutDate}</b></div>
              <div><small>{isKinyarwanda ? 'UMUYOBOZI' : 'ADMINISTRATOR'}</small><b>{draft.administrator || '—'}</b></div>
              {draft.model === 'ACCUMULATING' && <div><small>{isKinyarwanda ? 'IKIGEGA KIRINDWA' : 'RESERVE'}</small><b>{draft.reservePercent}%</b></div>}
            </div>
            <p className={styles.disclaimer}>{isKinyarwanda ? 'Ibi ni ibiteganyijwe gusa. Ubwishyu nyir’izina bushingira ku mafaranga yemejwe; nta mafaranga yimurwa hano.' : 'Estimates only. Payouts depend on confirmed funds; no money moves here.'}</p>
            {message && <p ref={messageRef} tabIndex={-1} className={styles.message} role="alert">{displayedMessage} {message.startsWith('Your session expired.')&&<a href="/login?next=%2Fapp%2Fgroups%2Fstart" target="_blank" rel="noreferrer">{isKinyarwanda?'Fungura aho winjirira':'Open sign-in'}</a>}</p>}
            <label className={styles.accept}>
              <input type="checkbox" checked={draft.acceptsRules} onChange={e => set('acceptsRules', e.target.checked)}/>
              <span>{isKinyarwanda ? 'Nasuzumye aya mabwiriza kandi nemeje ko itsinda ryayemeranyijweho.' : 'I have reviewed these rules and confirm the group has agreed to them.'}</span>
            </label>
            <div className={styles.formActions}>
              <button className={styles.secondary} onClick={() => setStep(2)}>
                <ArrowLeft size={15}/> {isKinyarwanda ? 'Hindura amabwiriza' : 'Edit setup'}
              </button>
              <button className={styles.primary} onClick={() => void submit()} disabled={!onCreate || !draft.acceptsRules || saving}>
                {saving ? (isKinyarwanda ? 'Biratunganywa…' : 'Submitting…') : (isKinyarwanda ? 'Tangiza itsinda' : 'Create group')} {!saving && <ArrowRight size={15}/>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>}
  </section>;
}
