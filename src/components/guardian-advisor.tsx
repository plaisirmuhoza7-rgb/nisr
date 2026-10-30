'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  FileText,
  Building2,
  Wallet,
  Coins,
  RefreshCw,
  Scale
} from 'lucide-react';
import type {
  GuardianResult,
  MemberGuardianContext,
  OfficerGuardianContext,
  Fact
} from '@/lib/guardian/types';

interface GuardianAdvisorProps {
  money: (n: number) => string;
  isRw: boolean;
  onOpenSimulator?: () => void;
}

export function GuardianAdvisor({ money, isRw, onOpenSimulator }: GuardianAdvisorProps) {
  const [loading, setLoading] = useState(true);
  const [memberCtx, setMemberCtx] = useState<MemberGuardianContext | null>(null);
  const [officerCtx, setOfficerCtx] = useState<OfficerGuardianContext | null>(null);
  const [isOfficer, setIsOfficer] = useState(false);

  // Active question selection
  type QuestionTab = 'affordability' | 'missed_payment' | 'plan_compare' | 'payout_fit' | 'cycle_health';
  const [activeQuestion, setActiveQuestion] = useState<QuestionTab>('affordability');

  // Input states for decisions
  const [proposedContribution, setProposedContribution] = useState<number>(10000);
  const [householdBuffer, setHouseholdBuffer] = useState<number>(30000);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [selectedObligationId, setSelectedObligationId] = useState<string>('');

  // Plan compare inputs
  const [planTarget, setPlanTarget] = useState<number>(150000);
  const [planSaved, setPlanSaved] = useState<number>(25000);

  // Officer inputs
  const [proposedPayout, setProposedPayout] = useState<number>(50000);
  const [recipientName, setRecipientName] = useState<string>('Uwase Claudine');
  const [cycleDelayBps, setCycleDelayBps] = useState<number>(0);
  const [plannedLoanCount, setPlannedLoanCount] = useState<number>(2);
  const [plannedLoanAmt, setPlannedLoanAmt] = useState<number>(100000);

  // Evaluation result state
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<GuardianResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load authorized context on mount
  const loadContext = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guardian');
      if (!res.ok) {
        throw new Error('Failed to load financial context');
      }
      const data = await res.json();
      setMemberCtx(data.memberContext);
      setOfficerCtx(data.officerContext);
      setIsOfficer(Boolean(data.isOfficer));

      if (data.memberContext?.obligations?.[0]) {
        setSelectedObligationId(data.memberContext.obligations[0].id);
      }
      if (data.memberContext?.goals?.[0]) {
        setSelectedGoalId(data.memberContext.goals[0].id);
        setPlanTarget(data.memberContext.goals[0].target);
        setPlanSaved(data.memberContext.goals[0].saved);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading context');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  // Run evaluation
  const runEvaluation = async (overrideTab?: QuestionTab) => {
    const tab = overrideTab || activeQuestion;
    setEvaluating(true);
    setError(null);
    try {
      let body: any = { lang: isRw ? 'rw' : 'en' };

      if (tab === 'affordability') {
        body = {
          ...body,
          question: 'contribution_affordability',
          proposedContribution: Number(proposedContribution) || 0,
          householdBuffer: Number(householdBuffer) || 0,
          goalId: selectedGoalId || undefined
        };
      } else if (tab === 'missed_payment') {
        if (!selectedObligationId) {
          throw new Error(isRw ? 'Nta musanzu watoranyijwe' : 'No obligation selected');
        }
        body = {
          ...body,
          question: 'missed_payment',
          obligationId: selectedObligationId
        };
      } else if (tab === 'plan_compare') {
        body = {
          ...body,
          question: 'plan_compare',
          target: Number(planTarget) || 1,
          saved: Number(planSaved) || 0,
          periodsList: [3, 6, 12]
        };
      } else if (tab === 'payout_fit') {
        if (!officerCtx) {
          throw new Error(isRw ? 'Uyu mwanya ugenewe abayobozi gusa' : 'Officer context required');
        }
        body = {
          ...body,
          question: 'payout_fit',
          orgId: officerCtx.orgId,
          proposedPayoutAmount: Number(proposedPayout) || 1,
          recipientName: recipientName.trim() || 'Member'
        };
      } else if (tab === 'cycle_health') {
        if (!officerCtx) {
          throw new Error(isRw ? 'Uyu mwanya ugenewe abayobozi gusa' : 'Officer context required');
        }
        body = {
          ...body,
          question: 'cycle_health',
          orgId: officerCtx.orgId,
          repaymentDelayBps: Number(cycleDelayBps) || 0,
          plannedLoanRequests: Number(plannedLoanCount) || 0,
          plannedLoanAmount: Number(plannedLoanAmt) || 0
        };
      }

      const res = await fetch('/api/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Evaluation failed');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Evaluation error');
      setResult(null);
    } finally {
      setEvaluating(false);
    }
  };

  // Run initial evaluation once context loads
  useEffect(() => {
    if (memberCtx) {
      runEvaluation(activeQuestion);
    }
  }, [memberCtx, activeQuestion, isRw]);

  const sourceBadge = (source: Fact['source']) => {
    switch (source) {
      case 'confirmed':
        return <span className="status-badge" style={{ background: '#e1f5fe', color: '#0277bd', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>{isRw ? 'Yemejwe' : 'Confirmed'}</span>;
      case 'estimate':
        return <span className="status-badge" style={{ background: '#fff8e1', color: '#f57f17', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>{isRw ? 'Igereranyo' : 'Estimate'}</span>;
      case 'assumption':
        return <span className="status-badge" style={{ background: '#ede7f6', color: '#512da8', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>{isRw ? 'Gahunda' : 'Assumption'}</span>;
      case 'missing':
        return <span className="status-badge" style={{ background: '#ffebee', color: '#c62828', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>{isRw ? 'Ntibiraboneka' : 'Missing'}</span>;
    }
  };

  const verdictBadge = (verdict: GuardianResult['verdict']) => {
    switch (verdict) {
      case 'ok':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e8f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '6px', fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            <span>{isRw ? 'Byemewe / Bifatika' : 'Supported & Affordable'}</span>
          </div>
        );
      case 'caution':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff3e0', color: '#e65100', padding: '4px 12px', borderRadius: '6px', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>{isRw ? 'Icyitonderwa' : 'Caution / High Strain'}</span>
          </div>
        );
      case 'not_advised':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffebee', color: '#c62828', padding: '4px 12px', borderRadius: '6px', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>{isRw ? 'Birenze ubushobozi' : 'Not Advised / Deficit'}</span>
          </div>
        );
      case 'insufficient_information':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eceff1', color: '#455a64', padding: '4px 12px', borderRadius: '6px', fontWeight: 600 }}>
            <HelpCircle size={16} />
            <span>{isRw ? 'Amakuru adahagije' : 'Insufficient Information'}</span>
          </div>
        );
    }
  };

  return (
    <div className="guardian-advisor-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner: Decision-support framing */}
      <div style={{ background: 'linear-gradient(135deg, #0d3b66 0%, #1e5288 100%)', color: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px', borderRadius: '10px' }}>
              <ShieldCheck size={28} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                {isRw ? 'Guardian AI — Umuyobozi w’Imyanzuro y’Imari' : 'Guardian AI — Financial Decision Support'}
              </h2>
              <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>
                {isRw
                  ? 'Genzura imyanzuro ifatika hagendewe ku mategeko y’itsinda n’imibare yemejwe. Nta gitabo cy’imari gihinduka.'
                  : 'Evaluate real financial decisions against verified records and group bylaws. Transparent, auditable, and read-only.'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => loadContext()}
              disabled={loading}
              className="secondary-button"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {isRw ? 'Kuvugurura' : 'Refresh Data'}
            </button>
            <Link
              href="/app/simulator"
              style={{ background: '#fff', color: '#0d3b66', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <Sparkles size={14} />
              {isRw ? 'Igerageza ry’imari' : 'Scenario Lab'}
            </Link>
          </div>
        </div>

        {/* Scoped context summary badges */}
        {memberCtx && (
          <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wallet size={14} opacity={0.8} />
              <span>{isRw ? 'Amafaranga ku makonti:' : 'Liquid Balances:'}</span>
              <b>{money(memberCtx.totalWalletBalance)}</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} opacity={0.8} />
              <span>{isRw ? 'Imisanzu yegereje:' : 'Upcoming Dues:'}</span>
              <b>{money(memberCtx.totalUpcomingObligations)}</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} opacity={0.8} />
              <span>{isRw ? 'Imyenda igomba kwishyurwa:' : 'Debts Owed:'}</span>
              <b>{money(memberCtx.totalDebtOwed)}</b>
            </div>
            {officerCtx && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                <Building2 size={14} />
                <span>{officerCtx.groupName} ({officerCtx.model}):</span>
                <b>{money(officerCtx.cash)}</b>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decision Question Picker Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveQuestion('affordability')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeQuestion === 'affordability' ? '2px solid #0d3b66' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeQuestion === 'affordability' ? 700 : 500,
            color: activeQuestion === 'affordability' ? '#0d3b66' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Coins size={16} />
          {isRw ? 'Uyu musanzu ndawushoboye?' : 'Can I Afford This Contribution?'}
        </button>

        <button
          onClick={() => setActiveQuestion('missed_payment')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeQuestion === 'missed_payment' ? '2px solid #0d3b66' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeQuestion === 'missed_payment' ? 700 : 500,
            color: activeQuestion === 'missed_payment' ? '#0d3b66' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={16} />
          {isRw ? 'Guhusha ubwishyu bihindura iki?' : 'What Does a Missed Payment Change?'}
        </button>

        <button
          onClick={() => setActiveQuestion('plan_compare')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeQuestion === 'plan_compare' ? '2px solid #0d3b66' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeQuestion === 'plan_compare' ? 700 : 500,
            color: activeQuestion === 'plan_compare' ? '#0d3b66' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Scale size={16} />
          {isRw ? 'Ni iyihe gahunda yo kuzigama inkwiye?' : 'Which Savings Plan Fits My Goal?'}
        </button>

        {isOfficer && (
          <>
            <button
              onClick={() => setActiveQuestion('payout_fit')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: activeQuestion === 'payout_fit' ? '2px solid #0d3b66' : '2px solid transparent',
                background: 'transparent',
                fontWeight: activeQuestion === 'payout_fit' ? 700 : 500,
                color: activeQuestion === 'payout_fit' ? '#0d3b66' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ShieldCheck size={16} color="#0284c7" />
              {isRw ? 'Gusohora amafaranga byemewe n’amategeko?' : 'Does Proposed Payout Fit Group Rules?'}
            </button>

            <button
              onClick={() => setActiveQuestion('cycle_health')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: activeQuestion === 'cycle_health' ? '2px solid #0d3b66' : '2px solid transparent',
                background: 'transparent',
                fontWeight: activeQuestion === 'cycle_health' ? 700 : 500,
                color: activeQuestion === 'cycle_health' ? '#0d3b66' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Building2 size={16} color="#0284c7" />
              {isRw ? 'Ubuzima bw’itsinda mu cyiciro gitaha' : 'Group Health Next Cycle'}
            </button>
          </>
        )}
      </div>

      {/* Main Two-Column Layout: Parameter Inputs on Left, Reasoning & Tradeoffs on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Parameter Adjustments */}
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#0d3b66" />
            {isRw ? 'Genzura ibipimo n’ibiteganywa' : 'Adjust Assumptions & Parameters'}
          </h3>

          {activeQuestion === 'affordability' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Umusanzu uteganya gutanga (RWF):' : 'Proposed Contribution Amount (RWF):'}
                </label>
                <input
                  type="number"
                  value={proposedContribution}
                  onChange={e => setProposedContribution(Math.max(0, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Amafaranga y’ingoboka y’urugo (RWF):' : 'Living / Household Safety Buffer (RWF):'}
                </label>
                <input
                  type="number"
                  value={householdBuffer}
                  onChange={e => setHouseholdBuffer(Math.max(0, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="0"
                  step="5000"
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {isRw ? 'Amafaranga ukeneye ku ruhande yo gutunga urugo adakwiye gukorwaho.' : 'Funds set aside for immediate living essentials that should not be touched.'}
                </small>
              </div>

              {memberCtx && memberCtx.goals.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {isRw ? 'Intego bifitanye isano (kubushake):' : 'Linked Personal Goal (Optional):'}
                  </label>
                  <select
                    value={selectedGoalId}
                    onChange={e => setSelectedGoalId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                  >
                    <option value="">{isRw ? '-- Nta ntego yatoranyijwe --' : '-- No linked goal --'}</option>
                    {memberCtx.goals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({money(g.saved)} / {money(g.target)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeQuestion === 'missed_payment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Hitamo umusanzu ugenzura:' : 'Select Obligation to Analyze:'}
                </label>
                {memberCtx && memberCtx.obligations.length > 0 ? (
                  <select
                    value={selectedObligationId}
                    onChange={e => setSelectedObligationId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                  >
                    {memberCtx.obligations.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.groupName} — {money(o.amountDue - o.amountConfirmed)} ({o.dueDate})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0' }}>
                    {isRw ? 'Nta misanzu yegereje ufite muri aka kanya.' : 'No upcoming obligations recorded for your account.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeQuestion === 'plan_compare' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Amafaranga yose y’intego (Target RWF):' : 'Total Goal Target (RWF):'}
                </label>
                <input
                  type="number"
                  value={planTarget}
                  onChange={e => setPlanTarget(Math.max(1, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="1"
                  step="10000"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Amaze kuzigamwa kugeza ubu (Saved RWF):' : 'Already Saved (RWF):'}
                </label>
                <input
                  type="number"
                  value={planSaved}
                  onChange={e => setPlanSaved(Math.max(0, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="0"
                  step="5000"
                />
              </div>
            </div>
          )}

          {activeQuestion === 'payout_fit' && officerCtx && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Amafaranga y’ihemba ateganywa (RWF):' : 'Proposed Disbursement Amount (RWF):'}
                </label>
                <input
                  type="number"
                  value={proposedPayout}
                  onChange={e => setProposedPayout(Math.max(1, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="1"
                  step="10000"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Izina ry’uhembwa:' : 'Scheduled Recipient Name:'}
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                />
              </div>
            </div>
          )}

          {activeQuestion === 'cycle_health' && officerCtx && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Ugutinda kwishyura kwitezwe (%):' : 'Repayment Delay Assumption (%):'}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={cycleDelayBps / 100}
                  onChange={e => setCycleDelayBps(Number(e.target.value) * 100)}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>0% (On time)</span>
                  <b>{cycleDelayBps / 100}% delayed</b>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Inguzanyo ziteganywa gutangwa:' : 'Planned Loan Requests Count:'}
                </label>
                <input
                  type="number"
                  value={plannedLoanCount}
                  onChange={e => setPlannedLoanCount(Math.max(0, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="0"
                  max="50"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {isRw ? 'Ingano ya buri nguzanyo (RWF):' : 'Average Loan Size (RWF):'}
                </label>
                <input
                  type="number"
                  value={plannedLoanAmt}
                  onChange={e => setPlannedLoanAmt(Math.max(0, Number(e.target.value)))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }}
                  min="0"
                  step="10000"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => runEvaluation()}
            disabled={evaluating}
            style={{
              marginTop: '20px',
              width: '100%',
              padding: '10px',
              background: '#0d3b66',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: evaluating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ShieldCheck size={18} />
            {evaluating ? (isRw ? 'Iribarura...' : 'Evaluating...') : (isRw ? 'Suzuma Iki Cyemezo' : 'Evaluate Decision')}
          </button>
        </div>

        {/* Right Column: Reasoning, Explanation, Trade-offs & Next Steps */}
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Verdict Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  {verdictBadge(result.verdict)}
                  <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    {isRw ? 'Ibarura ryemejwe (BigInt)' : 'Deterministic Safe Math'}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {isRw ? result.headlineRw : result.headline}
                </h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: 1.5 }}>
                  {isRw ? result.explanationRw : result.explanation}
                </p>
              </div>

              {/* Verified Facts Table */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} />
                  {isRw ? 'Imibare yifashishijwe n’inkomoko yayo' : 'Verified Figures & Provenance'}
                </h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>{isRw ? 'Igipimo' : 'Metric'}</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>{isRw ? 'Amafaranga' : 'Value'}</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>{isRw ? 'Inkomoko' : 'Provenance'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.facts.map(f => (
                        <tr key={f.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>
                            {isRw && f.labelRw ? f.labelRw : f.label}
                            {f.notes && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.notes}</div>}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                            {f.formattedValue || (f.value !== null ? money(f.value) : '—')}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {sourceBadge(f.source)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trade-offs & Consequences */}
              {result.tradeoffs.length > 0 && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    {isRw ? 'Ingaruka n’ibyo kuzirikana (Trade-offs):' : 'Key Trade-offs & Consequences:'}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(isRw && result.tradeoffsRw && result.tradeoffsRw.length > 0 ? result.tradeoffsRw : result.tradeoffs).map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actionable Next Steps (Never moves money; points to authorized flows) */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  {isRw ? 'Intambwe ikurikira ushobora gutera:' : 'Actionable Next Steps:'}
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {result.nextSteps.map(step => (
                    <Link
                      key={step.label}
                      href={step.href}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        color: '#0d3b66',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      <span>{isRw ? step.labelRw : step.label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Formulas & Assumptions Accordion / Footer */}
              <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <p style={{ margin: '0 0 4px 0' }}>
                  <b>{isRw ? 'Amategeko y’ibarura:' : 'Deterministic Formulas:'}</b> {result.formulas.join(' • ')}
                </p>
                <p style={{ margin: 0 }}>
                  <b>{isRw ? 'Amakuru y’ingoboka:' : 'Assumptions:'}</b> {result.assumptions.join(' • ')}
                </p>
              </div>
            </>
          )}

          {!result && !error && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <ShieldCheck size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {isRw ? 'Hitamo ibipimo maze ukande "Suzuma Iki Cyemezo".' : 'Adjust the inputs and click "Evaluate Decision" to see the verified analysis.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
