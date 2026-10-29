'use client';

import { useState } from 'react';
import {
  Building2,
  Coins,
  ShieldCheck,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info
} from 'lucide-react';
import s from './cooperative-dashboard.module.css';

export interface CooperativeDraft {
  name: string;
  category: 'agriculture'|'processing'|'service'|'commercial'|'multipurpose';
  district: string;
  sector: string;
  description: string;
  contact: string;
  registrationNumber: string;
  nominalShareValue: number;
  minSharesPerMember: number;
  statutoryReserveBps: number;
  socialFundBps: number;
  dividendPoolBps: number;
  bonusPoolBps: number;
  acceptsRules: boolean;
}

interface CooperativeSetupProps {
  onCreate: (draft: CooperativeDraft) => Promise<boolean>;
  onJoin: (orgId: string) => Promise<boolean>;
  isRw?: boolean;
}

export default function CooperativeSetup({
  onCreate,
  onJoin,
  isRw = false
}: CooperativeSetupProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [joinOrgId, setJoinOrgId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [draft, setDraft] = useState<CooperativeDraft>({
    name: 'Koperative Dufatanye Muhinzi',
    category: 'agriculture',
    district: 'Rulindo',
    sector: 'Buyoga',
    description: 'Agricultural cooperative producing maize and potatoes',
    contact: '0788123456',
    registrationNumber: 'RCA/0428/2021',
    nominalShareValue: 10000,
    minSharesPerMember: 5,
    statutoryReserveBps: 2000, // 20%
    socialFundBps: 1000,       // 10%
    dividendPoolBps: 4000,     // 40%
    bonusPoolBps: 6000,        // 60%
    acceptsRules: true
  });

  const handleNext = () => setStep(prev => Math.min(5, prev + 1));
  const handleBack = () => setStep(prev => Math.max(1, prev - 1));

  const handleCreateSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onCreate(draft);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleJoinSubmit = async () => {
    if (!joinOrgId.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onJoin(joinOrgId.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className={s.container} style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '1rem' }}>
      {/* Header Banner */}
      <section className={s.headerBanner}>
        <div className={s.titleArea}>
          <div className={s.badgeRow}>
            <span className={s.modelBadge}>HURIZA COOPERATIVE OS</span>
            <span className={s.categoryBadge}>{isRw ? 'UBUHINZI N’UBWUNZI' : 'FINANCIAL OPERATING SYSTEM'}</span>
          </div>
          <h1 className={s.orgTitle}>{isRw ? 'Tangiza Koperative Nshya' : 'Onboard a Cooperative'}</h1>
          <p className={s.orgSubtitle}>
            <Building2 size={16} />
            {isRw
              ? 'Gucunga abanyamuryango, imigabane, umusaruro, n’uburyo bwo kugabana inyungu (Member Value Engine)'
              : 'Enterprise-grade governance, shares, produce deliveries and explainable Member Value distribution'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={mode === 'create' ? s.primaryButton : s.secondaryButton}
            onClick={() => setMode('create')}
          >
            {isRw ? 'Kora Koperative' : 'Create Cooperative'}
          </button>
          <button
            className={mode === 'join' ? s.primaryButton : s.secondaryButton}
            onClick={() => setMode('join')}
          >
            {isRw ? 'Injira muri Koperative' : 'Join Cooperative'}
          </button>
        </div>
      </section>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {mode === 'join' && (
        <div className={s.sectionCard}>
          <h2 className={s.sectionTitle}>{isRw ? 'Injira muri Koperative Isanzwe' : 'Join Existing Cooperative'}</h2>
          <p className={s.sectionSubtitle}>
            {isRw
              ? 'Injiza code y’umuryango (Organization ID, urugero: coop-imena) kugira ngo winjire nka munyamuryango.'
              : 'Enter the cooperative organization identifier (e.g. coop-imena) to register your member account.'}
          </p>

          <div className={s.inputGroup} style={{ maxWidth: '400px', marginTop: '1rem' }}>
            <label className={s.inputLabel}>{isRw ? 'Kode ya Koperative (Org ID):' : 'Cooperative Org ID:'}</label>
            <input
              type="text"
              placeholder="e.g. coop-imena"
              value={joinOrgId}
              onChange={e => setJoinOrgId(e.target.value)}
              className={s.textInput}
            />
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button className={s.submitBtn} onClick={handleJoinSubmit} disabled={submitting || !joinOrgId.trim()}>
              {submitting ? (isRw ? 'Biratunganywa…' : 'Joining…') : (isRw ? 'Injira muri Koperative' : 'Join Cooperative')}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {mode === 'create' && (
        <div className={s.sectionCard}>
          {/* Step Progress Indicators */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
            {[
              { num: 1, title: isRw ? 'Imyirondoro' : 'Profile' },
              { num: 2, title: isRw ? 'Imigabane' : 'Shares' },
              { num: 3, title: isRw ? 'Ubuyobozi' : 'Governance' },
              { num: 4, title: isRw ? 'Amategeko' : 'Policies' },
              { num: 5, title: isRw ? 'Isuzuma' : 'Review' }
            ].map(st => (
              <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= st.num ? 1 : 0.5 }}>
                <span style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '9999px',
                  background: step === st.num ? '#2463a6' : step > st.num ? '#15803d' : '#e2e8f0',
                  color: step >= st.num ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}>
                  {step > st.num ? <CheckCircle2 size={14} /> : st.num}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: step === st.num ? '#2463a6' : '#64748b' }}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>

          {/* STEP 1: ORGANIZATION PROFILE */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {isRw ? 'Intambwe ya 1: Imyirondoro ya Koperative' : 'Step 1: Cooperative Profile'}
              </h3>

              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Izina rya Koperative:' : 'Cooperative Legal Name:'}</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  className={s.textInput}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Icyiciro cya Koperative:' : 'Cooperative Category:'}</label>
                  <select
                    value={draft.category}
                    onChange={e => setDraft({ ...draft, category: e.target.value as CooperativeDraft['category'] })}
                    className={s.selectInput}
                  >
                    <option value="agriculture">{isRw ? 'Ubuhinzi n’Ubworozi (Agricultural)' : 'Agricultural Production'}</option>
                    <option value="processing">{isRw ? 'Iby’Inganda no Gutunganya (Processing)' : 'Processing & Manufacturing'}</option>
                    <option value="service">{isRw ? 'Imirimo n’Ubuvuzi (Service)' : 'Service Cooperative'}</option>
                    <option value="commercial">{isRw ? 'Ubucuruzi (Commercial & Trading)' : 'Trading & Commercial'}</option>
                    <option value="multipurpose">{isRw ? 'Ihindagurika (Multipurpose)' : 'Multipurpose Cooperative'}</option>
                  </select>
                </div>

                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Nimero yo Kwiyandikisha (RCA):' : 'RCA Registration Number (if issued):'}</label>
                  <input
                    type="text"
                    placeholder="e.g. RCA/0428/2021"
                    value={draft.registrationNumber}
                    onChange={e => setDraft({ ...draft, registrationNumber: e.target.value })}
                    className={s.textInput}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Akarere (District):' : 'District:'}</label>
                  <input
                    type="text"
                    value={draft.district}
                    onChange={e => setDraft({ ...draft, district: e.target.value })}
                    className={s.textInput}
                  />
                </div>
                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Umurenge (Sector):' : 'Sector:'}</label>
                  <input
                    type="text"
                    value={draft.sector}
                    onChange={e => setDraft({ ...draft, sector: e.target.value })}
                    className={s.textInput}
                  />
                </div>
              </div>

              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Nimero ya Telefone (Contact):' : 'Official Telephone Contact:'}</label>
                <input
                  type="text"
                  value={draft.contact}
                  onChange={e => setDraft({ ...draft, contact: e.target.value })}
                  className={s.textInput}
                />
              </div>

              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ibisobanuro ku bikorwa by’ingenzi:' : 'Description of Operations:'}</label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                  className={s.textInput}
                />
              </div>
            </div>
          )}

          {/* STEP 2: MEMBERSHIP & SHARES */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {isRw ? 'Intambwe ya 2: Imiterere y’Imigabane' : 'Step 2: Membership & Share Capital'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Agaciro k’umugabane umwe (RWF):' : 'Nominal Value per Share (RWF):'}</label>
                  <input
                    type="number"
                    min={100}
                    step={1000}
                    value={draft.nominalShareValue}
                    onChange={e => setDraft({ ...draft, nominalShareValue: Number(e.target.value) })}
                    className={s.textInput}
                  />
                </div>

                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Imigabane fatizo ku munyamuryango:' : 'Minimum Shares Required / Member:'}</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.minSharesPerMember}
                    onChange={e => setDraft({ ...draft, minSharesPerMember: Number(e.target.value) })}
                    className={s.textInput}
                  />
                </div>
              </div>

              <div className={s.mveFormulaExplanation}>
                <Info size={16} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
                {isRw
                  ? `Umunyamuryango mushya azasabwa kwandikwaho byibuze imigabane ${draft.minSharesPerMember} ingana na ${(draft.minSharesPerMember * draft.nominalShareValue).toLocaleString()} Frw.`
                  : `Each member will be required to subscribe for at least ${draft.minSharesPerMember} shares valued at ${(draft.minSharesPerMember * draft.nominalShareValue).toLocaleString()} RWF.`}
              </div>
            </div>
          )}

          {/* STEP 3: GOVERNANCE */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {isRw ? 'Intambwe ya 3: Inzego z’Ubuyobozi' : 'Step 3: Governance & Leadership Structure'}
              </h3>

              <div className={s.mveBanner}>
                <strong>{isRw ? 'Inzego Ziteganywa n’Amategeko y’u Rwanda:' : 'Mandatory Governance Organs (Rwandan Cooperative Law):'}</strong>
                <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
                  <li><b>Inteko Rusange (General Assembly):</b> {isRw ? 'Urwego rukuru rw’abanyamuryango bose.' : 'Supreme governing organ.'}</li>
                  <li><b>Inama y’Ubutegetsi (Board of Directors):</b> {isRw ? 'Perezida, Visi Perezida, Umubitsi, Umunyamabanga.' : 'Chairperson, Vice Chair, Treasurer, Secretary.'}</li>
                  <li><b>Komite Ngenzuzi (Supervisory Committee):</b> {isRw ? 'Igenzura ry’imari n’imiyoborere rikorera Inteko Rusange.' : 'Internal oversight and audit.'}</li>
                  <li><b>Abakozi b’Umwuga (Professional Staff):</b> {isRw ? 'Umucungamari (Accountant) na Manager.' : 'Manager, Accountant and operations staff.'}</li>
                </ul>
              </div>

              <div className={s.mveFormulaExplanation}>
                {isRw
                  ? 'Icyitonderwa cy’umutekano: Uwashinze koperative azahabwa umwanya w’agateganyo w’Ubuyobozi (Chairperson / President) kugira ngo atangize koperative.'
                  : 'Workspace Provisioning: The account creating this cooperative will be provisioned as provisional Chairperson to setup members and leadership appointments.'}
              </div>
            </div>
          )}

          {/* STEP 4: FINANCIAL POLICIES */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {isRw ? 'Intambwe ya 4: Amabwiriza y’Imari n’Inyungu' : 'Step 4: Financial Policies & Surplus Allocations'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Ikigega cy’Itegeko (Statutory Reserve %):' : 'Legal Reserve Allocation (%):'}</label>
                  <input
                    type="number"
                    min={10}
                    max={50}
                    value={draft.statutoryReserveBps / 100}
                    onChange={e => setDraft({ ...draft, statutoryReserveBps: Number(e.target.value) * 100 })}
                    className={s.textInput}
                  />
                </div>

                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Ikigega cy’Imibereho (Social Fund %):' : 'Social & Education Fund (%):'}</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={draft.socialFundBps / 100}
                    onChange={e => setDraft({ ...draft, socialFundBps: Number(e.target.value) * 100 })}
                    className={s.textInput}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Inyungu ku Migabane (Dividends %):' : 'Share Dividend Pool (% of surplus):'}</label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={draft.dividendPoolBps / 100}
                    onChange={e => setDraft({ ...draft, dividendPoolBps: Number(e.target.value) * 100 })}
                    className={s.textInput}
                  />
                </div>

                <div className={s.inputGroup}>
                  <label className={s.inputLabel}>{isRw ? 'Inyungu ku Musaruro (Patronage Bonus %):' : 'Patronage Bonus Pool (% of surplus):'}</label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={draft.bonusPoolBps / 100}
                    onChange={e => setDraft({ ...draft, bonusPoolBps: Number(e.target.value) * 100 })}
                    className={s.textInput}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CREATE */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {isRw ? 'Intambwe ya 5: Isuzuma n’Itangizwa' : 'Step 5: Review & Finalize'}
              </h3>

              <div className={s.mveBanner}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><span>{isRw ? 'Izina rya Koperative:' : 'Cooperative Name:'}</span> <b>{draft.name}</b></div>
                  <div><span>{isRw ? 'Aho Ikorera:' : 'Location:'}</span> <b>{draft.sector}, {draft.district}</b></div>
                  <div><span>{isRw ? 'Ubwoko:' : 'Category:'}</span> <b style={{ textTransform: 'capitalize' }}>{draft.category}</b></div>
                  <div><span>{isRw ? 'Agaciro k’umugabane:' : 'Share Value:'}</span> <b>{draft.nominalShareValue.toLocaleString()} RWF</b></div>
                  <div><span>{isRw ? 'Gugabana inyungu:' : 'Surplus Sharing:'}</span> <b>{draft.statutoryReserveBps / 100}% Legal Reserve · {draft.dividendPoolBps / 100}% Dividends · {draft.bonusPoolBps / 100}% Produce Bonus</b></div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={draft.acceptsRules}
                  onChange={e => setDraft({ ...draft, acceptsRules: e.target.checked })}
                />
                <span>{isRw ? 'Nemeye amabwiriza agenga koperative n’amategeko agenga ibitabo by’imari bya HURIZA.' : 'I accept the cooperative bylaws and HURIZA verified double-entry accounting rules.'}</span>
              </label>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            {step > 1 ? (
              <button className={s.cancelBtn} onClick={handleBack} disabled={submitting}>
                <ArrowLeft size={16} /> {isRw ? 'Subira Inyuma' : 'Back'}
              </button>
            ) : <div />}

            {step < 5 ? (
              <button className={s.submitBtn} onClick={handleNext}>
                {isRw ? 'Komeza' : 'Next'} <ArrowRight size={16} />
              </button>
            ) : (
              <button className={s.submitBtn} style={{ background: '#15803d' }} onClick={handleCreateSubmit} disabled={submitting || !draft.acceptsRules}>
                {submitting ? (isRw ? 'Biratunganywa…' : 'Creating Cooperative…') : (isRw ? 'Tangiza Koperative' : 'Launch Cooperative')}
                <Sparkles size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
