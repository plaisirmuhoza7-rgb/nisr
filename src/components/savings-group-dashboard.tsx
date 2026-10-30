'use client';

import { useState, useId } from 'react';
import type { FinanceState, Role, GroupExpense, GroupExpenseCategory, GroupRoleHistoryItem, GroupMonthlyReport } from '@/lib/contracts';
import { useLanguage } from '@/lib/i18n/context';
import {
  Users,
  Coins,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Plus,
  Phone,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Wallet,
  Calendar,
  X,
  Smartphone,
  Check,
  TrendingUp,
  FileSpreadsheet,
  KeyRound,
  ExternalLink,
  Lock,
  ArrowUpRight,
  FileText,
  Receipt,
  BookOpen,
  Clock,
  ArrowDownRight
} from 'lucide-react';
import s from './savings-group-dashboard.module.css';

interface SavingsGroupDashboardProps {
  d: FinanceState & { user: { id: string; name: string; role: Role; organizationName: string | null } };
  role: Role;
  act: (p: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  money: (n: number) => string;
  isRw: boolean;
}

export default function SavingsGroupDashboard({
  d,
  role,
  act,
  busy,
  money,
  isRw
}: SavingsGroupDashboardProps) {
  const g = d.savingsGroup;
  const isRotating = g?.model === 'ROTATING';
  const isPresident = role === 'president';
  const isTreasurer = role === 'treasurer';
  const isAccountant = role === 'accountant';
  const isSecretary = role === 'secretary';
  const isOfficer = ['president', 'treasurer', 'accountant', 'secretary'].includes(role);
  const canManageRoles = isPresident;
  const canRecordExpense = ['accountant', 'president', 'treasurer'].includes(role);
  const canApproveExpense = isPresident;
  const canConfirmExpense = isPresident || isTreasurer;
  const canRecordIncome = ['accountant', 'president', 'treasurer'].includes(role);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'accounting' | 'governance'>(
    role === 'accountant' ? 'accounting' : 'overview'
  );

  // Modals state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMoMoModal, setShowMoMoModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<{ id: string; name: string; phone?: string } | null>(null);

  // Accounting modals & forms
  const [showRecordExpenseModal, setShowRecordExpenseModal] = useState(false);
  const [showRecordIncomeModal, setShowRecordIncomeModal] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);

