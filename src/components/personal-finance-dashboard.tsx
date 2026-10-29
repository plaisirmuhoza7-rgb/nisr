'use client';

import { useState, useMemo, type FormEvent } from 'react';
import {
  Wallet,
  TrendingUp,
  Target,
  Plus,
  Trash2,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Coins,
  Sparkles,
  Download,
  Calendar,
  Building2,
  ChevronRight,
  CheckCircle2,
  X,
  CreditCard,
  Percent,
  Landmark,
  PiggyBank,
  Smartphone,
  Banknote,
  Receipt,
  Scale,
  HandCoins,
  ArrowRightLeft,
  Briefcase,
  Layers,
  CircleDollarSign,
  Edit2,
  Clock,
  UserCheck
} from 'lucide-react';
import styles from './personal-finance-dashboard.module.css';
import PersonalSheetDestination from './personal-sheet-destination';
import type {
  FinanceState,
  PersonalWalletAccount,
  PersonalLoanRecord,
  PersonalInvestmentPlan
} from '@/lib/contracts';

type Goal = { id: string; name: string; target: number; saved: number; deadline: string };
type Notification = { id: string; message: string; created_at?: string };

interface PersonalFinanceDashboardProps {
  d: FinanceState & {
    user: { id: string; name: string; email: string; role: string; organizationName: string | null };
    goals: Goal[];
    notifications: Notification[];
    member: { outstanding: number; eligibleSavings: number; loanLimit: number };
    personalAccounts?: PersonalWalletAccount[];
    personalLoans?: PersonalLoanRecord[];
    personalInvestmentPlans?: PersonalInvestmentPlan[];
  };
  act: (p: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  money: (n: number) => string;
  isRw: boolean;
}

type TabKey = 'accounts' | 'goals' | 'budget' | 'loans' | 'invest' | 'activity';

interface ParsedActivity {
  id: string;
  type: 'expense' | 'income' | 'system';
  category: string;
  amount: number;
  note: string;
  date: string;
}

export default function PersonalFinanceDashboard({ d, act, busy, money, isRw }: PersonalFinanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('accounts');

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState<Goal | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showUpdateBalanceModal, setShowUpdateBalanceModal] = useState<PersonalWalletAccount | null>(null);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showLoanPaymentModal, setShowLoanPaymentModal] = useState<PersonalLoanRecord | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Form helper states
  const [depositAmount, setDepositAmount] = useState('25000');
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [selectedPlanPreset, setSelectedPlanPreset] = useState<string>('custom');
  const [loanFilter, setLoanFilter] = useState<'all' | 'i_owe' | 'they_owe' | 'active' | 'settled'>('all');

  // Investment Calculator State (Iterambere Compound Projection)
  const [calcMonthly, setCalcMonthly] = useState(30000);
  const [calcYears, setCalcYears] = useState(3);

  // Investment Plan Form Live Preview State
  const [planCapital, setPlanCapital] = useState(850000);
  const [planRevenue, setPlanRevenue] = useState(1200000);
  const [planExpenses, setPlanExpenses] = useState(680000);
  const [planHorizon, setPlanHorizon] = useState(6);

  // 1. Parse activity and calculate cash flows from notifications
  const parsedActivities: ParsedActivity[] = useMemo(() => {
    return (d.notifications || []).map((n) => {
      const expenseMatch = n.message.match(/^\[EXPENSE:([^:]+):(\d+)\]\s*(.*)$/);
      if (expenseMatch) {
        return {
          id: n.id,
          type: 'expense',
          category: expenseMatch[1],
          amount: Number(expenseMatch[2]),
          note: expenseMatch[3] || 'Personal expense',
          date: n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Today'
        };
      }
      const incomeMatch = n.message.match(/^\[INCOME:([^:]+):(\d+)\]\s*(.*)$/);
      if (incomeMatch) {
        return {
          id: n.id,
          type: 'income',
          category: incomeMatch[1],
          amount: Number(incomeMatch[2]),
          note: incomeMatch[3] || 'Personal income',
          date: n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Today'
        };
      }
      return {
        id: n.id,
        type: 'system',
        category: 'system',
        amount: 0,
        note: n.message,
        date: n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Recent'
      };
    });
  }, [d.notifications]);

  // Aggregate monthly figures
  const loggedExpenses = useMemo(() => {
    const sum = parsedActivities.filter(a => a.type === 'expense').reduce((acc, a) => acc + a.amount, 0);
    return sum > 0 ? sum : 210000;
  }, [parsedActivities]);

  const loggedIncome = useMemo(() => {
    const sum = parsedActivities.filter(a => a.type === 'income').reduce((acc, a) => acc + a.amount, 0);
    return sum > 0 ? sum : 550000;
  }, [parsedActivities]);

  const totalSavedInGoals = useMemo(() => {
    return (d.goals || []).reduce((acc, g) => acc + BigInt(g.saved), 0n);
  }, [d.goals]);

  const totalTargetInGoals = useMemo(() => {
    return (d.goals || []).reduce((acc, g) => acc + BigInt(g.target), 0n);
  }, [d.goals]);

  // Aggregate Accounts & Liquid Wealth
  const totalInAccounts = useMemo(() => {
    return (d.personalAccounts || []).reduce((acc, a) => acc + BigInt(a.balance), 0n);
  }, [d.personalAccounts]);

  const netWorth = Number(totalInAccounts) + Number(totalSavedInGoals);
  const monthlySavings = Math.max(0, loggedIncome - loggedExpenses);
  const savingsRate = loggedIncome > 0 ? Math.round((monthlySavings / loggedIncome) * 100) : 0;

  // Aggregate Loans & Debts (What I owe vs What others owe me)
  const { totalIOwe, totalTheyOwe, netLoanBalance } = useMemo(() => {
    let iOwe = 0;
    let theyOwe = 0;
    for (const l of d.personalLoans || []) {
      if (l.status === 'settled') continue;
      const rem = l.remainingAmount ?? Math.max(0, l.amount - l.paidAmount);
      if (l.direction === 'i_owe') iOwe += rem;
      else if (l.direction === 'they_owe') theyOwe += rem;
    }
    return { totalIOwe: iOwe, totalTheyOwe: theyOwe, netLoanBalance: theyOwe - iOwe };
  }, [d.personalLoans]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return (d.personalLoans || []).filter(l => {
      if (loanFilter === 'all') return true;
      if (loanFilter === 'i_owe') return l.direction === 'i_owe';
      if (loanFilter === 'they_owe') return l.direction === 'they_owe';
      if (loanFilter === 'active') return l.status !== 'settled';
      if (loanFilter === 'settled') return l.status === 'settled';
      return true;
    });
  }, [d.personalLoans, loanFilter]);

  // Investment projection calculation
  const projectedInvestment = useMemo(() => {
    const rate = 0.118; // 11.8% RNIT Iterambere annual compound yield
    const months = calcYears * 12;
    let balance = 0;
    const monthlyRate = rate / 12;
    for (let m = 0; m < months; m++) {
      balance = Math.round((balance + calcMonthly) * (1 + monthlyRate));
    }
    const principal = calcMonthly * months;
    const interest = Math.max(0, balance - principal);
    return { principal, interest, total: balance };
  }, [calcMonthly, calcYears]);

  // Handlers
  const handleCreateGoal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const target = Number(fd.get('target') || 0);
    const deadline = String(fd.get('deadline') || '');
    if (!name || target <= 0 || !deadline) return;

    const ok = await act({ action: 'createGoal', name, target, deadline });
    if (ok) setShowGoalModal(false);
  };

  const handleDeposit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showDepositModal) return;
    const amount = Number(depositAmount);
    if (amount <= 0) return;

    const ok = await act({ action: 'addGoalSavings', goalId: showDepositModal.id, amount });
    if (ok) setShowDepositModal(null);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm(isRw ? 'Uremeza ko ushaka guhanagura iyi ntego?' : 'Are you sure you want to delete this goal?')) return;
    await act({ action: 'deleteGoal', goalId });
  };

  const handleRecordExpense = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount') || 0);
    const category = String(fd.get('category') || 'general');
    const note = String(fd.get('note') || '').trim();
    const accountId = String(fd.get('accountId') || '');
    if (amount <= 0 || !note) return;

    const ok = await act({
      action: 'recordPersonalExpense',
      amount,
      category,
      note,
      accountId: accountId || undefined
    });
    if (ok) setShowExpenseModal(false);
  };

  const handleRecordIncome = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount') || 0);
    const source = String(fd.get('source') || '').trim();
    const category = String(fd.get('category') || 'salary');
    const accountId = String(fd.get('accountId') || '');
    if (amount <= 0 || !source) return;

    const ok = await act({
      action: 'recordPersonalIncome',
      amount,
      source,
      category,
      accountId: accountId || undefined
    });
    if (ok) setShowIncomeModal(false);
  };

  const handleCreateAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const institution = String(fd.get('institution') || '').trim();
    const accountName = String(fd.get('accountName') || '').trim();
    const accountType = String(fd.get('accountType') || 'mobile_money');
    const accountIdentifier = String(fd.get('accountIdentifier') || '').trim();
    const balance = Number(fd.get('balance') || 0);
    const notes = String(fd.get('notes') || '').trim();
    if (!institution || !accountName) return;

    const ok = await act({
      action: 'createPersonalAccount',
      institution,
      accountName,
      accountType,
      accountIdentifier,
      balance,
      notes
    });
    if (ok) setShowAccountModal(false);
  };

  const handleUpdateAccountBalance = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showUpdateBalanceModal) return;
    const fd = new FormData(e.currentTarget);
    const balance = Number(fd.get('balance') || 0);
    if (balance < 0) return;

    const ok = await act({
      action: 'updatePersonalAccountBalance',
      accountId: showUpdateBalanceModal.id,
      balance
    });
    if (ok) setShowUpdateBalanceModal(null);
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm(isRw ? 'Uremeza ko ushaka gukuraho iyi konti?' : 'Are you sure you want to remove this account?')) return;
    await act({ action: 'deletePersonalAccount', accountId });
  };

  const handleCreateLoan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const counterpartyName = String(fd.get('counterpartyName') || '').trim();
    const counterpartyPhone = String(fd.get('counterpartyPhone') || '').trim();
    const direction = String(fd.get('direction') || 'i_owe');
    const amount = Number(fd.get('amount') || 0);
    const dueDate = String(fd.get('dueDate') || '');
    const notes = String(fd.get('notes') || '').trim();
    if (!counterpartyName || amount <= 0) return;

    const ok = await act({
      action: 'createPersonalLoan',
      counterpartyName,
      counterpartyPhone,
      direction,
      amount,
      dueDate: dueDate || undefined,
      notes
    });
    if (ok) setShowLoanModal(false);
  };

  const handleLoanPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showLoanPaymentModal) return;
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount') || 0);
    if (amount <= 0) return;

    const ok = await act({
      action: 'recordPersonalLoanPayment',
      loanId: showLoanPaymentModal.id,
      amount
    });
    if (ok) setShowLoanPaymentModal(null);
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm(isRw ? 'Uremeza ko ushaka guhanagura iyi nyandiko y’umwenda?' : 'Are you sure you want to delete this debt record?')) return;
    await act({ action: 'deletePersonalLoan', loanId });
  };

  const handleCreatePlan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') || '').trim();
    const category = String(fd.get('category') || 'business');
    const capitalRequired = Number(fd.get('capitalRequired') || 0);
    const projectedRevenue = Number(fd.get('projectedRevenue') || 0);
    const projectedExpenses = Number(fd.get('projectedExpenses') || 0);
    const timeHorizonMonths = Number(fd.get('timeHorizonMonths') || 12);
    const notes = String(fd.get('notes') || '').trim();
    if (!title || capitalRequired < 0) return;

    const ok = await act({
      action: 'createPersonalInvestmentPlan',
      title,
      category,
      capitalRequired,
      projectedRevenue,
      projectedExpenses,
      timeHorizonMonths,
      notes
    });
    if (ok) setShowPlanModal(false);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm(isRw ? 'Uremeza ko ushaka guhanagura uyu mushinga?' : 'Are you sure you want to remove this investment plan?')) return;
    await act({ action: 'deletePersonalInvestmentPlan', planId });
  };

  const handleAllocateInvestment = async (name: string, target: number, initialAmount: number) => {
    const existing = d.goals.find(g => g.name.toLowerCase().includes(name.toLowerCase()));
    if (existing) {
      await act({ action: 'addGoalSavings', goalId: existing.id, amount: initialAmount });
    } else {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const deadline = nextYear.toISOString().slice(0, 10);
      await act({ action: 'createGoal', name: `${name} · Investment`, target, deadline });
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ['Record Type', 'Name / Entity', 'Amount (RWF)', 'Details', 'Date / Target'],
      ...(d.personalAccounts || []).map(a => ['Account', `"${a.institution} - ${a.accountName}"`, a.balance, a.accountIdentifier, a.accountType]),
      ...(d.goals || []).map(g => ['Savings Goal', `"${g.name}"`, g.saved, `Target: ${g.target}`, g.deadline]),
      ...(d.personalLoans || []).map(l => [l.direction === 'i_owe' ? 'Debt (I Owe)' : 'Loan (Owed to Me)', `"${l.counterpartyName}"`, l.amount, `Paid: ${l.paidAmount}`, l.dueDate || 'No due date']),
      ...(d.personalInvestmentPlans || []).map(p => ['Investment Plan', `"${p.title}"`, p.capitalRequired, `Net: ${p.netProfit}`, `${p.timeHorizonMonths} months`])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `huriza-personal-finance-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.dashboard}>
      {/* 1. HERO NET WORTH & CASH FLOW HEADER */}
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div>
            <span className={styles.heroEyebrow}>
              <Sparkles size={14} />
              {isRw ? 'ISHUSHO Y’UMUTUNGO BWITE' : 'PERSONAL WEALTH & CASH FLOW'}
            </span>
            <div className={styles.netWorthValue}>{money(netWorth)}</div>
            <div className={styles.netWorthMeta}>
              <span>{isRw ? 'Amafaranga muri Konti:' : 'In Accounts:'} <b>{money(Number(totalInAccounts))}</b></span>
              <span>·</span>
              <span>{isRw ? 'Ubwizigame mu Ntego:' : 'In Goals:'} <b>{money(Number(totalSavedInGoals))}</b></span>
              <span>·</span>
              <span>{isRw ? 'Amadeni asigaye:' : 'Net Debts:'} <b style={{ color: netLoanBalance >= 0 ? '#34d399' : '#f87171' }}>{money(netLoanBalance)}</b></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '38px', padding: '8px 13px', background: '#059669', borderColor: '#059669' }}
              onClick={() => setShowIncomeModal(true)}
              disabled={busy}
            >
              <ArrowDownLeft size={15} />
              {isRw ? 'Ongeraho Ibiyinjira' : 'Add Income'}
            </button>
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '38px', padding: '8px 13px' }}
              onClick={() => setShowGoalModal(true)}
              disabled={busy}
            >
              <Plus size={15} />
              {isRw ? 'Intego nshya' : 'New Goal'}
            </button>
            <button
              className="button button-quiet"
              style={{ fontSize: '12px', minHeight: '38px', padding: '8px 13px' }}
              onClick={() => setShowExpenseModal(true)}
              disabled={busy}
            >
              <ArrowUpRight size={15} />
              {isRw ? 'Andika ikikoreshejwe' : 'Log Expense'}
            </button>
            <button
              className="button button-quiet"
              style={{ fontSize: '12px', minHeight: '38px', padding: '8px 13px' }}
              onClick={() => setShowAccountModal(true)}
              disabled={busy}
            >
              <Landmark size={15} />
              {isRw ? 'Ongeraho Konti' : 'Add Account'}
            </button>
          </div>

          {/* Quick Account Summary Strip */}
          {(d.personalAccounts || []).length > 0 && (
            <div className={styles.accountSummaryStrip}>
              <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600 }}>
                {isRw ? 'Konti zawe:' : 'Accounts:'}
              </span>
              {(d.personalAccounts || []).map((acc) => (
                <div key={acc.id} className={styles.accountChip}>
                  <span>{acc.institution}:</span>
                  <b>{money(acc.balance)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.heroFlow}>
          <div className={styles.flowRow}>
            <span>{isRw ? 'Amafaranga yinjira / Ukwezi' : 'Monthly Cash Inflow'}</span>
            <b style={{ color: '#34d399' }}>+{money(loggedIncome)}</b>
          </div>
          <div className={styles.flowRow}>
            <span>{isRw ? 'Amafaranga asohoka / Ukwezi' : 'Monthly Spending'}</span>
            <b style={{ color: '#f87171' }}>-{money(loggedExpenses)}</b>
          </div>
          <div className={styles.flowRow}>
            <span>{isRw ? 'Azigamwa / Ukwezi' : 'Net Monthly Savings'}</span>
            <b>+{money(monthlySavings)}</b>
          </div>

          <div className={styles.savingsRateMeter}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1' }}>
              <span>{isRw ? 'Igipimo cyo kuzigama' : 'Savings Rate'}</span>
              <b>{savingsRate}%</b>
            </div>
            <div className={styles.meterTrack}>
              <div className={styles.meterFill} style={{ width: `${Math.min(100, savingsRate)}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. COMPREHENSIVE SEGMENTED TABS */}
      <nav className={styles.tabsNav} aria-label="Personal finance views">
        <button
          className={`${styles.tabButton} ${activeTab === 'accounts' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          <Landmark size={16} />
          {isRw ? 'Amakonti & Paki' : 'Accounts & Wallets'} ({(d.personalAccounts || []).length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'goals' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          <Target size={16} />
          {isRw ? 'Intego zo Kuzigama' : 'Savings Goals'} ({d.goals.length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'budget' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          <PieChart size={16} />
          {isRw ? 'Ingengo y’Imari' : 'Budget & Spending'}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'loans' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <ArrowRightLeft size={16} />
          {isRw ? 'Amadeni & Inguzanyo' : 'Loans & Debts (IOUs)'} ({(d.personalLoans || []).length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'invest' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('invest')}
        >
          <TrendingUp size={16} />
          {isRw ? 'Ishoramari & Igenamigambi' : 'Invest & Venture Plans'} ({(d.personalInvestmentPlans || []).length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'activity' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Calendar size={16} />
          {isRw ? 'Ibikorwa & Sheets' : 'Activity & Sheets'}
        </button>
      </nav>

      {/* 3. TAB CONTENT */}

      {/* --- TAB 0: ACCOUNTS & WALLETS --- */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Amakonti & Amafaranga Ubika Hafi' : 'Accounts & Liquid Wallets'}</h2>
              <p>{isRw ? 'Reba amafaranga yose ufite mu makonti atandukanye (MoMo, Banki, SACCO, Cash).' : 'Track your real available balances across mobile money, banks, SACCOs, and physical cash.'}</p>
            </div>
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '36px' }}
              onClick={() => setShowAccountModal(true)}
              disabled={busy}
            >
              <Plus size={15} />
              {isRw ? 'Ongeraho Konti' : 'Add New Account'}
            </button>
          </div>

          <div className={styles.accountsGrid}>
            {(d.personalAccounts || []).map((acc) => {
              const isMoMo = acc.accountType === 'mobile_money' || acc.institution.toLowerCase().includes('momo') || acc.institution.toLowerCase().includes('mtn') || acc.institution.toLowerCase().includes('airtel');
              const isBank = acc.accountType === 'bank' || acc.institution.toLowerCase().includes('bank') || acc.institution.toLowerCase().includes('bk');
              const isSacco = acc.accountType === 'sacco' || acc.institution.toLowerCase().includes('sacco');
              const isCash = acc.accountType === 'cash';

              return (
                <article key={acc.id} className={styles.accountCard}>
                  <div className={styles.accountHead}>
                    <div className={styles.accountIconWrap} style={{ background: isMoMo ? '#fef9c3' : isBank ? '#eff6ff' : isSacco ? '#f0fdf4' : '#f1f5f9', color: isMoMo ? '#ca8a04' : isBank ? '#2563eb' : isSacco ? '#16a34a' : '#475569' }}>
                      {isMoMo ? <Smartphone size={20} /> : isBank ? <Building2 size={20} /> : isSacco ? <Landmark size={20} /> : <Banknote size={20} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{acc.accountName}</h3>
                        <button
                          className={styles.closeButton}
                          title={isRw ? 'Hanagura' : 'Delete'}
                          onClick={() => void handleDeleteAccount(acc.id)}
                          disabled={busy}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{acc.institution}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Amafaranga ariho:' : 'Current Balance:'}</span>
                    <div className={styles.accountBalance}>{money(acc.balance)}</div>
                    <div className={styles.accountMeta}>
                      <span>{acc.accountIdentifier ? acc.accountIdentifier : (isRw ? 'Nta nomero yanditse' : 'Standard wallet')}</span>
                      {acc.notes && <span style={{ fontStyle: 'italic', color: '#475569' }}>{acc.notes}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <button
                      className="button button-quiet"
                      style={{ fontSize: '11px', minHeight: '30px', padding: '4px 10px' }}
                      onClick={() => setShowUpdateBalanceModal(acc)}
                      disabled={busy}
                    >
                      <Edit2 size={13} />
                      {isRw ? 'Hindura Umubare' : 'Update Balance'}
                    </button>
                  </div>
                </article>
              );
            })}

            {(d.personalAccounts || []).length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                <Landmark size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>{isRw ? 'Nta konti irashyirwamo' : 'No personal accounts added yet'}</h3>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>{isRw ? 'Ongeraho MTN MoMo, konti ya Banki, cyangwa SACCO kugira ngo ubone umutungo wawe wose.' : 'Add your MTN MoMo, Bank account, or SACCO to track your complete liquidity.'}</p>
                <button className="button button-primary" onClick={() => setShowAccountModal(true)}>
                  <Plus size={15} /> {isRw ? 'Ongeraho Konti ya Mbere' : 'Add First Account'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 1: SAVINGS GOALS --- */}
      {activeTab === 'goals' && (
        <div>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Intego zawe zo kuzigama' : 'Active Savings Targets'}</h2>
              <p>{isRw ? 'Genzura aho ugeze ukora intambwe zifatika zo kubaka umutungo.' : 'Track milestone progress and automate regular deposits to build security.'}</p>
            </div>
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '36px' }}
              onClick={() => setShowGoalModal(true)}
              disabled={busy}
            >
              <Plus size={15} />
              {isRw ? 'Ongeraho intego' : 'Add Goal'}
            </button>
          </div>

          <div className={styles.goalsGrid}>
            {d.goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
              const remaining = Math.max(0, g.target - g.saved);
              const daysLeft = Math.max(1, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              const monthsLeft = Math.max(1, Math.round(daysLeft / 30.4));
              const monthlyPace = Math.ceil(remaining / monthsLeft);

              const isEmergency = g.name.toLowerCase().includes('emergency') || g.name.toLowerCase().includes('reserve');
              const isSchool = g.name.toLowerCase().includes('school') || g.name.toLowerCase().includes('fees');

              return (
                <article key={g.id} className={styles.goalCard}>
                  <div className={styles.goalHeader}>
                    <div className={styles.goalIconWrap}>
                      {isEmergency ? <ShieldCheck size={20} /> : isSchool ? <PiggyBank size={20} /> : <Target size={20} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 className={styles.goalTitle}>{g.name}</h3>
                      <p className={styles.goalDeadline}>
                        {isRw ? 'Itariki ntarengwa:' : 'Target:'} {g.deadline} · {daysLeft} {isRw ? 'iminsi isigaye' : 'days left'}
                      </p>
                    </div>
                    <button
                      className={styles.closeButton}
                      title={isRw ? 'Hanagura' : 'Delete'}
                      onClick={() => void handleDeleteGoal(g.id)}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className={styles.goalProgressWrap}>
                    <div className={styles.goalFigures}>
                      <span className={styles.goalSaved}>{money(g.saved)}</span>
                      <span className={styles.goalTarget}>{money(g.target)} ({pct}%)</span>
                    </div>
                    <div className={styles.goalTrack}>
                      <div className={styles.goalFill} style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : '#2463a6' }} />
                    </div>
                    <div className={styles.goalPace}>
                      <span>{remaining > 0 ? `${money(monthlyPace)} / ${isRw ? 'ukwezi bisabwa' : 'mo needed'}` : (isRw ? 'Intego yagezweho!' : 'Goal Completed!')}</span>
                      <span style={{ fontWeight: 600 }}>{money(remaining)} {isRw ? 'hasigaye' : 'left'}</span>
                    </div>
                  </div>

                  <div className={styles.goalActions}>
                    <div className={styles.depositChips}>
                      <button className={styles.chipButton} onClick={() => void act({ action: 'addGoalSavings', goalId: g.id, amount: 10000 })} disabled={busy}>+10k</button>
                      <button className={styles.chipButton} onClick={() => void act({ action: 'addGoalSavings', goalId: g.id, amount: 25000 })} disabled={busy}>+25k</button>
                      <button className={styles.chipButton} onClick={() => void act({ action: 'addGoalSavings', goalId: g.id, amount: 50000 })} disabled={busy}>+50k</button>
                    </div>
                    <button
                      className="button button-quiet"
                      style={{ fontSize: '11px', minHeight: '30px', padding: '4px 10px' }}
                      onClick={() => setShowDepositModal(g)}
                      disabled={busy}
                    >
                      <Coins size={13} />
                      {isRw ? 'Bika' : 'Deposit'}
                    </button>
                  </div>
                </article>
              );
            })}

            {d.goals.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Target size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>{isRw ? 'Nta ntego irashyirwaho' : 'No savings goals set yet'}</h3>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>{isRw ? 'Tangiza intego ya mbere nko kwiteganyiriza ibyago cyangwa amafaranga y’ishuri.' : 'Start your first goal like an emergency reserve or education tuition.'}</p>
                <button className="button button-primary" onClick={() => setShowGoalModal(true)}>
                  <Plus size={15} /> {isRw ? 'Kora intego nshya' : 'Create First Goal'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: BUDGET & EXPENSES --- */}
      {activeTab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Gucunga ingengo y’imari (50 / 30 / 20)' : '50 / 30 / 20 Budget Optimizer'}</h2>
              <p>{isRw ? 'Uburyo bwizewe bwo kugabanya amafaranga: 50% Ibikenerwa, 30% Ibyifuzo, 20% Kuzigama.' : 'Standard rule for resilient wealth: 50% Essentials, 30% Discretionary, 20% Wealth & Savings.'}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button button-primary"
                style={{ fontSize: '12px', minHeight: '36px', background: '#059669', borderColor: '#059669' }}
                onClick={() => setShowIncomeModal(true)}
                disabled={busy}
              >
                <Plus size={15} />
                {isRw ? 'Ongeraho Ibiyinjira' : 'Add Income'}
              </button>
              <button
                className="button button-primary"
                style={{ fontSize: '12px', minHeight: '36px' }}
                onClick={() => setShowExpenseModal(true)}
                disabled={busy}
              >
                <ArrowUpRight size={15} />
                {isRw ? 'Andika ikikoreshejwe' : 'Log Expense'}
              </button>
            </div>
          </div>

          <div className={styles.budgetCard}>
            <div className={styles.budgetRow}>
              <div className={styles.budgetBlock}>
                <span>{isRw ? 'Ibikenerwa (Needs 50%)' : 'Essential Needs (50%)'}</span>
                <strong>{money(Math.round(loggedIncome * 0.5))}</strong>
                <small style={{ color: '#64748b', fontSize: '11px' }}>{isRw ? 'Ubukode, ibiribwa, umuriro, amazi, ubuzima' : 'Rent, groceries, utilities, transit'}</small>
              </div>
              <div className={styles.budgetBlock}>
                <span>{isRw ? 'Ibyifuzo (Wants 30%)' : 'Lifestyle & Wants (30%)'}</span>
                <strong>{money(Math.round(loggedIncome * 0.3))}</strong>
                <small style={{ color: '#64748b', fontSize: '11px' }}>{isRw ? 'Kwishimisha, ibikoresho, ifatabuguzi' : 'Dining out, personal care, entertainment'}</small>
              </div>
              <div className={styles.budgetBlock} style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
                <span style={{ color: '#166534' }}>{isRw ? 'Kuzigama n’Ishoramari (20%)' : 'Savings & Investing (20%)'}</span>
                <strong style={{ color: '#15803d' }}>{money(Math.round(loggedIncome * 0.2))}</strong>
                <small style={{ color: '#166534', fontSize: '11px' }}>{isRw ? 'Intego, RNIT Iterambere, ikigega' : 'Goals, RNIT, emergency buffer'}</small>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span><b>{isRw ? 'Akimara gukoreshwa muri uku kwezi:' : 'Actual Spent this Month:'}</b> {money(loggedExpenses)}</span>
                <span style={{ color: '#64748b' }}>{isRw ? 'Amafaranga yinjira yose:' : 'Total Monthly Inflow:'} {money(loggedIncome)}</span>
              </div>
              <div className={styles.goalTrack} style={{ height: '10px' }}>
                <div
                  className={styles.goalFill}
                  style={{
                    width: `${Math.min(100, Math.round((loggedExpenses / loggedIncome) * 100))}%`,
                    background: loggedExpenses > loggedIncome * 0.9 ? '#ef4444' : '#2463a6'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {isRw ? 'Hasigaye gukoreshwa muri uku kwezi:' : 'Safe-to-spend buffer remaining:'} <b>{money(Math.max(0, loggedIncome - loggedExpenses))}</b>
              </span>
            </div>

            <div className={styles.categoriesList}>
              <h4 style={{ margin: '8px 0 0', fontSize: '14px', color: '#1e293b' }}>{isRw ? 'Ibice by’ingenzi bikoreshwamo amafaranga' : 'Core Spending Categories'}</h4>
              <div className={styles.categoryItem}>
                <div className={styles.categoryLeft}>
                  <div className={styles.categoryTag} style={{ background: '#3b82f6' }} />
                  <span>{isRw ? 'Ibiribwa n’Amasoko (Groceries & Market)' : 'Groceries & Household Essentials'}</span>
                </div>
                <b>{money(Math.round(loggedExpenses * 0.38))}</b>
              </div>
              <div className={styles.categoryItem}>
                <div className={styles.categoryLeft}>
                  <div className={styles.categoryTag} style={{ background: '#8b5cf6' }} />
                  <span>{isRw ? 'Ubukode, Umuriro n’Amazi (Housing & Utilities)' : 'Housing, Power & Water'}</span>
                </div>
                <b>{money(Math.round(loggedExpenses * 0.34))}</b>
              </div>
              <div className={styles.categoryItem}>
                <div className={styles.categoryLeft}>
                  <div className={styles.categoryTag} style={{ background: '#f59e0b' }} />
                  <span>{isRw ? 'Ingendo n’Itumanaho (Transport & Data)' : 'Transport & Mobile Data'}</span>
                </div>
                <b>{money(Math.round(loggedExpenses * 0.18))}</b>
              </div>
              <div className={styles.categoryItem}>
                <div className={styles.categoryLeft}>
                  <div className={styles.categoryTag} style={{ background: '#10b981' }} />
                  <span>{isRw ? 'Ubuzima n’Ibyifuzo (Healthcare & Lifestyle)' : 'Healthcare & Personal Care'}</span>
                </div>
                <b>{money(Math.round(loggedExpenses * 0.10))}</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: LOANS & DEBTS (IOUs) --- */}
      {activeTab === 'loans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Amadeni & Inguzanyo Bwite (IOUs)' : 'Personal Loans & Debt Management'}</h2>
              <p>{isRw ? 'Genzura ibyo ugomba kwishyura abandi n’ibyo abandi bakugomba mu mucyo.' : 'Keep transparent track of money you owe to others and money others owe to you.'}</p>
            </div>
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '36px' }}
              onClick={() => setShowLoanModal(true)}
              disabled={busy}
            >
              <Plus size={15} />
              {isRw ? 'Andika Umwenda / IOU' : 'Record Loan / Debt'}
            </button>
          </div>

          {/* Metrics summary */}
          <div className={styles.budgetRow}>
            <div className={styles.budgetBlock} style={{ borderColor: '#fca5a5', background: '#fff5f5' }}>
              <span style={{ color: '#b91c1c' }}>{isRw ? 'Ibyo nshinzwe kwishyura (I Owe)' : 'What I Owe (Liabilities)'}</span>
              <strong style={{ color: '#b91c1c' }}>{money(totalIOwe)}</strong>
              <small style={{ color: '#991b1b', fontSize: '11px' }}>{isRw ? 'Amadeni ngomba kwishyura abandi' : 'Money borrowed from others'}</small>
            </div>
            <div className={styles.budgetBlock} style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
              <span style={{ color: '#166534' }}>{isRw ? 'Ibyo abandi bangomba (They Owe Me)' : 'What Others Owe Me (Receivables)'}</span>
              <strong style={{ color: '#15803d' }}>{money(totalTheyOwe)}</strong>
              <small style={{ color: '#166534', fontSize: '11px' }}>{isRw ? 'Amafaranga nagurije abandi' : 'Money lent to friends, family & clients'}</small>
            </div>
            <div className={styles.budgetBlock}>
              <span>{isRw ? 'Umusaruro w’amadeni (Net Balance)' : 'Net Debt Position'}</span>
              <strong style={{ color: netLoanBalance >= 0 ? '#15803d' : '#b91c1c' }}>{money(netLoanBalance)}</strong>
              <small style={{ color: '#64748b', fontSize: '11px' }}>{netLoanBalance >= 0 ? (isRw ? 'Umutungo urenga amadeni' : 'Positive net receivable') : (isRw ? 'Amadeni arenze ibyo uberewemo' : 'Net payable position')}</small>
            </div>
          </div>

          {/* Subfilter Nav */}
          <div className={styles.subFilterNav}>
            <button
              type="button"
              className={`${styles.subFilterButton} ${loanFilter === 'all' ? styles.subFilterButtonActive : ''}`}
              onClick={() => setLoanFilter('all')}
            >
              {isRw ? 'Byose' : 'All'} ({(d.personalLoans || []).length})
            </button>
            <button
              type="button"
              className={`${styles.subFilterButton} ${loanFilter === 'i_owe' ? styles.subFilterButtonActive : ''}`}
              onClick={() => setLoanFilter('i_owe')}
            >
              {isRw ? 'Ibyo Nshinzwe' : 'What I Owe'} ({totalIOwe > 0 ? money(totalIOwe) : '0'})
            </button>
            <button
              type="button"
              className={`${styles.subFilterButton} ${loanFilter === 'they_owe' ? styles.subFilterButtonActive : ''}`}
              onClick={() => setLoanFilter('they_owe')}
            >
              {isRw ? 'Ibyo Bangomba' : 'Owed to Me'} ({totalTheyOwe > 0 ? money(totalTheyOwe) : '0'})
            </button>
            <button
              type="button"
              className={`${styles.subFilterButton} ${loanFilter === 'active' ? styles.subFilterButtonActive : ''}`}
              onClick={() => setLoanFilter('active')}
            >
              {isRw ? 'Bigikora' : 'Active / Pending'}
            </button>
            <button
              type="button"
              className={`${styles.subFilterButton} ${loanFilter === 'settled' ? styles.subFilterButtonActive : ''}`}
              onClick={() => setLoanFilter('settled')}
            >
              {isRw ? 'Byarangiye' : 'Settled'}
            </button>
          </div>

          {/* Loans Grid */}
          <div className={styles.loansGrid}>
            {filteredLoans.map((loan) => {
              const isIOwe = loan.direction === 'i_owe';
              const remaining = loan.remainingAmount ?? Math.max(0, loan.amount - loan.paidAmount);
              const pctPaid = loan.amount > 0 ? Math.min(100, Math.round((loan.paidAmount / loan.amount) * 100)) : 0;
              const isSettled = loan.status === 'settled' || remaining <= 0;

              return (
                <article key={loan.id} className={styles.loanCard}>
                  <div className={styles.loanHead}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={isIOwe ? styles.loanDirectionBadgeI : styles.loanDirectionBadgeThey}>
                          {isIOwe ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                          {isIOwe ? (isRw ? 'Nshinzwe Kwishyura' : 'I Owe') : (isRw ? 'Bangomba Kwishyura' : 'Owed to Me')}
                        </span>
                        {isSettled && (
                          <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            {isRw ? 'Byarangiye' : 'Settled'}
                          </span>
                        )}
                      </div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>{loan.counterpartyName}</h3>
                      {loan.counterpartyPhone && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{loan.counterpartyPhone}</span>
                      )}
                    </div>

                    <button
                      className={styles.closeButton}
                      title={isRw ? 'Hanagura' : 'Delete'}
                      onClick={() => void handleDeleteLoan(loan.id)}
                      disabled={busy}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className={styles.loanAmountRow}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Amafaranga asigaye:' : 'Remaining Balance:'}</span>
                      <div className={styles.loanRemaining} style={{ color: isIOwe ? '#b91c1c' : '#15803d' }}>
                        {money(remaining)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{isRw ? 'Yose hamwe:' : 'Total Amount:'}</span>
                      <div className={styles.loanTotal}>{money(loan.amount)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className={styles.goalTrack} style={{ height: '6px' }}>
                      <div className={styles.goalFill} style={{ width: `${pctPaid}%`, background: isSettled ? '#10b981' : isIOwe ? '#ef4444' : '#2463a6' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                      <span>{isRw ? 'Yishyuwe:' : 'Paid:'} {money(loan.paidAmount)} ({pctPaid}%)</span>
                      {loan.dueDate && <span>{isRw ? 'Itariki:' : 'Due:'} {loan.dueDate}</span>}
                    </div>
                  </div>

                  {loan.notes && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                      {loan.notes}
                    </p>
                  )}

                  {!isSettled && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <button
                        className="button button-quiet"
                        style={{ fontSize: '11px', minHeight: '30px', padding: '4px 12px' }}
                        onClick={() => setShowLoanPaymentModal(loan)}
                        disabled={busy}
                      >
                        <Coins size={13} />
                        {isIOwe ? (isRw ? 'Andika Icyishyuwe' : 'Record Repayment') : (isRw ? 'Andika Ayakiriwe' : 'Record Collection')}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}

            {filteredLoans.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                <ArrowRightLeft size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>{isRw ? 'Nta mwenda wihariye wanditse' : 'No matching loan or debt records'}</h3>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>{isRw ? 'Andika amadeni uzi ngo ubyibuke cyangwa ayo wagurije bagenzi bawe.' : 'Record money you owe or personal loans given to maintain clear financial peace of mind.'}</p>
                <button className="button button-primary" onClick={() => setShowLoanModal(true)}>
                  <Plus size={15} /> {isRw ? 'Andika Umwenda wa Mbere' : 'Record First Debt'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 4: INVEST & VENTURE PLANNING --- */}
      {activeTab === 'invest' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* SECTION A: INVESTMENT & VENTURE PLANNING STUDIO */}
          <div>
            <div className={styles.sectionHead}>
              <div>
                <h2>{isRw ? 'Igenamigambi ry’Ishoramari & Imishinga' : 'Investment & Venture Planning Studio'}</h2>
                <p>{isRw ? 'Tegura imishinga ibyara inyungu: andika ibyinjira (revenues), ibikoreshwa (expenses) n’inyungu (profit).' : 'Plan business ventures and micro-investments with dynamic revenue, expense, and net profit modeling.'}</p>
              </div>
              <button
                className="button button-primary"
                style={{ fontSize: '12px', minHeight: '36px' }}
                onClick={() => setShowPlanModal(true)}
                disabled={busy}
              >
                <Plus size={15} />
                {isRw ? 'Tegura Umushinga Mushya' : 'New Venture Plan'}
              </button>
            </div>

            <div className={styles.plansGrid}>
              {(d.personalInvestmentPlans || []).map((plan) => {
                const isProfitable = plan.netProfit > 0;

                return (
                  <article key={plan.id} className={styles.planCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>
                          {plan.category}
                        </span>
                        <h3 style={{ margin: '6px 0 2px', fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>{plan.title}</h3>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {isRw ? 'Igihe cy’umushinga:' : 'Horizon:'} {plan.timeHorizonMonths} {isRw ? 'amezi' : 'months'}
                        </span>
                      </div>
                      <button
                        className={styles.closeButton}
                        title={isRw ? 'Hanagura' : 'Delete'}
                        onClick={() => void handleDeletePlan(plan.id)}
                        disabled={busy}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className={styles.planMetricsGrid}>
                      <div className={styles.planMetricItem}>
                        <span className={styles.planMetricLabel}>{isRw ? 'Igishoro (Capital)' : 'Capital Required'}</span>
                        <span className={styles.planMetricValue}>{money(plan.capitalRequired)}</span>
                      </div>
                      <div className={styles.planMetricItem}>
                        <span className={styles.planMetricLabel}>{isRw ? 'Ibyinjira (Revenue)' : 'Projected Revenue'}</span>
                        <span className={styles.planMetricValue} style={{ color: '#059669' }}>+{money(plan.projectedRevenue)}</span>
                      </div>
                      <div className={styles.planMetricItem}>
                        <span className={styles.planMetricLabel}>{isRw ? 'Ibikoreshwa (Expenses)' : 'Operating Expenses'}</span>
                        <span className={styles.planMetricValue} style={{ color: '#dc2626' }}>-{money(plan.projectedExpenses)}</span>
                      </div>
                      <div className={styles.planMetricItem}>
                        <span className={styles.planMetricLabel}>{isRw ? 'Inyungu (Net Profit)' : 'Net Profit / ROI'}</span>
                        <span className={`${styles.planMetricValue} ${isProfitable ? styles.planProfitPos : styles.planProfitNeg}`}>
                          {isProfitable ? '+' : ''}{money(plan.netProfit)} ({plan.profitMarginPercent}%)
                        </span>
                      </div>
                    </div>

                    {plan.notes && (
                      <p style={{ margin: 0, fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                        {plan.notes}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <span>{isRw ? 'Kugarura igishoro:' : 'Payback Period:'} <b>{plan.paybackMonths > 0 ? `~${plan.paybackMonths} ${isRw ? 'amezi' : 'mo'}` : 'N/A'}</b></span>
                      <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', textTransform: 'capitalize', fontWeight: 600 }}>{plan.status}</span>
                    </div>
                  </article>
                );
              })}

              {(d.personalInvestmentPlans || []).length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                  <Briefcase size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                  <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>{isRw ? 'Nta mushinga w’ishoramari urashyirwamo' : 'No venture plans recorded yet'}</h3>
                  <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>{isRw ? 'Panga umushinga w’ubucuruzi, ubworozi, cyangwa ingendo ugabanye ibyinjira n’ibisohoka.' : 'Create your first business plan to simulate revenue, expenses, and expected return on capital.'}</p>
                  <button className="button button-primary" onClick={() => setShowPlanModal(true)}>
                    <Plus size={15} /> {isRw ? 'Kora Umushinga wa Mbere' : 'Plan First Venture'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION B: REGULATED RWANDAN INSTRUMENTS */}
          <div>
            <div className={styles.sectionHead}>
              <div>
                <h2>{isRw ? 'Amahirwe y’Ishoramari mu Rwanda' : 'Rwanda Regulated Wealth-Building Instruments'}</h2>
                <p>{isRw ? 'Ishoramari ryemewe n’amategeko kandi ryunguka ryo guteza imbere ubukungu bwawe.' : 'Regulated, accessible vehicles designed to beat inflation and compound capital.'}</p>
              </div>
            </div>

            <div className={styles.investGrid}>
              {/* RNIT Iterambere Fund */}
              <article className={styles.investCard}>
                <span className={styles.investTag}>
                  <CheckCircle2 size={13} />
                  CMA Regulated · Low Risk
                </span>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#0f172a' }}>RNIT Iterambere Fund</h3>
                  <p className={styles.investMeta}>{isRw ? 'Ikigega cy’ubwizigame n’ishoramari gicungwa na Rwanda National Investment Trust.' : 'National collective investment scheme open to all citizens. High liquidity, capital compounding.'}</p>
                </div>
                <div className={styles.investYield}>
                  ~11.8% <small style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{isRw ? 'inyungu ku mwaka' : 'annualized yield'}</small>
                </div>
                <button
                  className="button button-primary"
                  style={{ fontSize: '12px' }}
                  onClick={() => void handleAllocateInvestment('RNIT Iterambere Fund', 1000000, 50000)}
                  disabled={busy}
                >
                  <TrendingUp size={15} />
                  {isRw ? 'Tangira Ishoramari muri RNIT' : 'Allocate to RNIT Fund'}
                </button>
              </article>

              {/* Treasury Bills BNR */}
              <article className={styles.investCard}>
                <span className={styles.investTag} style={{ color: '#1e40af', background: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <Landmark size={13} />
                  BNR Sovereign Paper · Risk-Free
                </span>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#0f172a' }}>Treasury Bills (BNR)</h3>
                  <p className={styles.investMeta}>{isRw ? 'Impapuro mpamo z’ubwizigame za Banki Nkuru y’u Rwanda (91, 182, cyangwa 364 iminsi).' : 'Direct government bonds issued by National Bank of Rwanda. Guaranteed principal return.'}</p>
                </div>
                <div className={styles.investYield}>
                  ~9.5% <small style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{isRw ? 'ku mwaka' : 'yield'}</small>
                </div>
                <button
                  className="button button-quiet"
                  style={{ fontSize: '12px' }}
                  onClick={() => void handleAllocateInvestment('Treasury Bills (BNR)', 500000, 100000)}
                  disabled={busy}
                >
                  <ShieldCheck size={15} />
                  {isRw ? 'Shyiraho T-Bills' : 'Allocate to T-Bills'}
                </button>
              </article>

              {/* Cooperative & SACCO Shares */}
              <article className={styles.investCard}>
                <span className={styles.investTag} style={{ color: '#854d0e', background: '#fefce8', borderColor: '#fef08a' }}>
                  <Building2 size={13} />
                  Community Equity · Dividends
                </span>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#0f172a' }}>Umurenge SACCO / Coop Shares</h3>
                  <p className={styles.investMeta}>{isRw ? 'Kugura imigabane muri SACCO cyangwa koperative y’ubuhinzi ifite inyungu n’uburenganzira bwo gutora.' : 'Member share capital providing annual cooperative dividend payouts and local voting rights.'}</p>
                </div>
                <div className={styles.investYield}>
                  ~8.5% - 12% <small style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{isRw ? 'imigabane' : 'dividends'}</small>
                </div>
                <button
                  className="button button-quiet"
                  style={{ fontSize: '12px' }}
                  onClick={() => void handleAllocateInvestment('Imena Cooperative Shares', 200000, 25000)}
                  disabled={busy}
                >
                  <Coins size={15} />
                  {isRw ? 'Gura Imigabane' : 'Acquire Shares'}
                </button>
              </article>
            </div>
          </div>

          {/* Interactive Compound Growth Projector */}
          <div className={styles.projectorCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span className={styles.heroEyebrow} style={{ color: '#2563eb' }}>
                  <TrendingUp size={14} />
                  {isRw ? 'KUBARA INYUNGU Y’ISHORAMARI' : 'COMPOUND WEALTH PROJECTOR'}
                </span>
                <h3 style={{ margin: '4px 0', fontSize: '17px', color: '#0f172a' }}>{isRw ? 'Inyungu y’igihe kirekire ku kigereranyo cya 11.8%' : 'Projected Wealth Growth at 11.8% APY'}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{isRw ? 'Reba uburyo intambwe ntoya za buri kwezi zitubuka mu myaka iri imbere.' : 'See how modest monthly deposits accumulate through the power of compounding.'}</p>
              </div>

              <div className={styles.sliderGroup}>
                <label>
                  <span>{isRw ? 'Amafaranga ushyiraho buri kwezi:' : 'Monthly Contribution:'}</span>
                  <b>{money(calcMonthly)}</b>
                </label>
                <input
                  type="range"
                  min="10000"
                  max="200000"
                  step="5000"
                  value={calcMonthly}
                  onChange={(e) => setCalcMonthly(Number(e.target.value))}
                />
              </div>

              <div className={styles.sliderGroup}>
                <label>
                  <span>{isRw ? 'Igihe cy’ishoramari:' : 'Time Horizon:'}</span>
                  <b>{calcYears} {isRw ? 'imyaka' : 'years'}</b>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 5, 10].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      className={styles.chipButton}
                      style={{ background: calcYears === yr ? '#174f83' : '#f8fafc', color: calcYears === yr ? '#fff' : '#1e3a5f' }}
                      onClick={() => setCalcYears(yr)}
                    >
                      {yr} {isRw ? 'umwaka' : 'yr'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Umutungo wose uteganyijwe:' : 'Total Projected Wealth:'}</span>
              <strong style={{ fontSize: '28px', color: '#15803d', letterSpacing: '-0.5px' }}>{money(projectedInvestment.total)}</strong>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>{isRw ? 'Amafaranga yashowe:' : 'Principal Invested:'}</span>
                  <b style={{ color: '#0f172a' }}>{money(projectedInvestment.principal)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
                  <span>{isRw ? 'Inyungu yiyongereyeho:' : 'Compound Returns Earned:'}</span>
                  <b>+{money(projectedInvestment.interest)}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: ACTIVITY & SHEETS SYNC --- */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Guhuza na Google Sheets n’Ibikorwa' : 'Connected Sheets & Personal Activity'}</h2>
              <p>{isRw ? 'Icyegeranyo cy’ibikorwa byawe n’uburyo byoherezwa mu mbonerahamwe ya Google.' : 'Export your goals and activity automatically into linked spreadsheet summaries.'}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button button-primary"
                style={{ fontSize: '12px', minHeight: '36px', background: '#059669', borderColor: '#059669' }}
                onClick={() => setShowIncomeModal(true)}
                disabled={busy}
              >
                <Plus size={15} />
                {isRw ? 'Ongeraho Ibiyinjira' : 'Add Income'}
              </button>
              <button
                className="button button-quiet"
                style={{ fontSize: '12px', minHeight: '36px' }}
                onClick={handleExportCSV}
              >
                <Download size={15} />
                {isRw ? 'Kuramo CSV' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Integrated Personal Google Sheet Component */}
          <PersonalSheetDestination />

          {/* Activity Feed */}
          <div className={styles.activityCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{isRw ? 'Ibikorwa biheruka' : 'Recent Personal Activity'}</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{parsedActivities.length} {isRw ? 'ibyabaye' : 'records'}</span>
            </div>

            <div className={styles.activityList}>
              {parsedActivities.map((act) => (
                <div key={act.id} className={styles.activityRow}>
                  <div className={styles.activityLeft}>
                    <div className={styles.activityIcon}>
                      {act.type === 'expense' ? <ArrowUpRight size={16} color="#dc2626" /> : act.type === 'income' ? <ArrowDownLeft size={16} color="#059669" /> : <Coins size={16} />}
                    </div>
                    <div className={styles.activityMeta}>
                      <b>{act.note}</b>
                      <small>{act.date} · <span style={{ textTransform: 'capitalize' }}>{act.category}</span></small>
                    </div>
                  </div>
                  {act.amount > 0 && (
                    <div className={act.type === 'expense' ? styles.activityAmountNeg : styles.activityAmountPos}>
                      {act.type === 'expense' ? `-${money(act.amount)}` : `+${money(act.amount)}`}
                    </div>
                  )}
                </div>
              ))}

              {parsedActivities.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  {isRw ? 'Nta bikorwa birandikwa.' : 'No activity logged yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODALS ===================== */}

      {/* --- ADD INCOME MODAL --- */}
      {showIncomeModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-income-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-income-title">{isRw ? 'Andika amafaranga yakwinjiriye' : 'Log Personal Income'}</h3>
              <button className={styles.closeButton} onClick={() => setShowIncomeModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordIncome} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga yinjiye (Frw)' : 'Income Amount (RWF)'}
                <input
                  required
                  name="amount"
                  type="number"
                  min="500"
                  placeholder="150000"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Inkomoko / Ibisobanuro' : 'Source / Description'}
                <input
                  required
                  name="source"
                  type="text"
                  placeholder={isRw ? 'Urugero: Umushahara w’ukwezi cyangwa amasoko' : 'e.g. Monthly salary, consulting payout, harvest sales'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Icyiciro cy’inyungu' : 'Income Category'}
                <select
                  name="category"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                >
                  <option value="salary">{isRw ? 'Umushahara (Salary)' : 'Salary / Employment'}</option>
                  <option value="business">{isRw ? 'Ubucuruzi (Business Profit)' : 'Business Profit'}</option>
                  <option value="freelance">{isRw ? 'Gukorera ku giti cyawe (Freelance)' : 'Freelance / Consulting'}</option>
                  <option value="farming">{isRw ? 'Ubuhinzi / Ubworozi (Agri Harvest)' : 'Agriculture & Livestock'}</option>
                  <option value="rental">{isRw ? 'Ubukode (Rental Income)' : 'Rental Income'}</option>
                  <option value="dividend">{isRw ? 'Inyungu ku migabane (Dividends)' : 'Dividends & SACCO Payout'}</option>
                  <option value="other">{isRw ? 'Ibindi (Other)' : 'Other Inflow'}</option>
                </select>
              </label>

              {(d.personalAccounts || []).length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  {isRw ? 'Shyira kuri iyi konti (Bihitamo)' : 'Deposit into Account (Optional)'}
                  <select
                    name="accountId"
                    style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <option value="">{isRw ? '-- Nta konti ihujwe --' : '-- No specific account linked --'}</option>
                    {(d.personalAccounts || []).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.institution} - {a.accountName} ({money(a.balance)})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowIncomeModal(false)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  style={{ background: '#059669', borderColor: '#059669' }}
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Saving…') : (isRw ? 'Bika Ibiyinjira' : 'Save Income')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD ACCOUNT MODAL --- */}
      {showAccountModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-account-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-account-title">{isRw ? 'Ongeraho Konti nshya' : 'Add New Financial Account'}</h3>
              <button className={styles.closeButton} onClick={() => setShowAccountModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Ikigo cy’Imari (Institution)' : 'Financial Institution'}
                <input
                  required
                  name="institution"
                  type="text"
                  placeholder={isRw ? 'Urugero: MTN MoMo, Bank of Kigali, Umurenge SACCO' : 'e.g. MTN MoMo, Bank of Kigali, Airtel Money'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Izina rya Konti' : 'Account Label / Nickname'}
                <input
                  required
                  name="accountName"
                  type="text"
                  placeholder={isRw ? 'Urugero: Konti yo kwizigama cyangwa MoMo y’akazi' : 'e.g. Daily MoMo Wallet, Primary Savings, Business Cash'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Ubwoko bwa Konti' : 'Account Type'}
                <select
                  name="accountType"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                >
                  <option value="mobile_money">{isRw ? 'Mobile Money (MTN / Airtel)' : 'Mobile Money (MTN / Airtel)'}</option>
                  <option value="bank">{isRw ? 'Konti ya Banki (Commercial Bank)' : 'Commercial Bank Account'}</option>
                  <option value="sacco">{isRw ? 'Umurenge SACCO' : 'Umurenge SACCO / Microfinance'}</option>
                  <option value="cash">{isRw ? 'Amafaranga mu Ntoki (Cash Wallet)' : 'Physical Cash Wallet'}</option>
                  <option value="investment">{isRw ? 'Ishoramari (RNIT / Stock Broker)' : 'Investment / Brokerage'}</option>
                  <option value="other">{isRw ? 'Ibindi' : 'Other'}</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Nomero ya Konti cyangwa Telefone' : 'Account Identifier / Phone'}
                <input
                  name="accountIdentifier"
                  type="text"
                  placeholder={isRw ? 'Urugero: *182# · 0788***321 cyangwa 4002-****-1234' : 'e.g. *182# · 0788***321 or 4002-****-1234'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga arimo ubu (Frw)' : 'Current Balance (RWF)'}
                <input
                  required
                  name="balance"
                  type="number"
                  min="0"
                  defaultValue="0"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Ibisobanuro by’inyongera' : 'Notes (Optional)'}
                <input
                  name="notes"
                  type="text"
                  placeholder={isRw ? 'Icyo iyi konti igenewe...' : 'Purpose of this account...'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowAccountModal(false)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Saving…') : (isRw ? 'Bika Konti' : 'Save Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- UPDATE BALANCE MODAL --- */}
      {showUpdateBalanceModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-update-balance-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-update-balance-title">
                {isRw ? 'Hindura amafaranga ari muri' : 'Update Balance for'} {showUpdateBalanceModal.accountName}
              </h3>
              <button className={styles.closeButton} onClick={() => setShowUpdateBalanceModal(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {isRw ? 'Ikigo:' : 'Institution:'} <b>{showUpdateBalanceModal.institution}</b> · {isRw ? 'Ububiko buriho:' : 'Current balance:'} <b>{money(showUpdateBalanceModal.balance)}</b>
            </p>

            <form onSubmit={handleUpdateAccountBalance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga mashya ari kuri konti (Frw)' : 'New Current Balance (RWF)'}
                <input
                  required
                  name="balance"
                  type="number"
                  min="0"
                  defaultValue={String(showUpdateBalanceModal.balance)}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowUpdateBalanceModal(null)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Updating…') : (isRw ? 'Emeza Impinduka' : 'Confirm Balance')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RECORD LOAN / DEBT MODAL --- */}
      {showLoanModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-loan-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-loan-title">{isRw ? 'Andika umwenda cyangwa inguzanyo' : 'Record Personal Loan / Debt (IOU)'}</h3>
              <button className={styles.closeButton} onClick={() => setShowLoanModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Ubwoko bw’uyu mwenda' : 'Debt Direction'}
                <select
                  name="direction"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                >
                  <option value="i_owe">{isRw ? 'Ibyo Nshinzwe Kwishyura (Nafashe umwenda / I Owe)' : 'What I Owe (I borrowed money / Liability)'}</option>
                  <option value="they_owe">{isRw ? 'Ibyo Bangomba Kwishyura (Nagurije undi / They Owe Me)' : 'What Others Owe Me (I lent money / Receivable)'}</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amazina y’Uwo mufitanye umwenda' : 'Counterparty Name'}
                <input
                  required
                  name="counterpartyName"
                  type="text"
                  placeholder={isRw ? 'Urugero: Jean-Pierre Bizimana cyangwa Claire Uwera' : 'e.g. Jean-Pierre Bizimana or Claire Uwera'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Telefone ye (Bihitamo)' : 'Phone Number (Optional)'}
                <input
                  name="counterpartyPhone"
                  type="text"
                  placeholder="0788 000 000"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga yose hamwe (Frw)' : 'Total Loan Amount (RWF)'}
                <input
                  required
                  name="amount"
                  type="number"
                  min="500"
                  placeholder="50000"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Itariki yo kwishyura (Bihitamo)' : 'Target Due Date (Optional)'}
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Impamvu / Ibisobanuro' : 'Purpose / Notes'}
                <input
                  name="notes"
                  type="text"
                  placeholder={isRw ? 'Urugero: Igurizwa ry’amasoko, amafaranga y’ubuvuzi' : 'e.g. Shop restock balance, emergency advance'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowLoanModal(false)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Saving…') : (isRw ? 'Bika Umwenda' : 'Save Debt Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LOAN PAYMENT MODAL --- */}
      {showLoanPaymentModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-loan-pay-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-loan-pay-title">
                {isRw ? 'Andika ubwishyu bw’umwenda wa' : 'Record Payment for'} {showLoanPaymentModal.counterpartyName}
              </h3>
              <button className={styles.closeButton} onClick={() => setShowLoanPaymentModal(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {isRw ? 'Hasigaye:' : 'Remaining balance:'} <b>{money(showLoanPaymentModal.remainingAmount ?? Math.max(0, showLoanPaymentModal.amount - showLoanPaymentModal.paidAmount))}</b> / {money(showLoanPaymentModal.amount)}
            </p>

            <form onSubmit={handleLoanPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga yishyuwe ubu (Frw)' : 'Payment Amount (RWF)'}
                <input
                  required
                  name="amount"
                  type="number"
                  min="100"
                  max={showLoanPaymentModal.remainingAmount ?? Math.max(0, showLoanPaymentModal.amount - showLoanPaymentModal.paidAmount)}
                  defaultValue={String(showLoanPaymentModal.remainingAmount ?? Math.max(0, showLoanPaymentModal.amount - showLoanPaymentModal.paidAmount))}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowLoanPaymentModal(null)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Processing…') : (isRw ? 'Emeza Ubwishyu' : 'Confirm Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE VENTURE PLAN MODAL --- */}
      {showPlanModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-plan-title">
          <div className={styles.modalContent} style={{ maxWidth: '540px' }}>
            <div className={styles.modalHead}>
              <h3 id="modal-plan-title">{isRw ? 'Tegura Umushinga w’Ishoramari' : 'Plan an Investment Venture'}</h3>
              <button className={styles.closeButton} onClick={() => setShowPlanModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => {
                  setSelectedPlanPreset('poultry');
                  setPlanCapital(850000);
                  setPlanRevenue(1200000);
                  setPlanExpenses(680000);
                  setPlanHorizon(6);
                }}
                style={{ background: selectedPlanPreset === 'poultry' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Ubworozi bw’Inkoko' : 'Poultry Broiler Farming'}
              </button>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => {
                  setSelectedPlanPreset('moto');
                  setPlanCapital(1500000);
                  setPlanRevenue(2600000);
                  setPlanExpenses(1200000);
                  setPlanHorizon(18);
                }}
                style={{ background: selectedPlanPreset === 'moto' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Ingendo za Moto' : 'Commercial Moto Transit'}
              </button>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => {
                  setSelectedPlanPreset('greenhouse');
                  setPlanCapital(2000000);
                  setPlanRevenue(3800000);
                  setPlanExpenses(1600000);
                  setPlanHorizon(12);
                }}
                style={{ background: selectedPlanPreset === 'greenhouse' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Inyanya za Greenhouse' : 'Greenhouse Tomatoes'}
              </button>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => {
                  setSelectedPlanPreset('retail');
                  setPlanCapital(1200000);
                  setPlanRevenue(2100000);
                  setPlanExpenses(1400000);
                  setPlanHorizon(12);
                }}
                style={{ background: selectedPlanPreset === 'retail' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Iduka rya Grocery' : 'Grocery Retail Kiosk'}
              </button>
            </div>

            <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Izina ry’Umushinga' : 'Venture Title'}
                <input
                  required
                  name="title"
                  type="text"
                  defaultValue={
                    selectedPlanPreset === 'poultry'
                      ? (isRw ? 'Umushinga w’Inkoko 500 za Broiler' : '500-Broiler Poultry Cycle')
                      : selectedPlanPreset === 'moto'
                      ? (isRw ? 'Moto yo gutwara abagenzi mu mujyi' : 'Commercial TVS Moto Lease')
                      : selectedPlanPreset === 'greenhouse'
                      ? (isRw ? 'Ubuhinzi bw’Inyanya mu Nzu ya Mazuku' : 'Greenhouse Tomato Project')
                      : selectedPlanPreset === 'retail'
                      ? (isRw ? 'Ubucuruzi bwa Grocery i Kimironko' : 'Kimironko Grocery Retail')
                      : ''
                  }
                  placeholder={isRw ? 'Urugero: Ubuhinzi bw’Ibigori Season A' : 'e.g. Maize Farming Season A'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Icyiciro cy’Ubucuruzi' : 'Venture Category'}
                <select
                  name="category"
                  defaultValue={selectedPlanPreset === 'poultry' || selectedPlanPreset === 'greenhouse' ? 'agriculture' : selectedPlanPreset === 'moto' ? 'transport' : 'retail'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                >
                  <option value="agriculture">{isRw ? 'Ubuhinzi n’Ubworozi (Agriculture)' : 'Agriculture & Livestock'}</option>
                  <option value="retail">{isRw ? 'Ubucuruzi bw’Amasoko (Retail / Kiosk)' : 'Retail & Grocery'}</option>
                  <option value="transport">{isRw ? 'Ingendo n’Ubutumwa (Transport)' : 'Transport & Logistics'}</option>
                  <option value="real_estate">{isRw ? 'Ubutaka n’Amazu (Real Estate)' : 'Real Estate & Rentals'}</option>
                  <option value="technology">{isRw ? 'Ikoranabuhanga (Technology)' : 'Technology & Digital'}</option>
                  <option value="services">{isRw ? 'Serivisi (Services)' : 'Professional Services'}</option>
                  <option value="other">{isRw ? 'Ibindi' : 'Other'}</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  {isRw ? 'Igishoro gikenewe (Frw)' : 'Capital Required (RWF)'}
                  <input
                    required
                    name="capitalRequired"
                    type="number"
                    min="0"
                    value={planCapital}
                    onChange={(e) => setPlanCapital(Number(e.target.value))}
                    style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  {isRw ? 'Igihe cy’umushinga (Amezi)' : 'Time Horizon (Months)'}
                  <input
                    required
                    name="timeHorizonMonths"
                    type="number"
                    min="1"
                    max="120"
                    value={planHorizon}
                    onChange={(e) => setPlanHorizon(Number(e.target.value))}
                    style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  {isRw ? 'Ibyinjira biteganyijwe (Revenues)' : 'Projected Revenues (RWF)'}
                  <input
                    required
                    name="projectedRevenue"
                    type="number"
                    min="0"
                    value={planRevenue}
                    onChange={(e) => setPlanRevenue(Number(e.target.value))}
                    style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  {isRw ? 'Ibikoreshwa (Expenses)' : 'Projected Expenses (RWF)'}
                  <input
                    required
                    name="projectedExpenses"
                    type="number"
                    min="0"
                    value={planExpenses}
                    onChange={(e) => setPlanExpenses(Number(e.target.value))}
                    style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                  />
                </label>
              </div>

              {/* Dynamic Live Financial Plan Preview */}
              <div className={styles.planFormPreview}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#166534' }}>
                  {isRw ? 'ISUZUMA RY’INYUNGU (LIVE PROFIT FORECAST)' : 'LIVE FINANCIAL PROJECTION'}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '13px', color: '#334155' }}>{isRw ? 'Inyungu Isukuye (Net Profit):' : 'Estimated Net Profit:'}</span>
                  <strong style={{ fontSize: '18px', color: planRevenue >= planExpenses ? '#15803d' : '#b91c1c' }}>
                    {planRevenue >= planExpenses ? '+' : ''}{money(planRevenue - planExpenses)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>{isRw ? 'Ijanisha ry’inyungu (Profit Margin):' : 'Profit Margin:'} <b>{planRevenue > 0 ? Math.round(((planRevenue - planExpenses) / planRevenue) * 100) : 0}%</b></span>
                  <span>{isRw ? 'Kugarura igishoro:' : 'Payback:'} <b>{(planRevenue > planExpenses && planCapital > 0) ? `~${Math.ceil(planCapital / ((planRevenue - planExpenses) / (planHorizon || 12)))} ${isRw ? 'amezi' : 'mo'}` : 'N/A'}</b></span>
                </div>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Ingamba n’Ubusobanuro (Strategy Notes)' : 'Strategy Notes / Description'}
                <input
                  name="notes"
                  type="text"
                  placeholder={isRw ? 'Uburyo uzacuruza n’aho uzagurira...' : 'Suppliers, distribution channel, operational milestones...'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowPlanModal(false)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Saving…') : (isRw ? 'Bika Umushinga' : 'Save Venture Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE GOAL MODAL --- */}
      {showGoalModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-goal-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-goal-title">{isRw ? 'Kora intego nshya yo kuzigama' : 'Create a New Savings Goal'}</h3>
              <button className={styles.closeButton} onClick={() => setShowGoalModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => setSelectedPreset('emergency')}
                style={{ background: selectedPreset === 'emergency' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Ikigega cy’Ibyago' : 'Emergency Buffer'}
              </button>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => setSelectedPreset('school')}
                style={{ background: selectedPreset === 'school' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Amafaranga y’Ishuri' : 'School Fees'}
              </button>
              <button
                type="button"
                className={styles.chipButton}
                onClick={() => setSelectedPreset('house')}
                style={{ background: selectedPreset === 'house' ? '#eaf3fe' : undefined }}
              >
                {isRw ? 'Ikibanza / Inzu' : 'Land / Home'}
              </button>
            </div>

            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Izina ry’intego' : 'Goal Name'}
                <input
                  required
                  name="name"
                  type="text"
                  defaultValue={
                    selectedPreset === 'emergency'
                      ? (isRw ? 'Ikigega cy’Ibyago' : 'Emergency Reserve')
                      : selectedPreset === 'school'
                      ? (isRw ? 'Amafaranga y’Ishuri · Igihe cya 1' : 'School Fees · Term One')
                      : selectedPreset === 'house'
                      ? (isRw ? 'Kugura Ikibanza' : 'Land / House Acquisition')
                      : ''
                  }
                  placeholder={isRw ? 'Urugero: Kugura mudasobwa' : 'e.g. Work Laptop or Emergency Fund'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga y’intego (Frw)' : 'Target Amount (RWF)'}
                <input
                  required
                  name="target"
                  type="number"
                  min="1000"
                  defaultValue={selectedPreset === 'emergency' ? '300000' : selectedPreset === 'school' ? '500000' : '1500000'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Itariki ntarengwa' : 'Target Deadline'}
                <input
                  required
                  name="deadline"
                  type="date"
                  defaultValue={new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().slice(0, 10)}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowGoalModal(false)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Saving…') : (isRw ? 'Bika Intego' : 'Save Goal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DEPOSIT MODAL --- */}
      {showDepositModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-deposit-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-deposit-title">
                {isRw ? 'Kongera amafaranga muri' : 'Add Funds to'} {showDepositModal.name}
              </h3>
              <button className={styles.closeButton} onClick={() => setShowDepositModal(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {isRw ? 'Ubu burimo:' : 'Currently saved:'} <b>{money(showDepositModal.saved)}</b> / {money(showDepositModal.target)}
            </p>

            <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['10000', '25000', '50000', '100000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={styles.chipButton}
                    style={{ background: depositAmount === amt ? '#174f83' : '#f8fafc', color: depositAmount === amt ? '#fff' : '#1e3a5f' }}
                    onClick={() => setDepositAmount(amt)}
                  >
                    +{money(Number(amt))}
                  </button>
                ))}
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga y’ubwizigame (Frw)' : 'Deposit Amount (RWF)'}
                <input
                  required
                  type="number"
                  min="500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowDepositModal(null)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Processing…') : (isRw ? 'Emeza Ubwizigame' : 'Confirm Deposit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RECORD EXPENSE MODAL --- */}
      {showExpenseModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-expense-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHead}>
              <h3 id="modal-expense-title">{isRw ? 'Andika ikintu wakoresheje' : 'Log Personal Expense'}</h3>
              <button className={styles.closeButton} onClick={() => setShowExpenseModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Amafaranga yakoreshejwe (Frw)' : 'Amount Spent (RWF)'}
                <input
                  required
                  name="amount"
                  type="number"
                  min="100"
                  placeholder="15000"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Icyiciro cy’ikoreshwa' : 'Category'}
                <select
                  name="category"
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                >
                  <option value="groceries">{isRw ? 'Ibiribwa n’Amasoko' : 'Groceries & Market'}</option>
                  <option value="housing">{isRw ? 'Ubukode n’Umuriro' : 'Housing & Utilities'}</option>
                  <option value="transport">{isRw ? 'Ingendo (Transport)' : 'Transport & Moto'}</option>
                  <option value="healthcare">{isRw ? 'Ubuzima n’Imiti' : 'Health & Pharmacy'}</option>
                  <option value="lifestyle">{isRw ? 'Ibyifuzo n’Ibindi' : 'Lifestyle & Dining'}</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                {isRw ? 'Ibisobanuro' : 'Description / Note'}
                <input
                  required
                  name="note"
                  type="text"
                  placeholder={isRw ? 'Urugero: Isoko rya Kimironko' : 'e.g. Kimironko market groceries'}
                  style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              {(d.personalAccounts || []).length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  {isRw ? 'Kura kuri iyi konti (Bihitamo)' : 'Deduct from Account (Optional)'}
                  <select
                    name="accountId"
                    style={{ padding: '9px 12px', border: '1px solid #dce5ef', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <option value="">{isRw ? '-- Nta konti igabanywaho --' : '-- No account deduction --'}</option>
                    {(d.personalAccounts || []).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.institution} - {a.accountName} ({money(a.balance)})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowExpenseModal(false)}
                >
                  {isRw ? 'Hagarika' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? (isRw ? 'Birakorwa…' : 'Saving…') : (isRw ? 'Bika' : 'Save Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