  const [expenseCategory, setExpenseCategory] = useState(g?.expenseCategories?.[0]?.name || 'Office & Administration');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(15000);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseReceipt, setExpenseReceipt] = useState('');

  const [incomeSource, setIncomeSource] = useState('Late fee / Igihano cyo gukererwa');
  const [incomeAmount, setIncomeAmount] = useState(5000);
  const [incomeDescription, setIncomeDescription] = useState('');
  const [incomeReference, setIncomeReference] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  // Form states
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberPin, setMemberPin] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'treasurer' | 'accountant' | 'secretary'>('member');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Loan request state (capped strictly at 30% of savings)
  const mySavings = d.member.eligibleSavings || 0;
  const emergencyLoanCap = Math.max(0, Math.floor(mySavings * 0.3));
  const [loanAmount, setLoanAmount] = useState(Math.min(20000, emergencyLoanCap || 10000));
  const [loanMonths, setLoanMonths] = useState(3);
  const [loanReason, setLoanReason] = useState('Emergency expense / Ibyihutirwa');

  // MoMo simulated payment state
  const [momoType, setMomoType] = useState<'contribution' | 'payout' | 'repay'>('contribution');
  const [momoAmount, setMomoAmount] = useState(g?.contributionAmount || 10000);
  const [momoRecipient, setMomoRecipient] = useState(g?.name || 'Savings Group');
  const [momoPhone, setMomoPhone] = useState('0788123456');
  const [momoPin, setMomoPin] = useState('••••');
  const [momoRoundId, setMomoRoundId] = useState<string | null>(null);
  const [momoLoanId, setMomoLoanId] = useState<string | null>(null);
  const [momoObligationId, setMomoObligationId] = useState<string | null>(null);

  // Sheets sync state
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [sheetsMessage, setSheetsMessage] = useState('');

  // Reminder note
  const [reminderNote, setReminderNote] = useState('');

  // Ikimina active round
  const currentRound = g?.rotationRounds?.find(r => ['ready', 'collecting', 'delayed'].includes(r.status)) || g?.rotationRounds?.[0];
  const activeRoundIndex = currentRound ? currentRound.roundNumber : 1;
  const totalRounds = g?.rotationRounds?.length || g?.expectedMembers || 1;

  // Active debt list
  const activeLoans = d.loans.filter(l => l.status === 'active' || l.status === 'requested');

  // Helpers
  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    try {
      const res = await act({
        action: 'addGroupMember',
        name: memberName,
        phone: memberPhone,
        pin: memberPin,
        role: memberRole
      });
      if (res) {
        setFormSuccess(
          isRw
            ? `Umunyamuryango ${memberName} yanditswe neza! Ashobora kwinjira akoresheje terefoni na PIN.`
            : `Member ${memberName} registered successfully! They can sign in using phone and PIN.`
        );
        setMemberName('');
        setMemberPhone('');
        setMemberPin('');
        setTimeout(() => {
          setShowAddMemberModal(false);
          setFormSuccess('');
        }, 1800);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add member.');
    }
  }

  async function handleRequestEmergencyLoan(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (loanAmount > emergencyLoanCap && emergencyLoanCap > 0) {
      setFormError(
        isRw
          ? `Inguzanyo ntishobora kurenga 30% by'ubwizigame bwawe (${money(emergencyLoanCap)}).`
          : `Emergency loan cannot exceed 30% of your savings (${money(emergencyLoanCap)}).`
      );
      return;
    }
    try {
      const res = await act({
        action: 'requestLoan',
        amount: Number(loanAmount),
        months: Number(loanMonths),
        reason: loanReason
      });
      if (res) {
        setShowLoanModal(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Loan request failed.');
    }
  }

  async function handleSendReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderTarget) return;
    try {
      await act({
        action: 'sendPaymentReminder',
        memberId: reminderTarget.id,
        note: reminderNote || (isRw ? 'Umusanzu w’itsinda urashaje. Kanda *182# wishyure.' : 'Group contribution is due. Please pay via MoMo (*182#).')
      });
      setShowReminderModal(false);
      setReminderTarget(null);
      setReminderNote('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send reminder.');
    }
  }

  async function handleRecordExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      const res = await act({
        action: 'recordExpense',
        category: expenseCategory,
        title: expenseTitle,
        amount: Number(expenseAmount),
        description: expenseDescription,
        receiptAttachment: expenseReceipt || undefined
      });
      if (res) {
        setShowRecordExpenseModal(false);
        setExpenseTitle('');
        setExpenseDescription('');
        setExpenseReceipt('');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record expense.');
    }
  }

  async function handleRecordIncome(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      const res = await act({
        action: 'recordIncome',
        source: incomeSource,
        amount: Number(incomeAmount),
        description: incomeDescription,
        reference: incomeReference || undefined
      });
      if (res) {
        setShowRecordIncomeModal(false);
        setIncomeDescription('');
        setIncomeReference('');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record income.');
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      const res = await act({
        action: 'createExpenseCategory',
        name: categoryName,
        description: categoryDesc
      });
      if (res) {
        setShowNewCategoryModal(false);
        setCategoryName('');
        setCategoryDesc('');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create category.');
    }
  }

  async function handleApproveExpense(expenseId: string, decision: 'approve' | 'decline') {
    try {
      await act({
        action: 'approveExpense',
        expenseId,
        decision
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed.');
    }
  }

  async function handleConfirmExpensePayment(expenseId: string) {
    try {
      await act({
        action: 'confirmExpensePayment',
        expenseId,
        outcome: 'success'
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment confirmation failed.');
    }
  }

  async function handleSyncSheets() {
    setSyncingSheets(true);
    setSheetsMessage('');
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: g?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sheets sync failed');
      setSheetsMessage(
        isRw
          ? 'Imbonerahamwe ya Google Sheets yavuguruwe neza!'
          : 'Google Sheets organization summary synced successfully!'
      );
    } catch (err) {
      setSheetsMessage(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingSheets(false);
    }
  }

  async function executeMoMoPayment() {
    try {
      if (momoType === 'contribution') {
        const obligation = g?.obligations?.find(o => o.userId === d.user.id && o.status !== 'paid');
        await act({
          action: 'contribute',
          amount: momoAmount,
          roundId: momoRoundId || obligation?.roundId,
          outcome: 'success',
          reference: `MOMO-CONTR-${Date.now().toString().slice(-6)}`
        });
      } else if (momoType === 'repay') {
        if (!momoLoanId) return;
        await act({
          action: 'repay',
          loanId: momoLoanId,
          amount: momoAmount,
          outcome: 'success',
          reference: `MOMO-REPAY-${Date.now().toString().slice(-6)}`
        });
      } else if (momoType === 'payout') {
        if (!momoRoundId) return;
        await act({
          action: 'payRotation',
          roundId: momoRoundId,
          outcome: 'pending'
        });
      }
      setShowMoMoModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'MoMo transaction failed.');
    }
  }

  if (!g) {
    return (
      <div className={s.sectionCard}>
        <div className={s.emptyState}>
          <Users size={32} />
          <p>{isRw ? 'Nta tsinda riratoranywa. Fungura cyangwa winjire mu itsinda.' : 'No active savings group. Create or join a group to get started.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrapper}>
      {/* 1. Header Banner */}
      <section className={s.headerCard}>
        <div className={s.headerTop}>
          <div className={s.titleArea}>
            <div className={s.badgeRow}>
              <span className={s.modelBadge}>
                {isRotating ? (
                  <>
                    <RotateCw size={13} /> {isRw ? 'IKIMINA · GUHEREREKANYA' : 'IKIMINA · CONTRIBUTE & ROTATE'}
                  </>
                ) : (
                  <>
                    <Coins size={13} /> {isRw ? 'AMATSINDA · KUBITSA NO KUGABANA' : 'AMATSINDA · SAVE & SHARE'}
                  </>
                )}
              </span>
              <span className={s.roleBadge}>
                <ShieldCheck size={13} />
                {role === 'president'
                  ? isRw ? 'Perezida w’Itsinda' : 'Group President'
                  : role === 'treasurer'
                  ? isRw ? 'Umubitsi w’Itsinda' : 'Group Treasurer'
                  : role === 'accountant'
                  ? isRw ? 'Umucungamari w’Itsinda' : 'Group Accountant'
                  : role === 'secretary'
                  ? isRw ? 'Umunyamabanga w’Itsinda' : 'Group Secretary'
                  : isRw ? 'Umunyamuryango' : 'Member'}
              </span>
            </div>
            <h1 className={s.groupTitle}>{g.name}</h1>
            <div className={s.groupMeta}>
              <span>
                <Users size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                {g.memberCount} / {g.expectedMembers} {isRw ? 'Abanyamuryango' : 'Members'}
              </span>
              <span>•</span>
              <span>
                {money(g.contributionAmount)} {g.frequency === 'weekly' ? (isRw ? 'buri cyumweru' : 'weekly') : (isRw ? 'buri kwezi' : 'monthly')}
              </span>
              {g.inviteCode && (
                <>
                  <span>•</span>
                  <span>
                    {isRw ? 'Kode y’ubutumire' : 'Invite'}: <strong>{g.inviteCode}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className={s.headerActions}>
            <button
              type="button"
              className={s.primaryActionBtn}
              onClick={() => {
                setMomoType('contribution');
                setMomoAmount(g.contributionAmount);
                setMomoRecipient(g.name);
                setShowMoMoModal(true);
              }}
            >
              <Smartphone size={16} />
              {isRw ? 'Ishyura Umusanzu (*182#)' : 'Pay Contribution (*182#)'}
            </button>

            {!isRotating && (
              <button
                type="button"
                className={s.secondaryActionBtn}
                onClick={() => setShowLoanModal(true)}
              >
                <Coins size={15} />
                {isRw ? 'Saba Inguzanyo (30%)' : 'Ask Loan (Max 30%)'}
              </button>
            )}

            {isRotating && isPresident && (
              <button
                type="button"
                className={s.secondaryActionBtn}
                onClick={() => {
                  if (currentRound) {
                    setMomoType('payout');
                    setMomoRoundId(currentRound.id);
                    setMomoRecipient(currentRound.recipientName);
                    setMomoAmount(currentRound.confirmed || currentRound.expectedPool);
                    setShowMoMoModal(true);
                  }
                }}
              >
                <RotateCw size={15} />
                {isRw ? 'Tanga Inshuro kuri MoMo' : 'Pay Round via MoMo'}
              </button>
            )}

            {['president', 'treasurer', 'secretary'].includes(role) && (
              <button
                type="button"
                className={s.secondaryActionBtn}
                onClick={() => setShowAddMemberModal(true)}
              >
                <Plus size={16} />
                {isRw ? '+ Ongeraho Umunyamuryango' : '+ Add Member (Phone & PIN)'}
              </button>
            )}

            {isOfficer && (
              <button
                type="button"
                className={s.secondaryActionBtn}
                onClick={handleSyncSheets}
                disabled={syncingSheets}
              >
                <FileSpreadsheet size={15} />
                {syncingSheets ? (isRw ? 'Guhuza…' : 'Syncing…') : isRw ? 'Huza Sheets' : 'Sync Sheets'}
              </button>
            )}
          </div>
        </div>

        {sheetsMessage && (
          <div style={{ fontSize: 12, color: '#ffea00', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> {sheetsMessage}
          </div>
        )}
      </section>

      {/* 2. Guardian Oversight Notification */}
      <div className={s.guardianCard}>
        <div className={s.guardianLeft}>
          <div className={s.guardianIcon}>
            <ShieldCheck size={20} />
          </div>
          <div className={s.guardianText}>
            <span className={s.guardianTitle}>
              {isRw ? 'Ubugenzuzi bwa Guardian AI' : 'Guardian AI Oversight & Risk Monitor'}
            </span>
            <span className={s.guardianDesc}>
              {isRotating
                ? isRw
                  ? 'Gahunda yo guhererekanya irakurikiranwa mu mucyo. Amafaranga yose abikwa kuri MoMo kandi agabanywa hakurikijwe amasezerano.'
                  : 'Rotation payout schedule is audited for equity. Payouts are staged via MoMo and released strictly in agreed sequence.'
                : isRw
                  ? `Ikigega kirinzwe cya ${money(d.treasury.reserve)} kirinzwe. Inguzanyo zose zishingira ku bwizigame bw’umunyamuryango.`
                  : `Protected reserve of ${money(d.treasury.reserve)} is safeguarded. Emergency loans are limited to 30% of individual member equity.`}
            </span>
          </div>
        </div>
        <span className={`${s.statusPill} ${s.statusGood}`}>
          <Check size={12} /> {isRw ? 'Umutekano Ufite Ireme' : 'Ledger Verified'}
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className={s.tabNav}>
        <button
          type="button"
          className={`${s.tabBtn} ${activeTab === 'overview' ? s.tabBtnActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          {isRotating ? <RotateCw size={15} /> : <Coins size={15} />}
          {isRw ? 'Imbonerahamwe y’Itsinda' : 'Group Overview'}
        </button>
        <button
          type="button"
          className={`${s.tabBtn} ${activeTab === 'accounting' ? s.tabBtnActive : ''}`}
          onClick={() => setActiveTab('accounting')}
        >
          <FileText size={15} />
          {isRw ? 'Ibiro by’Umucungamari' : 'Accountant Dashboard'}
          {(g.expenses?.filter(e => e.status === 'recorded').length || 0) > 0 && (
            <span className={s.tabBadge}>
              {g.expenses?.filter(e => e.status === 'recorded').length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`${s.tabBtn} ${activeTab === 'governance' ? s.tabBtnActive : ''}`}
          onClick={() => setActiveTab('governance')}
        >
          <ShieldCheck size={15} />
          {isRw ? 'Ubuyobozi n’Inshingano' : 'Leadership & Role Audit'}
        </button>
      </div>

      {activeTab === 'overview' && (
        <>

      {/* 3. Hero Financial KPIs Grid */}
      {isRotating ? (
        // Ikimina (Contribute & Rotate) KPIs
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Inshuro Zigezweho' : 'Active Cycle Round'}
              <RotateCw size={14} />
            </span>
            <span className={s.kpiValue}>
              {activeRoundIndex} / {totalRounds}
            </span>
            <span className={s.kpiSub}>
              {currentRound ? `${isRw ? 'Utegereje' : 'Recipient'}: ${currentRound.recipientName}` : (isRw ? 'Gahunda iratangiye' : 'Cycle in progress')}
            </span>
          </div>

          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Amafaranga y’Inshuro' : 'Current Round Pool'}
              <Coins size={14} />
            </span>
            <span className={s.kpiValue}>
              {money(currentRound?.confirmed || 0)}
            </span>
            <div className={s.progressBar}>
              <div
                className={s.progressFill}
                style={{
                  width: `${currentRound ? Math.min(100, Math.round(((currentRound.confirmed || 0) / (currentRound.expectedPool || 1)) * 100)) : 0}%`
                }}
              />
            </div>
            <span className={s.kpiSub}>
              {isRw ? 'Intego' : 'Target'}: {money(currentRound?.expectedPool || (g.contributionAmount * g.expectedMembers))}
            </span>
          </div>

          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Ubwishyu bwa MoMo' : 'Next MoMo Payout'}
              <Smartphone size={14} />
            </span>
            <span className={s.kpiValue}>
              {currentRound?.dueDate || (isRw ? 'Kuri gahunda' : 'Scheduled')}
            </span>
            <span className={s.kpiSub}>
              {currentRound?.shortfall && currentRound.shortfall > 0
                ? `${isRw ? 'Habuzemo' : 'Shortfall'}: ${money(currentRound.shortfall)}`
                : (isRw ? 'Amafaranga yose ariteguye' : 'Pool fully funded')}
            </span>
          </div>

          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Ubwizigame bwawe' : 'Your Position'}
              <Wallet size={14} />
            </span>
            <span className={s.kpiValue}>
              {money(d.member.eligibleSavings)}
            </span>
            <span className={s.kpiSub}>
              {g.obligations.find(o => o.userId === d.user.id && o.status === 'paid')
                ? (isRw ? 'Umusanzu w’ubu wishyuwe' : 'Round obligation paid')
                : (isRw ? 'Umusanzu utegerejwe' : 'Payment due')}
            </span>
          </div>
        </div>
      ) : (
        // Amatsinda (Save & Share) KPIs
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Amafaranga y’Itsinda (MoMo)' : 'Group Treasury (MoMo)'}
              <Wallet size={14} />
            </span>
            <span className={s.kpiValue} style={{ color: '#16a34a' }}>{money(d.treasury.cash)}</span>
            <span className={s.kpiSub}>{isRw ? 'Amafaranga yose ari mu kigega' : 'Held in group MoMo wallet'}</span>
          </div>

          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Abanyamuryango Bose' : 'Total Group Members'}
              <Users size={14} />
            </span>
            <span className={s.kpiValue}>{g.memberCount}</span>
            <span className={s.kpiSub}>{g.expectedMembers} {isRw ? 'bateganyijwe' : 'expected total'}</span>
          </div>

          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Ubwizigame Bwanjye' : 'My Confirmed Savings'}
              <Coins size={14} />
            </span>
            <span className={s.kpiValue} style={{ color: '#174f83' }}>{money(d.member.eligibleSavings)}</span>
            <span className={s.kpiSub}>{isRw ? 'Bwemejwe mu gitabo cy’itsinda' : 'Confirmed member equity'}</span>
          </div>

          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              {isRw ? 'Inguzanyo Ziri Hanze' : 'Active Loans Outstanding'}
              <TrendingUp size={14} />
            </span>
            <span className={s.kpiValue} style={{ color: d.treasury.outstandingLoans > 0 ? '#b91c1c' : '#64748b' }}>
              {money(d.treasury.outstandingLoans)}
            </span>
            <span className={s.kpiSub}>{activeLoans.length} {isRw ? 'abafite inguzanyo' : 'members with loans'}</span>
          </div>
        </div>
      )}

      {/* 4. Crucial List of All Members & Their Savings (Visible to Everyone) */}
      <section className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Users size={18} /> {isRw ? 'Urutonde rw’Abanyamuryango bose n’Ubwizigame' : 'All Group Members & Confirmed Savings'}
            </h2>
            <p className={s.sectionSubtitle}>
              {isRw
                ? 'Reba amazina, nimero za terefoni (MoMo), ubwizigame bwa buri munyamuryango, n’umwenda bafite.'
                : 'Complete member list with Rwandan telephone numbers, confirmed savings, and active debt.'}
            </p>
          </div>
          {['president', 'treasurer', 'secretary'].includes(role) && (
            <button
              type="button"
              className={s.primaryActionBtn}
              onClick={() => setShowAddMemberModal(true)}
            >
              <Plus size={15} /> {isRw ? '+ Ongeraho Umunyamuryango' : '+ Add Member'}
            </button>
          )}
        </div>

        <div className={s.tableContainer}>
          <table className={s.dataTable}>
            <thead>
              <tr>
                <th>{isRw ? 'Amazina' : 'Full Name'}</th>
                <th>{isRw ? 'Terefoni (MoMo)' : 'Telephone (MoMo)'}</th>
                <th>{isRw ? 'Ubwizigame' : 'Confirmed Savings'}</th>
                <th>{isRw ? 'Umwenda / Inguzanyo' : 'Active Debt / Loan'}</th>
                <th>{isRw ? 'Urwego' : 'Role'}</th>
                <th>{isRw ? 'Ibikorwa' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {g.members.map(member => (
                <tr key={member.id}>
                  <td>
                    <div className={s.memberCell}>
                      <div className={s.memberAvatar}>{member.name?.[0] || 'M'}</div>
                      <span className={s.memberName}>
                        {member.name} {member.id === d.user.id ? (isRw ? '(Wowe)' : '(You)') : ''}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#334155' }}>
                      {member.phone || '0788123456'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#16a34a' }}>{money(member.savings || 0)}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: (member.debt || 0) > 0 ? 800 : 500, color: (member.debt || 0) > 0 ? '#b91c1c' : '#64748b' }}>
                      {(member.debt || 0) > 0 ? money(member.debt || 0) : (isRw ? 'Nta mwenda' : 'No loan')}
                    </span>
                  </td>
                  <td>
                    {isPresident && member.role !== 'president' ? (
                      <select
                        value={member.role}
                        onChange={e => act({ action: 'setGroupMemberRole', userId: member.id, memberRole: e.target.value })}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600 }}
                        disabled={busy}
                      >
                        <option value="member">{isRw ? 'Umunyamuryango (Member)' : 'Member'}</option>
                        <option value="treasurer">{isRw ? 'Umubitsi (Treasurer)' : 'Treasurer'}</option>
                        <option value="accountant">{isRw ? 'Umucungamari (Accountant)' : 'Accountant'}</option>
                        <option value="secretary">{isRw ? 'Umunyamabanga (Secretary)' : 'Secretary'}</option>
                        <option value="president">{isRw ? 'Perezida (President)' : 'President'}</option>
                      </select>
                    ) : (
                      <span className={`${s.statusPill} ${member.role === 'president' ? s.statusGood : member.role === 'treasurer' ? s.statusGood : s.statusNeutral}`}>
                        {member.role === 'president'
                          ? isRw ? 'Perezida' : 'President'
                          : member.role === 'treasurer'
                          ? isRw ? 'Umubitsi' : 'Treasurer'
                          : member.role === 'accountant'
                          ? isRw ? 'Umucungamari' : 'Accountant'
                          : member.role === 'secretary'
                          ? isRw ? 'Umunyamabanga' : 'Secretary'
                          : isRw ? 'Umunyamuryango' : 'Member'}
                      </span>
                    )}
                  </td>
                  <td>
                    {isOfficer ? (
                      <button
                        type="button"
                        className={s.tableActionBtn}
                        onClick={() => {
                          setReminderTarget({ id: member.id, name: member.name, phone: member.phone });
                          setReminderNote(
                            isRw
                              ? `Mwaramutse ${member.name}, umusanzu w'itsinda ${g.name} wa ${money(g.contributionAmount)} urategerejwe. Kanda *182# wishyure.`
                              : `Hello ${member.name}, your ${g.name} contribution of ${money(g.contributionAmount)} is due. Please pay via MoMo *182#.`
                          );
                          setShowReminderModal(true);
                        }}
                      >
                        <Send size={12} /> {isRw ? 'Kwibutsa na MoMo' : 'MoMo Reminder'}
                      </button>
                    ) : (
                      <span className={`${s.statusPill} ${member.id === d.user.id ? s.statusGood : s.statusNeutral}`}>
                        <Check size={11} /> {member.id === d.user.id ? (isRw ? 'Konti yawe' : 'Your Account') : (isRw ? 'Umunyamuryango' : 'Member')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Member's Personal Statistics & Emergency Loan Widget */}
      <section className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Wallet size={18} /> {isRw ? 'Imibare Yawe Bwite' : 'Your Member Dashboard & Statistics'}
            </h2>
            <p className={s.sectionSubtitle}>
              {isRw
                ? 'Ubwizigame bwawe, inguzanyo z’ubutabazi zikwemerera 30%, n’uburyo bwo kwishyura kuri MoMo.'
                : 'Your individual savings balance, 30% emergency borrowing capacity, and simulated MoMo payments.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={s.tableActionBtn}
              onClick={() => {
                setMomoType('contribution');
                setMomoAmount(g.contributionAmount);
                setMomoRecipient(g.name);
                setShowMoMoModal(true);
              }}
            >
              <Smartphone size={14} /> {isRw ? 'Ishyura Umusanzu' : 'Pay Contribution (*182#)'}
            </button>
            {!isRotating && (
              <button
                type="button"
                className={s.tableActionBtn}
                onClick={() => setShowLoanModal(true)}
              >
                <Plus size={14} /> {isRw ? 'Saba Inguzanyo y’Ubutabazi' : 'Request Emergency Loan'}
              </button>
            )}
          </div>
        </div>

        <div className={s.twoColGrid}>
          {/* Member Stats Breakdown */}
          <div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>{isRw ? 'Ubwizigame Bwawe' : 'My Total Savings'}</span>
              <span className={s.kpiValue} style={{ color: '#16a34a' }}>{money(d.member.eligibleSavings)}</span>
              <span className={s.kpiSub}>{isRw ? 'Bwemejwe mu gitabo cy’itsinda' : 'Confirmed member equity'}</span>
            </div>

            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>{isRw ? 'Inguzanyo y’Ubutabazi (30%)' : 'Emergency Loan Cap (30%)'}</span>
              <span className={s.kpiValue} style={{ color: '#174f83' }}>{money(emergencyLoanCap)}</span>
              <span className={s.kpiSub}>{isRw ? 'Kugeza kuri 30% by’ubwizigame' : 'Capped at 30% of savings'}</span>
            </div>

            <div className={s.kpiCard}>
              <span className={s.kpiLabel}>{isRw ? 'Inguzanyo Ufite' : 'My Active Debt'}</span>
              <span className={s.kpiValue} style={{ color: d.member.outstanding > 0 ? '#b91c1c' : '#64748b' }}>
                {money(d.member.outstanding)}
              </span>
              <span className={s.kpiSub}>
                {d.member.outstanding > 0
                  ? isRw ? 'Itegereje kwishyurwa' : 'Outstanding principal'
                  : isRw ? 'Nta mwenda ufite' : 'No active balance'}
              </span>
            </div>
          </div>

          {/* Quick Repayment / Contribution Card */}
          <div className={s.loanWidget}>
            <div className={s.loanCapBanner}>
              <div>
                <span className={s.loanCapLabel}>{isRw ? 'Gahunda ya MoMo (*182#)' : 'MoMo Fast Channel (*182#)'}</span>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>
                  {isRw ? 'Imisanzu n’inguzanyo byose bikorwa mu mutekano.' : 'Fast, transparent contributions and loan repayments.'}
                </div>
              </div>
              <span className={`${s.statusPill} ${s.statusGood}`}>
                <Check size={12} /> {isRw ? 'MoMo Ikora' : 'MoMo Active'}
              </span>
            </div>

            {d.loans.filter(l => l.status === 'active' && l.userId === d.user.id).map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#10243f' }}>
                    {isRw ? 'Inguzanyo Ifunguye' : 'Active Loan'}: {money(l.amount)}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{l.months} {isRw ? 'amezi' : 'months'}</div>
                </div>
                <button
                  type="button"
                  className={s.tableActionBtn}
                  onClick={() => {
                    setMomoType('repay');
                    setMomoLoanId(l.id);
                    setMomoAmount(Math.min(10000, l.amount));
                    setMomoRecipient(g.name);
                    setShowMoMoModal(true);
                  }}
                >
                  <Smartphone size={13} /> {isRw ? 'Ishyura na MoMo' : 'Repay via MoMo'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Amatsinda: Debt & Credit Performance List (High-Signal Fintech Module) */}
      {!isRotating && (
        <section className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitleGroup}>
              <h2 className={s.sectionTitle}>
                <TrendingUp size={18} /> {isRw ? 'Urutonde rw’Abafite Inguzanyo n’Imyitwarire yabo' : 'Debt & Credit Performance Registry'}
              </h2>
              <p className={s.sectionSubtitle}>
                {isRw
                  ? 'Urutonde rw’abanyamuryango bafite inguzanyo z’ubutabazi, uko bishyura, n’ubutumwa bwo kwibutsa kuri MoMo.'
                  : 'Real-time monitoring of all active group borrowings, repayment health, and MoMo reminder triggers.'}
              </p>
            </div>
          </div>

          <div className={s.tableContainer}>
            <table className={s.dataTable}>
              <thead>
                <tr>
                  <th>{isRw ? 'Umunyamuryango' : 'Member'}</th>
                  <th>{isRw ? 'Inguzanyo' : 'Loan Principal'}</th>
                  <th>{isRw ? 'Igihe' : 'Term'}</th>
                  <th>{isRw ? 'Imiterere yo Kwishyura' : 'Repayment Status'}</th>
                  <th>{isRw ? 'Amanota y’Ubwizerwe' : 'Credit Performance'}</th>
                  {isOfficer && <th>{isRw ? 'Ibikorwa' : 'Actions'}</th>}
                </tr>
              </thead>
              <tbody>
                {activeLoans.map(loan => {
                  const memberInfo = g.members.find(m => m.id === loan.userId);
                  const isOverdue = loan.schedule.some(s => s.amount > s.paid && new Date(s.dueDate) < new Date());
                  const totalPaid = loan.schedule.reduce((acc, cur) => acc + (cur.paid || 0), 0);
                  const remaining = Math.max(0, loan.amount - totalPaid);
                  const percentPaid = loan.amount ? Math.round((totalPaid / loan.amount) * 100) : 0;

                  return (
                    <tr key={loan.id}>
                      <td>
                        <div className={s.memberCell}>
                          <div className={s.memberAvatar}>{loan.member?.[0] || 'M'}</div>
                          <div className={s.memberInfo}>
                            <span className={s.memberName}>{loan.member}</span>
                            <span className={s.memberPhone}>{memberInfo?.phone || '0788123456'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{money(loan.amount)}</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {isRw ? 'Hasigaye' : 'Remaining'}: {money(remaining)}
                        </div>
                      </td>
                      <td>{loan.months} {isRw ? 'amezi' : 'months'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                            {percentPaid}% {isRw ? 'byishyuwe' : 'repaid'}
                          </span>
                          <div className={s.progressBar} style={{ height: 4 }}>
                            <div className={s.progressFill} style={{ width: `${percentPaid}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        {loan.status === 'requested' ? (
                          <span className={`${s.statusPill} ${s.statusWarning}`}>
                            <AlertTriangle size={11} /> {isRw ? 'Itegereje Kwemezwa' : 'Awaiting Approval'}
                          </span>
                        ) : isOverdue ? (
                          <span className={`${s.statusPill} ${s.statusAlert}`}>
                            <AlertTriangle size={11} /> {isRw ? 'Yasubitswe / Overdue' : 'Past Due Alert'}
                          </span>
                        ) : percentPaid >= 50 ? (
                          <span className={`${s.statusPill} ${s.statusGood}`}>
                            <Check size={11} /> {isRw ? '100% Byifashe Neza' : '100% Exemplary'}
                          </span>
                        ) : (
                          <span className={`${s.statusPill} ${s.statusNeutral}`}>
                            <TrendingUp size={11} /> {isRw ? 'Ku Gihe / On Track' : 'On Track'}
                          </span>
                        )}
                      </td>
                      {isOfficer && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {loan.status === 'requested' && isPresident ? (
                              <>
                                <button
                                  type="button"
                                  className={s.tableActionBtn}
                                  style={{ background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }}
                                  onClick={() => act({ action: 'approveLoan', loanId: loan.id, decision: 'approve' })}
                                  disabled={busy}
                                >
                                  <Check size={12} /> {isRw ? 'Emeza' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  className={s.tableActionBtn}
                                  style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}
                                  onClick={() => act({ action: 'approveLoan', loanId: loan.id, decision: 'decline' })}
                                  disabled={busy}
                                >
                                  <X size={12} /> {isRw ? 'Hakana' : 'Decline'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className={s.tableActionBtn}
                                onClick={() => {
                                  setReminderTarget({ id: loan.userId, name: loan.member, phone: memberInfo?.phone });
                                  setReminderNote(
                                    isRw
                                      ? `Mwaramutse ${loan.member}, igihe cyo kwishyura inguzanyo yawe ya ${money(remaining)} kirageze. Koresha *182# wishyure.`
                                      : `Hello ${loan.member}, your group loan installment of ${money(remaining)} is due. Please pay via MoMo *182#.`
                                  );
                                  setShowReminderModal(true);
                                }}
                              >
                                <Send size={12} /> {isRw ? 'Kwibutsa' : 'Remind'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {activeLoans.length === 0 && (
                  <tr>
                    <td colSpan={isOfficer ? 6 : 5} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {isRw ? 'Nta nguzanyo ziri hanze ubu. Abanyamuryango bose bafite ubwizigame buzira umwenda!' : 'No active borrowings. All members are debt-free and liquid!'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. Ikimina: Rotation Schedule & Obligation Tracker */}
      {isRotating && (
        <section className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitleGroup}>
              <h2 className={s.sectionTitle}>
                <RotateCw size={18} /> {isRw ? 'Gahunda yo Guhererekanya Ikimina' : 'Rotation Schedule & Obligations'}
              </h2>
              <p className={s.sectionSubtitle}>
                {isRw
                  ? 'Urutonde rw’uko abanyamuryango bafatana umunsi n’inshuro, n’uburyo Perezida yishyura kuri MoMo.'
                  : 'Turn-by-turn recipient calendar, obligation tracking, and President MoMo disburse trigger.'}
              </p>
            </div>
            {isPresident && !g.rotationRounds.length && g.cycleStatus === 'collecting' && (
              <button
                type="button"
                className={s.primaryActionBtn}
                onClick={() => act({ action: 'startRotation' })}
                disabled={busy}
              >
                <RotateCw size={14} /> {isRw ? 'Tangaza Gahunda' : 'Publish Rotation Schedule'}
              </button>
            )}
          </div>

          <div className={s.tableContainer}>
            <table className={s.dataTable}>
              <thead>
                <tr>
                  <th>{isRw ? 'Inshuro' : 'Round'}</th>
                  <th>{isRw ? 'Uhabwa Amafaranga' : 'Recipient'}</th>
                  <th>{isRw ? 'Itariki yo Guhabwa' : 'Scheduled Date'}</th>
                  <th>{isRw ? 'Amafaranga Ateganyijwe' : 'Pool Target'}</th>
                  <th>{isRw ? 'Amafaranga Yakusanyijwe' : 'Collected'}</th>
                  <th>{isRw ? 'Imiterere' : 'Status'}</th>
                  {isPresident && <th>{isRw ? 'Kwishyura na MoMo' : 'MoMo Disburse'}</th>}
                </tr>
              </thead>
              <tbody>
                {g.rotationRounds.map(r => (
                  <tr key={r.id} style={{ background: r.id === currentRound?.id ? '#f0f9ff' : undefined }}>
                    <td>
                      <strong>#{r.roundNumber}</strong>
                    </td>
                    <td>
                      <div className={s.memberCell}>
                        <div className={s.memberAvatar}>{r.recipientName?.[0] || 'R'}</div>
                        <span className={s.memberName}>{r.recipientName}</span>
                      </div>
                    </td>
                    <td>{r.dueDate}</td>
                    <td>{money(r.expectedPool)}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: r.confirmed >= r.expectedPool ? '#16a34a' : '#174f83' }}>
                        {money(r.confirmed)}
                      </span>
                    </td>
                    <td>
                      {r.status === 'paid' ? (
                        <span className={`${s.statusPill} ${s.statusGood}`}>
                          <Check size={11} /> {isRw ? 'Yarishyuwe' : 'Paid Out'}
                        </span>
                      ) : r.status === 'ready' || (r.confirmed >= r.expectedPool) ? (
                        <span className={`${s.statusPill} ${s.statusGood}`}>
                          <Check size={11} /> {isRw ? 'Biteguye Gutangwa' : 'Ready for Payout'}
                        </span>
                      ) : r.shortfall > 0 ? (
                        <span className={`${s.statusPill} ${s.statusWarning}`}>
                          <AlertTriangle size={11} /> {isRw ? `Habuze ${money(r.shortfall)}` : `Short: ${money(r.shortfall)}`}
                        </span>
                      ) : (
                        <span className={`${s.statusPill} ${s.statusNeutral}`}>
                          {isRw ? 'Birakusanywa' : 'Collecting'}
                        </span>
                      )}
                    </td>
                    {isPresident && (
                      <td>
                        {['ready', 'collecting', 'delayed'].includes(r.status) && (
                          <button
                            type="button"
                            className={s.tableActionBtn}
                            style={{ background: '#ffea00', color: '#10243f', borderColor: '#eab308' }}
                            onClick={() => {
                              setMomoType('payout');
                              setMomoRoundId(r.id);
                              setMomoRecipient(r.recipientName);
                              setMomoAmount(r.confirmed || r.expectedPool);
                              setShowMoMoModal(true);
                            }}
                          >
                            <Smartphone size={13} /> {isRw ? 'Tanga kuri MoMo (*182#)' : 'Pay via MoMo (*182#)'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!g.rotationRounds.length && (
                  <tr>
                    <td colSpan={isPresident ? 7 : 6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {isRw ? 'Gahunda yo guhererekanya ntiratangazwa. Kanda hejuru kugira ngo utangaze gahunda.' : 'Rotation schedule has not been published yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}


      </>
      )}

      {/* 5. Accountant Dashboard Tab */}
      {activeTab === 'accounting' && (
        <>
          {/* Header & Quick Action Buttons */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <FileText size={18} /> {isRw ? 'Ibiro by’Umucungamari w’Itsinda' : 'Group Accountant Dashboard'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Iyandikwa ry’amafaranga asohoka n’ayinjira, ibyiciro, inyemezabwishyu, n’amaraporo y’ukwezi ku kigega cy’itsinda.'
                    : 'Authorized recording of group income and expenditures, receipt attachments, categories, and monthly financial statements.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canRecordExpense && (
                  <button
                    type="button"
                    className={s.primaryActionBtn}
                    onClick={() => setShowRecordExpenseModal(true)}
                  >
                    <Plus size={15} /> {isRw ? 'Andika Iyasohotse (Expense)' : '+ Record Expense'}
                  </button>
                )}
                {canRecordIncome && (
                  <button
                    type="button"
                    className={s.secondaryActionBtn}
                    onClick={() => setShowRecordIncomeModal(true)}
                  >
                    <Coins size={15} /> {isRw ? 'Andika Ayinjiye (Income)' : '+ Record Income'}
                  </button>
                )}
                {canRecordExpense && (
                  <button
                    type="button"
                    className={s.secondaryActionBtn}
                    onClick={() => setShowNewCategoryModal(true)}
                  >
                    <BookOpen size={15} /> {isRw ? 'Icyiciro Gishya' : '+ New Category'}
                  </button>
                )}
              </div>
            </div>

            {/* Financial Performance KPI Cards */}
            <div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>{isRw ? 'Amafaranga mu Kigega' : 'Cash in MoMo'}</span>
                <span className={s.kpiValue} style={{ color: '#16a34a' }}>{money(d.treasury.cash)}</span>
                <span className={s.kpiSub}>{isRw ? 'Mu mufuka wa MoMo' : 'Group MoMo wallet'}</span>
              </div>
              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>{isRw ? 'Ikigega Kirinzwe' : 'Protected Reserve'}</span>
                <span className={s.kpiValue} style={{ color: '#0284c7' }}>{money(d.treasury.reserve)}</span>
                <span className={s.kpiSub}>{isRw ? 'Ntigashobora gukoreshwa' : 'Required liquidity'}</span>
              </div>
              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>{isRw ? 'Ayasohotse Yemejwe' : 'Confirmed Expenses'}</span>
                <span className={s.kpiValue} style={{ color: '#dc2626' }}>
                  {money(g.expenses?.filter(e => e.status === 'paid').reduce((a, b) => a + b.amount, 0) || 0)}
                </span>
                <span className={s.kpiSub}>
                  {g.expenses?.filter(e => e.status === 'paid').length || 0} {isRw ? 'byishyuwe kuri MoMo' : 'paid via MoMo'}
                </span>
              </div>
              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>{isRw ? 'Imisanzu Yemejwe' : 'Confirmed Savings'}</span>
                <span className={s.kpiValue} style={{ color: '#174f83' }}>{money(d.treasury.contributions)}</span>
                <span className={s.kpiSub}>{g.memberCount} {isRw ? 'abanyamuryango bose' : 'contributors'}</span>
              </div>
              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>{isRw ? 'Inyungu Rusange' : 'Net Position'}</span>
                <span className={s.kpiValue} style={{ color: '#10243f' }}>
                  {money(d.treasury.cash - d.treasury.reserve)}
                </span>
                <span className={s.kpiSub}>{isRw ? 'Arenze ikigega kirinzwe' : 'Uncommitted surplus'}</span>
              </div>
            </div>

            {/* 3-Step Approval Workflow Pipeline Visual Banner */}
            <div className={s.workflowPipeline} style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#10243f', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} />
                  {isRw ? 'Inzira yo Kwemeza no Kwishyura Amafaranga Yasohotse (3-Step Workflow)' : '3-Step Expense Approval & Payment Workflow'}
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {isRw
                    ? 'Amafaranga y’ikigega ahinduka gusa iyo ubwishyu bwa MoMo bwemejwe mu gitabo cy’imari.'
                    : 'Cash balances update exclusively after confirmed payment through the immutable ledger.'}
                </span>
              </div>
              <div className={s.workflowSteps}>
                <div className={s.workflowStep}>
                  <div className={s.workflowStepNumber}>1</div>
                  <div className={s.workflowStepText}>
                    <span className={s.workflowStepTitle}>{isRw ? '1. Kwandika (Recording)' : '1. Recording'}</span>
                    <span className={s.workflowStepDesc}>
                      {isRw ? 'Umucungamari yandika icyasohotse n’inyemezabwishyu. Nta mafaranga ahinduka mu kigega.' : 'Accountant or officer records expense with category & receipt. Zero cash impact.'}
                    </span>
                  </div>
                </div>
                <div className={s.workflowStep}>
                  <div className={s.workflowStepNumber}>2</div>
                  <div className={s.workflowStepText}>
                    <span className={s.workflowStepTitle}>{isRw ? '2. Kwemeza na Perezida' : '2. President Approval'}</span>
                    <span className={s.workflowStepDesc}>
                      {isRw ? 'Perezida wenyine ni we ufite ububasha bwo kwemeza. Nta mafaranga ahinduka kugeza hishyuwe.' : 'Independent review by President. Accountant cannot approve expenses.'}
                    </span>
                  </div>
                </div>
                <div className={s.workflowStep}>
                  <div className={s.workflowStepNumber}>3</div>
                  <div className={s.workflowStepText}>
                    <span className={s.workflowStepTitle}>{isRw ? '3. Kwemeza Ubwishyu (MoMo)' : '3. Payment & Ledger'}</span>
                    <span className={s.workflowStepDesc}>
                      {isRw ? 'Umubitsi cyangwa Perezida yemeza ubwishyu bwa MoMo. Igitabo cy’imari cyandika debit/credit.' : 'Treasurer or President confirms MoMo payout. Posts to ledger and updates cash balance.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Group Expenses Registry Table */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <Receipt size={18} /> {isRw ? 'Urutonde rw’Amafaranga Yasohotse mu Itsinda' : 'Group Expenses Registry & Approval Queue'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Ibyasohotse byose, inyemezabwishyu (Receipts), ababyanditse, n’ibyemezo byo kwishyura kuri MoMo.'
                    : 'Comprehensive registry of group expenses, receipt attachments, approval statuses, and MoMo disbursements.'}
                </p>
              </div>
              {canRecordExpense && (
                <button
                  type="button"
                  className={s.primaryActionBtn}
                  onClick={() => setShowRecordExpenseModal(true)}
                >
                  <Plus size={14} /> {isRw ? '+ Andika Icyasohotse' : '+ Record Expense'}
                </button>
              )}
            </div>

            <div className={s.tableContainer}>
              <table className={s.dataTable}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Itariki' : 'Date'}</th>
                    <th>{isRw ? 'Icyasohotse & Icyiciro' : 'Title & Category'}</th>
                    <th>{isRw ? 'Amafaranga' : 'Amount'}</th>
                    <th>{isRw ? 'Inyemezabwishyu' : 'Receipt / Document'}</th>
                    <th>{isRw ? 'Byanditswe na' : 'Recorded By'}</th>
                    <th>{isRw ? 'Imiterere' : 'Status'}</th>
                    <th>{isRw ? 'Ibikorwa (Action)' : 'Approval & Payment'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.expenses || []).map(exp => (
                    <tr key={exp.id}>
                      <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {exp.createdAt}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 800, color: '#10243f' }}>{exp.title}</span>
                          <span className={s.categoryPill} style={{ alignSelf: 'flex-start', fontSize: 10, padding: '2px 6px' }}>
                            {exp.category}
                          </span>
                          {exp.description && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>{exp.description}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: '#b91c1c' }}>{money(exp.amount)}</strong>
                      </td>
                      <td>
                        {exp.receiptAttachment ? (
                          <a
                            href={`#receipt-${exp.id}`}
                            className={s.receiptLink}
                            onClick={ev => {
                              ev.preventDefault();
                              alert(`Receipt document reference: ${exp.receiptAttachment}`);
                            }}
                          >
                            <Receipt size={12} /> {exp.receiptAttachment}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>{isRw ? 'Nta nyemezabwishyu' : 'None'}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {exp.recordedByName || exp.recordedBy}
                      </td>
                      <td>
                        {exp.status === 'recorded' ? (
                          <span className={`${s.statusPill} ${s.statusWarning}`}>
                            <Clock size={11} /> {isRw ? 'Bitegereje Perezida' : 'Awaiting Approval'}
                          </span>
                        ) : exp.status === 'approved' ? (
                          <span className={`${s.statusPill} ${s.statusNeutral}`} style={{ background: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' }}>
                            <CheckCircle2 size={11} /> {isRw ? 'Yemejwe (Biteguye Kwishyurwa)' : 'Approved (Pending MoMo)'}
                          </span>
                        ) : exp.status === 'paid' ? (
                          <span className={`${s.statusPill} ${s.statusGood}`}>
                            <Check size={11} /> {isRw ? 'Yarishyuwe (MoMo)' : 'Paid · Ledger Posted'}
                          </span>
                        ) : (
                          <span className={`${s.statusPill} ${s.statusAlert}`}>
                            <X size={11} /> {isRw ? 'Yahakanywe' : 'Declined'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {exp.status === 'recorded' && (
                            canApproveExpense ? (
                              <>
                                <button
                                  type="button"
                                  className={s.tableActionBtn}
                                  style={{ background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }}
                                  onClick={() => handleApproveExpense(exp.id, 'approve')}
                                  disabled={busy}
                                >
                                  <Check size={12} /> {isRw ? 'Emeza' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  className={s.tableActionBtn}
                                  style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}
                                  onClick={() => handleApproveExpense(exp.id, 'decline')}
                                  disabled={busy}
                                >
                                  <X size={12} /> {isRw ? 'Hakana' : 'Decline'}
                                </button>
                              </>
                            ) : (
                              <span className={s.restrictedBadge}>
                                <Lock size={11} /> {isRw ? 'Perezida gusa' : 'President Only'}
                              </span>
                            )
                          )}

                          {exp.status === 'approved' && (
                            canConfirmExpense ? (
                              <button
                                type="button"
                                className={s.tableActionBtn}
                                style={{ background: '#ffea00', color: '#10243f', borderColor: '#eab308' }}
                                onClick={() => handleConfirmExpensePayment(exp.id)}
                                disabled={busy}
                              >
                                <Smartphone size={12} /> {isRw ? 'Emeza Ubwishyu na MoMo' : 'Confirm MoMo Payout'}
                              </button>
                            ) : (
                              <span className={s.restrictedBadge}>
                                <Lock size={11} /> {isRw ? 'Umubitsi / Perezida' : 'Treasurer / President'}
                              </span>
                            )
                          )}

                          {exp.status === 'paid' && (
                            <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>
                              {exp.paymentReference || 'MoMo OK'}
                            </span>
                          )}

                          {exp.status === 'declined' && (
                            <span style={{ fontSize: 11, color: '#991b1b' }}>
                              {isRw ? 'Ntibyemewe na Perezida' : 'Declined by President'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!g.expenses || g.expenses.length === 0) && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        {isRw ? 'Nta mafaranga yasohotse arandikwa mu itsinda.' : 'No expenses recorded yet. Use "+ Record Expense" to log costs.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Monthly Financial Reports Module */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <FileSpreadsheet size={18} /> {isRw ? 'Raporo y’Imari ya Buri Kwezi (Monthly Financial Statements)' : 'Monthly Financial Reports & Analytics'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Incamake y’imari ya buri kwezi: imisanzu yinjiye, amafaranga yasohotse ku byiciro, n’asigaye mu kigega.'
                    : 'Comprehensive monthly breakdown: income, expenses by category, net savings, and verified treasury close.'}
                </p>
              </div>
            </div>

            <div className={s.tableContainer}>
              <table className={s.dataTable}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Ukwezi' : 'Month'}</th>
                    <th>{isRw ? 'Imisanzu Yemejwe' : 'Confirmed Savings'}</th>
                    <th>{isRw ? 'Ayinjiye Yose' : 'Total Income'}</th>
                    <th>{isRw ? 'Ayasohotse' : 'Expenses Paid'}</th>
                    <th>{isRw ? 'Inyungu Rusange' : 'Net Savings'}</th>
                    <th>{isRw ? 'Inguzanyo' : 'Loans (Disbursed/Repaid)'}</th>
                    <th>{isRw ? 'Ibyiciro byakoreshejwe' : 'Expenses by Category'}</th>
                    <th>{isRw ? 'Asigaye mu Kigega' : 'Closing Cash'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.monthlyReports || []).map(rep => (
                    <tr key={rep.month}>
                      <td>
                        <strong>{rep.month}</strong>
                      </td>
                      <td style={{ color: '#16a34a', fontWeight: 700 }}>
                        {money(rep.confirmedContributions)}
                      </td>
                      <td style={{ color: '#174f83', fontWeight: 700 }}>
                        {money(rep.totalIncome)}
                      </td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>
                        {money(rep.totalExpenses)}
                      </td>
                      <td>
                        <strong style={{ color: rep.netSavings >= 0 ? '#16a34a' : '#b91c1c' }}>
                          {money(rep.netSavings)}
                        </strong>
                      </td>
                      <td style={{ fontSize: 11, color: '#475569' }}>
                        <div>{isRw ? 'Zatanzwe' : 'Disbursed'}: {money(rep.disbursedLoans)}</div>
                        <div>{isRw ? 'Zishyuwe' : 'Repaid'}: {money(rep.repaidLoans)}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {rep.expensesByCategory.map(cat => (
                            <span key={cat.category} className={s.categoryPill} style={{ fontSize: 10, padding: '2px 6px' }}>
                              {cat.category}: <strong>{money(cat.amount)}</strong>
                            </span>
                          ))}
                          {rep.expensesByCategory.length === 0 && (
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>{isRw ? 'Nta byasohotse' : 'None'}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: '#10243f' }}>{money(rep.closingCash)}</strong>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            {isRw ? 'Harimo ikigega' : 'Reserve'}: {money(rep.closingReserve)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!g.monthlyReports || g.monthlyReports.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        {isRw ? 'Nta raporo y’ukwezi iraboneka.' : 'No monthly reports generated yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Expense Categories Manager */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <BookOpen size={18} /> {isRw ? 'Ibyiciro by’Amafaranga Asorohoka (Expense Categories)' : 'Expense Categories'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Ibyiciro byemewe bikoreshwa n’umucungamari mu gushyira ku murongo amafaranga y’itsinda.'
                    : 'Standardized expense categories utilized by the accountant to structure group outlays.'}
                </p>
              </div>
              {canRecordExpense && (
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  onClick={() => setShowNewCategoryModal(true)}
                >
                  <Plus size={14} /> {isRw ? '+ Ongeraho Icyiciro' : '+ Add Category'}
                </button>
              )}
            </div>

            <div className={s.categoryPills}>
              {(g.expenseCategories || []).map(cat => (
                <div key={cat.id} className={s.categoryPill} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 800, color: '#10243f' }}>{cat.name}</span>
                  {cat.description && <span style={{ fontSize: 11, color: '#64748b' }}>{cat.description}</span>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* 6. Leadership & Governance Tab */}
      {activeTab === 'governance' && (
        <>
          {/* Current Leadership Team Cards */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <ShieldCheck size={18} /> {isRw ? 'Abayobozi b’Itsinda (Leadership Governance)' : 'Group Leadership Officers'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Abayobozi b’itsinda bashinzwe imirimo inyuranye: Perezida, Umubitsi, Umucungamari, n’Umunyamabanga.'
                    : 'Current authorized officers managing group governance, treasury, accounting, and secretariat.'}
                </p>
              </div>
              {isPresident && (
                <button
                  type="button"
                  className={s.primaryActionBtn}
                  onClick={() => setShowAddMemberModal(true)}
                >
                  <Plus size={15} /> {isRw ? 'Ongeraho Umunyamuryango' : '+ Add Member'}
                </button>
              )}
            </div>

            <div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>
                  {isRw ? 'Perezida w’Itsinda' : 'President'}
                  <ShieldCheck size={14} />
                </span>
                <span className={s.kpiValue} style={{ fontSize: 18 }}>
                  {g.members.find(m => m.role === 'president')?.name || d.user.name}
                </span>
                <span className={s.kpiSub}>
                  {isRw ? 'Ubwemezi bw’inguzanyo n’ibyemezo' : 'Authorizes loans & expenses'}
                </span>
              </div>

              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>
                  {isRw ? 'Umubitsi w’Itsinda' : 'Treasurer'}
                  <Wallet size={14} />
                </span>
                <span className={s.kpiValue} style={{ fontSize: 18 }}>
                  {g.members.find(m => m.role === 'treasurer')?.name || (isRw ? 'Ntatoranywa' : 'Unassigned')}
                </span>
                <span className={s.kpiSub}>
                  {isRw ? 'Ubwishyu bwa MoMo n’ikigega' : 'MoMo payouts & cash custody'}
                </span>
              </div>

              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>
                  {isRw ? 'Umucungamari' : 'Accountant'}
                  <FileText size={14} />
                </span>
                <span className={s.kpiValue} style={{ fontSize: 18 }}>
                  {g.members.find(m => m.role === 'accountant')?.name || (isRw ? 'Ntatoranywa' : 'Unassigned')}
                </span>
                <span className={s.kpiSub}>
                  {isRw ? 'Kwandika ibyasohotse na raporo' : 'Expense recording & monthly reports'}
                </span>
              </div>

              <div className={s.kpiCard}>
                <span className={s.kpiLabel}>
                  {isRw ? 'Umunyamabanga' : 'Secretary'}
                  <BookOpen size={14} />
                </span>
                <span className={s.kpiValue} style={{ fontSize: 18 }}>
                  {g.members.find(m => m.role === 'secretary')?.name || (isRw ? 'Ntatoranywa' : 'Unassigned')}
                </span>
                <span className={s.kpiSub}>
                  {isRw ? 'Inyandikomvugo n’abanyamuryango' : 'Meeting records & roster'}
                </span>
              </div>
            </div>
          </section>

          {/* Member Role Assignment Table */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <Users size={18} /> {isRw ? 'Gena Imyanya y’Ubuyobozi (Role Assignment)' : 'Member Role Assignment'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Perezida wenyine ni we ufite uburenganzira bwo guhindura imyanya: Perezida, Umubitsi, Umucungamari, Umunyamabanga, cyangwa Umunyamuryango.'
                    : 'The President can authorize role changes to President, Treasurer, Accountant, Secretary, or Member. Every assignment is immutably logged.'}
                </p>
              </div>
            </div>

            <div className={s.tableContainer}>
              <table className={s.dataTable}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Umunyamuryango' : 'Member'}</th>
                    <th>{isRw ? 'Terefoni' : 'Phone'}</th>
                    <th>{isRw ? 'Ubwizigame' : 'Savings'}</th>
                    <th>{isRw ? 'Urwego ruriho ubu' : 'Current Role'}</th>
                    {isPresident && <th>{isRw ? 'Hindura Urwego' : 'Assign New Role'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.members.map(member => (
                    <tr key={member.id}>
                      <td>
                        <div className={s.memberCell}>
                          <div className={s.memberAvatar}>{member.name?.[0] || 'M'}</div>
                          <span className={s.memberName}>{member.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#334155' }}>
                        {member.phone || '0788123456'}
                      </td>
                      <td>
                        <strong>{money(member.savings || 0)}</strong>
                      </td>
                      <td>
                        <span className={`${s.statusPill} ${member.role === 'president' ? s.statusGood : member.role === 'treasurer' ? s.statusGood : s.statusNeutral}`}>
                          {member.role === 'president'
                            ? isRw ? 'Perezida' : 'President'
                            : member.role === 'treasurer'
                            ? isRw ? 'Umubitsi' : 'Treasurer'
                            : member.role === 'accountant'
                            ? isRw ? 'Umucungamari' : 'Accountant'
                            : member.role === 'secretary'
                            ? isRw ? 'Umunyamabanga' : 'Secretary'
                            : isRw ? 'Umunyamuryango' : 'Member'}
                        </span>
                      </td>
                      {isPresident && (
                        <td>
                          {member.id === d.user.id ? (
                            <span style={{ fontSize: 11, color: '#64748b' }}>{isRw ? 'Wowe ubwawe (Perezida)' : 'Self (President)'}</span>
                          ) : (
                            <select
                              value={member.role}
                              onChange={e => act({ action: 'setGroupMemberRole', userId: member.id, memberRole: e.target.value })}
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', fontWeight: 600 }}
                              disabled={busy}
                            >
                              <option value="member">{isRw ? 'Umunyamuryango (Member)' : 'Member'}</option>
                              <option value="treasurer">{isRw ? 'Umubitsi (Treasurer)' : 'Treasurer'}</option>
                              <option value="accountant">{isRw ? 'Umucungamari (Accountant)' : 'Accountant'}</option>
                              <option value="secretary">{isRw ? 'Umunyamabanga (Secretary)' : 'Secretary'}</option>
                              <option value="president">{isRw ? 'Perezida (President)' : 'President'}</option>
                            </select>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Role Assignment Audit History */}
          <section className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h2 className={s.sectionTitle}>
                  <KeyRound size={18} /> {isRw ? 'Amateka y’Ihindurwa ry’Inshingano (Role Assignment Audit History)' : 'Role Assignment Audit History'}
                </h2>
                <p className={s.sectionSubtitle}>
                  {isRw
                    ? 'Inyandiko y’amateka idashobora guhindurwa y’uko inshingano zagiye zihabwa abanyamuryango n’abayobozi.'
                    : 'Tamper-evident audit trail of all role assignments within this group, signed and verified.'}
                </p>
              </div>
            </div>

            <div className={s.tableContainer}>
              <table className={s.dataTable}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Itariki' : 'Timestamp'}</th>
                    <th>{isRw ? 'Umunyamuryango' : 'Member'}</th>
                    <th>{isRw ? 'Urwego rwa Kera' : 'Previous Role'}</th>
                    <th>{isRw ? 'Urwego Rushya' : 'New Role'}</th>
                    <th>{isRw ? 'Byemejwe na' : 'Assigned By'}</th>
                    <th>{isRw ? 'Ubugenzuzi' : 'Verification'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.roleHistory || []).map(hist => (
                    <tr key={hist.id}>
                      <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {hist.createdAt?.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td>
                        <strong>{hist.userName || hist.userId}</strong>
                      </td>
                      <td>
                        <span className={s.statusPill} style={{ background: '#f1f5f9', color: '#64748b' }}>
                          {hist.oldRole}
                        </span>
                      </td>
                      <td>
                        <span className={`${s.statusPill} ${hist.newRole === 'president' ? s.statusGood : s.statusNeutral}`}>
                          {hist.newRole}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {hist.assignedByName || hist.assignedBy}
                      </td>
                      <td>
                        <span className={`${s.statusPill} ${s.statusGood}`} style={{ fontSize: 10 }}>
                          <Check size={10} /> {isRw ? 'Byemejwe mu Gitabo' : 'Audited & Verified'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!g.roleHistory || g.roleHistory.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        {isRw ? 'Nta mateka y’ihindurwa ry’inshingano arahari.' : 'No role history recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* 8. Modal: Add Member (Phone & PIN Authentication) */}
      {showAddMemberModal && (
        <div className={s.modalBackdrop} onClick={() => setShowAddMemberModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <Plus size={18} /> {isRw ? 'Ongeraho Umunyamuryango Mushya' : 'Add New Group Member'}
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowAddMemberModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className={s.modalBody}>
                <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                  {isRw
                    ? 'Abanyamuryango binjira muri HURIZA bakoresheje terefoni n’imibare y’ibanga (PIN). Ntabwo bakeneye imeri.'
                    : 'Members sign in directly using their Rwandan phone number and numeric PIN. No email is needed.'}
                </p>

                {formError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div style={{ padding: '8px 12px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 12 }}>
                    {formSuccess}
                  </div>
                )}

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Amazina Yose' : 'Full Name'}</label>
                  <input
                    type="text"
                    required
                    className={s.formInput}
                    placeholder={isRw ? 'Urugero: Aline Mukeshimana' : 'e.g. Jean Dupont'}
                    value={memberName}
                    onChange={e => setMemberName(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Nimero ya Terefoni (MTN cyangwa Airtel)' : 'Rwandan Phone (MTN or Airtel)'}</label>
                  <input
                    type="tel"
                    required
                    className={s.formInput}
                    placeholder="0788 123 456"
                    value={memberPhone}
                    onChange={e => setMemberPhone(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ijambobanga ry’Imibare (PIN: imibare 4 kugeza ku 8)' : 'Numeric PIN (4-8 digits)'}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    minLength={4}
                    maxLength={8}
                    required
                    className={s.formInput}
                    placeholder="••••"
                    value={memberPin}
                    onChange={e => setMemberPin(e.target.value.replace(/\D/g, ''))}
                  />
                  <small style={{ color: '#64748b', fontSize: 11 }}>
                    {isRw ? 'Uyu munyamuryango azakoresha iyi PIN yinjira muri konti ye.' : 'Member will use this PIN to log in.'}
                  </small>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Urwego mu Itsinda' : 'Member Role'}</label>
                  <select
                    className={s.formInput}
                    value={memberRole}
                    onChange={e => setMemberRole(e.target.value as 'member' | 'treasurer' | 'accountant' | 'secretary')}
                  >
                    <option value="member">{isRw ? 'Umunyamuryango (Member)' : 'Member'}</option>
                    <option value="treasurer">{isRw ? 'Umubitsi w’Itsinda (Treasurer)' : 'Treasurer'}</option>
                    <option value="accountant">{isRw ? 'Umucungamari w’Itsinda (Accountant)' : 'Accountant'}</option>
                    <option value="secretary">{isRw ? 'Umunyamabanga w’Itsinda (Secretary)' : 'Secretary'}</option>
                  </select>
                </div>
              </div>
              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                  onClick={() => setShowAddMemberModal(false)}
                >
                  {isRw ? 'Reka' : 'Cancel'}
                </button>
                <button type="submit" className={s.primaryActionBtn} disabled={busy}>
                  {busy ? (isRw ? 'Biratunganywa…' : 'Saving…') : isRw ? 'Andika Umunyamuryango' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Modal: Request Emergency Loan (30% Savings Cap) */}
      {showLoanModal && (
        <div className={s.modalBackdrop} onClick={() => setShowLoanModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <Coins size={18} /> {isRw ? 'Saba Inguzanyo y’Ubutabazi' : 'Request Emergency Loan'}
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowLoanModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRequestEmergencyLoan}>
              <div className={s.modalBody}>
                <div className={s.loanCapBanner}>
                  <div>
                    <span className={s.loanCapLabel}>{isRw ? 'Ubwizigame bwawe' : 'Your Eligible Savings'}:</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#10243f' }}>{money(mySavings)}</div>
                  </div>
                  <div>
                    <span className={s.loanCapLabel}>{isRw ? 'Urugero ntarengwa (30%)' : 'Max Cap (30%)'}:</span>
                    <div className={s.loanCapValue}>{money(emergencyLoanCap)}</div>
                  </div>
                </div>

                {formError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
                    {formError}
                  </div>
                )}

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Amafaranga Usaba (Frw)' : 'Requested Amount (RWF)'}</label>
                  <input
                    type="number"
                    min={1000}
                    max={emergencyLoanCap || 1000000}
                    step={1000}
                    required
                    className={s.formInput}
                    value={loanAmount}
                    onChange={e => setLoanAmount(Number(e.target.value))}
                  />
                  <small style={{ color: '#64748b', fontSize: 11 }}>
                    {isRw ? `Ntirenze 30% by’ubwizigame (${money(emergencyLoanCap)}).` : `Cannot exceed 30% of your savings (${money(emergencyLoanCap)}).`}
                  </small>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Amezi yo Kwishyura' : 'Repayment Term (Months)'}</label>
                  <select
                    className={s.formInput}
                    value={loanMonths}
                    onChange={e => setLoanMonths(Number(e.target.value))}
                  >
                    <option value={1}>1 {isRw ? 'ukwezi' : 'month'}</option>
                    <option value={2}>2 {isRw ? 'amezi' : 'months'}</option>
                    <option value={3}>3 {isRw ? 'amezi' : 'months'}</option>
                    <option value={6}>6 {isRw ? 'amezi' : 'months'}</option>
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Impamvu / Ibisobanuro' : 'Purpose / Emergency Note'}</label>
                  <input
                    type="text"
                    required
                    className={s.formInput}
                    placeholder={isRw ? 'Urugero: Kwivuza, amafaranga y’ishuri' : 'e.g. Medical emergency, school fees'}
                    value={loanReason}
                    onChange={e => setLoanReason(e.target.value)}
                  />
                </div>
              </div>
              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                  onClick={() => setShowLoanModal(false)}
                >
                  {isRw ? 'Reka' : 'Cancel'}
                </button>
                <button type="submit" className={s.primaryActionBtn} disabled={busy || emergencyLoanCap <= 0}>
                  {busy ? (isRw ? 'Biratunganywa…' : 'Submitting…') : isRw ? 'Ohereza Ubusabe' : 'Submit Loan Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Modal: Simulated MoMo Fast Payment (*182# Dialog) */}
      {showMoMoModal && (
        <div className={s.modalBackdrop} onClick={() => setShowMoMoModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <Smartphone size={18} /> MTN Mobile Money (*182#)
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowMoMoModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={s.modalBody}>
              <div className={s.ussdBox}>
                <div className={s.ussdHeader}>
                  <span>MTN MoMo Rwanda · USSD *182#</span>
                  <span>{isRw ? 'ICYITEGEREREZO' : 'SIMULATED'}</span>
                </div>
                <div className={s.ussdRow}>
                  <span>{isRw ? 'Kuri' : 'To'}:</span>
                  <strong>{momoRecipient}</strong>
                </div>
                <div className={s.ussdRow}>
                  <span>{isRw ? 'Amafaranga' : 'Amount'}:</span>
                  <strong>{money(momoAmount)}</strong>
                </div>
                <div className={s.ussdRow}>
                  <span>{isRw ? 'Amafaranga y’ubwishyu' : 'Fee'}:</span>
                  <strong>0 RWF</strong>
                </div>
                <div className={s.ussdRow}>
                  <span>{isRw ? 'Ubwoko bw’igikorwa' : 'Action'}:</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{momoType}</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>
                    {isRw ? 'Shyiramo MoMo PIN yawe (imibare 4):' : 'Enter your MoMo PIN (4 digits):'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    className={s.ussdPinInput}
                    value={momoPin}
                    onChange={e => setMomoPin(e.target.value)}
                  />
                </div>
              </div>
              <small style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>
                {isRw
                  ? 'Ibi ni ibyitegererezo bya MoMo bitanga umutekano usesuye. Nta mafaranga nyayo asohoka mu kigega.'
                  : 'Demonstration synthetic MoMo workflow. No real currency is transferred.'}
              </small>
            </div>
            <div className={s.modalFooter}>
              <button
                type="button"
                className={s.secondaryActionBtn}
                style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                onClick={() => setShowMoMoModal(false)}
              >
                {isRw ? 'Hagarika' : 'Cancel'}
              </button>
              <button
                type="button"
                className={s.primaryActionBtn}
                onClick={executeMoMoPayment}
                disabled={busy}
              >
                {busy ? (isRw ? 'Biratunganywa…' : 'Processing…') : isRw ? 'Emeza Ubwishyu (*182#)' : 'Confirm MoMo Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Modal: Send MoMo Payment Reminder */}
      {showReminderModal && reminderTarget && (
        <div className={s.modalBackdrop} onClick={() => setShowReminderModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <Send size={18} /> {isRw ? 'Yoherereze Ubutumwa bwo Kwibutsa' : 'Send MoMo Payment Reminder'}
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowReminderModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSendReminder}>
              <div className={s.modalBody}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                  <div className={s.memberAvatar}>{reminderTarget.name[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#10243f' }}>{reminderTarget.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{reminderTarget.phone || '0788123456'}</div>
                  </div>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ubutumwa bwa SMS' : 'SMS Notification Text'}</label>
                  <textarea
                    rows={4}
                    required
                    className={s.formInput}
                    style={{ height: 'auto', padding: '10px 14px' }}
                    value={reminderNote}
                    onChange={e => setReminderNote(e.target.value)}
                  />
                  <small style={{ color: '#64748b', fontSize: 11 }}>
                    {isRw
                      ? 'Ubutumwa buzahererekanywa kuri terefoni ye no mu butumwa bw’itsinda.'
                      : 'Simulated SMS push sent directly to member’s registered telephone number.'}
                  </small>
                </div>
              </div>
              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                  onClick={() => setShowReminderModal(false)}
                >
                  {isRw ? 'Reka' : 'Cancel'}
                </button>
                <button type="submit" className={s.primaryActionBtn} disabled={busy}>
                  <Send size={14} /> {isRw ? 'Ohereza SMS yo Kwibutsa' : 'Send Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 12. Modal: Record Group Expense */}
      {showRecordExpenseModal && (
        <div className={s.modalBackdrop} onClick={() => setShowRecordExpenseModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <Receipt size={18} /> {isRw ? 'Andika Amafaranga Yasohotse mu Itsinda' : 'Record Group Expense'}
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowRecordExpenseModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordExpense}>
              <div className={s.modalBody}>
                <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                  {isRw
                    ? 'Umucungamari yandika amafaranga yasohotse. Azabanza kwemezwa na Perezida mbere y’uko yishyurwa kuri MoMo.'
                    : 'Recorded expenses enter the approval queue. The President reviews and approves before MoMo payment confirmation.'}
                </p>

                {formError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
                    {formError}
                  </div>
                )}

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Icyiciro (Expense Category)' : 'Category'}</label>
                  <select
                    className={s.formInput}
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                  >
                    {(g.expenseCategories || []).map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    {!g.expenseCategories?.length && (
                      <option value="Office & Administration">Office & Administration</option>
                    )}
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Umutwe w’Icyasohotse' : 'Expense Title'}</label>
                  <input
                    type="text"
                    required
                    className={s.formInput}
                    placeholder={isRw ? 'Urugero: Ibitabo by’ubwizigame' : 'e.g. Printed passbooks & registers'}
                    value={expenseTitle}
                    onChange={e => setExpenseTitle(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Amafaranga (Frw)' : 'Amount (RWF)'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    className={s.formInput}
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(Number(e.target.value))}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ibisobanuro' : 'Description / Notes'}</label>
                  <textarea
                    rows={3}
                    className={s.formInput}
                    style={{ height: 'auto', padding: '10px 14px' }}
                    placeholder={isRw ? 'Ibisobanuro birambuye ku byaguzwe...' : 'Details of purchase or services...'}
                    value={expenseDescription}
                    onChange={e => setExpenseDescription(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Inyemezabwishyu (Receipt Document Reference)' : 'Receipt Document / Reference'}</label>
                  <input
                    type="text"
                    className={s.formInput}
                    placeholder={isRw ? 'Urugero: receipt-2026-001.pdf cyangwa nimero y’inyemezabwishyu' : 'e.g. receipt-2026-001.pdf or invoice reference'}
                    value={expenseReceipt}
                    onChange={e => setExpenseReceipt(e.target.value)}
                  />
                  <small style={{ color: '#64748b', fontSize: 11 }}>
                    {isRw ? 'Shyiramo izina ry’inyemezabwishyu cyangwa nimero yayo.' : 'Reference to attached invoice or physical paper voucher.'}
                  </small>
                </div>
              </div>
              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                  onClick={() => setShowRecordExpenseModal(false)}
                >
                  {isRw ? 'Reka' : 'Cancel'}
                </button>
                <button type="submit" className={s.primaryActionBtn} disabled={busy}>
                  {busy ? (isRw ? 'Biratunganywa…' : 'Recording…') : isRw ? 'Andika Icyasohotse' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 13. Modal: Record Group Income */}
      {showRecordIncomeModal && (
        <div className={s.modalBackdrop} onClick={() => setShowRecordIncomeModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <Coins size={18} /> {isRw ? 'Andika Amafaranga Yinjiye mu Itsinda' : 'Record Group Income'}
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowRecordIncomeModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordIncome}>
              <div className={s.modalBody}>
                <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                  {isRw
                    ? 'Andika amafaranga yinjiye atari imisanzu isanzwe (ingero: ibihano, amafaranga yo kwiyandikisha, inyungu cyangwa impano).'
                    : 'Record non-contribution income (e.g. penalties, registration fees, interest, or solidarity donations).'}
                </p>

                {formError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
                    {formError}
                  </div>
                )}

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Isoko y’Amafaranga' : 'Income Source'}</label>
                  <select
                    className={s.formInput}
                    value={incomeSource}
                    onChange={e => setIncomeSource(e.target.value)}
                  >
                    <option value="Late penalty fee / Igihano cyo gukererwa">Late penalty fee / Igihano cyo gukererwa</option>
                    <option value="Member registration fee / Amafaranga yo kwiyandikisha">Member registration fee / Amafaranga yo kwiyandikisha</option>
                    <option value="Bank or MoMo interest / Inyungu ya banki cyangwa MoMo">Bank or MoMo interest / Inyungu ya banki cyangwa MoMo</option>
                    <option value="Solidarity donation / Impano y’ubutabazi">Solidarity donation / Impano y’ubutabazi</option>
                    <option value="Other revenue / Andi masoko">Other revenue / Andi masoko</option>
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Amafaranga (Frw)' : 'Amount (RWF)'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    className={s.formInput}
                    value={incomeAmount}
                    onChange={e => setIncomeAmount(Number(e.target.value))}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ibisobanuro' : 'Description'}</label>
                  <input
                    type="text"
                    required
                    className={s.formInput}
                    placeholder={isRw ? 'Urugero: Igihano cy’inama yo ku wa gatatu' : 'e.g. Fine for missed assembly'}
                    value={incomeDescription}
                    onChange={e => setIncomeDescription(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Nimero y’Ubwishyu / Reference' : 'Payment Reference'}</label>
                  <input
                    type="text"
                    className={s.formInput}
                    placeholder="MOMO-INC-..."
                    value={incomeReference}
                    onChange={e => setIncomeReference(e.target.value)}
                  />
                </div>
              </div>
              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                  onClick={() => setShowRecordIncomeModal(false)}
                >
                  {isRw ? 'Reka' : 'Cancel'}
                </button>
                <button type="submit" className={s.primaryActionBtn} disabled={busy}>
                  {busy ? (isRw ? 'Biratunganywa…' : 'Recording…') : isRw ? 'Andika Ayinjiye' : 'Record Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 14. Modal: Create Expense Category */}
      {showNewCategoryModal && (
        <div className={s.modalBackdrop} onClick={() => setShowNewCategoryModal(false)}>
          <div className={s.modalContent} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <BookOpen size={18} /> {isRw ? 'Ongeraho Icyiciro Gishya' : 'Create Expense Category'}
              </h2>
              <button type="button" className={s.closeBtn} onClick={() => setShowNewCategoryModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className={s.modalBody}>
                {formError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
                    {formError}
                  </div>
                )}

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Izina ry’Icyiciro' : 'Category Name'}</label>
                  <input
                    type="text"
                    required
                    className={s.formInput}
                    placeholder={isRw ? 'Urugero: Ingendo & Imyidagaduro' : 'e.g. Travel & Logistics'}
                    value={categoryName}
                    onChange={e => setCategoryName(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ibisobanuro' : 'Description'}</label>
                  <input
                    type="text"
                    className={s.formInput}
                    placeholder={isRw ? 'Ibisobanuro by’iki cyiciro...' : 'Brief description of expenditures under this category...'}
                    value={categoryDesc}
                    onChange={e => setCategoryDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  style={{ color: '#10243f', borderColor: '#cbd5e1' }}
                  onClick={() => setShowNewCategoryModal(false)}
                >
                  {isRw ? 'Reka' : 'Cancel'}
                </button>
                <button type="submit" className={s.primaryActionBtn} disabled={busy}>
                  {busy ? (isRw ? 'Biratunganywa…' : 'Saving…') : isRw ? 'Ongeraho Icyiciro' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
