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
  PiggyBank
} from 'lucide-react';
import styles from './personal-finance-dashboard.module.css';
import PersonalSheetDestination from './personal-sheet-destination';
import type { FinanceState } from '@/lib/contracts';

type Goal = { id: string; name: string; target: number; saved: number; deadline: string };
type Notification = { id: string; message: string; created_at?: string };

interface PersonalFinanceDashboardProps {
  d: FinanceState & {
    user: { id: string; name: string; email: string; role: string; organizationName: string | null };
    goals: Goal[];
    notifications: Notification[];
    member: { outstanding: number; eligibleSavings: number; loanLimit: number };
  };
  act: (p: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  money: (n: number) => string;
  isRw: boolean;
}

type TabKey = 'goals' | 'budget' | 'invest' | 'activity';

interface ParsedActivity {
  id: string;
  type: 'expense' | 'income' | 'system';
  category: string;
  amount: number;
  note: string;
  date: string;
}

export default function PersonalFinanceDashboard({ d, act, busy, money, isRw }: PersonalFinanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('goals');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState<Goal | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('25000');
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  // Investment Calculator State
  const [calcMonthly, setCalcMonthly] = useState(30000);
  const [calcYears, setCalcYears] = useState(3);

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
    return sum > 0 ? sum : 210000; // Baseline realistic monthly expenses in RWF
  }, [parsedActivities]);

  const loggedIncome = useMemo(() => {
    const sum = parsedActivities.filter(a => a.type === 'income').reduce((acc, a) => acc + a.amount, 0);
    return sum > 0 ? sum : 550000; // Baseline realistic monthly income in RWF
  }, [parsedActivities]);

  const totalSavedInGoals = useMemo(() => {
    return (d.goals || []).reduce((acc, g) => acc + BigInt(g.saved), 0n);
  }, [d.goals]);

  const totalTargetInGoals = useMemo(() => {
    return (d.goals || []).reduce((acc, g) => acc + BigInt(g.target), 0n);
  }, [d.goals]);

  const netWorth = Number(totalSavedInGoals);
  const monthlySavings = Math.max(0, loggedIncome - loggedExpenses);
  const savingsRate = loggedIncome > 0 ? Math.round((monthlySavings / loggedIncome) * 100) : 0;

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
    if (amount <= 0 || !note) return;

    const ok = await act({ action: 'recordPersonalExpense', amount, category, note });
    if (ok) setShowExpenseModal(false);
  };

  const handleAllocateInvestment = async (name: string, target: number, initialAmount: number) => {
    // Check if goal already exists
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
      ['Goal Name', 'Saved (RWF)', 'Target (RWF)', 'Target Date', 'Completion %'],
      ...(d.goals || []).map(g => [
        `"${g.name.replace(/"/g, '""')}"`,
        g.saved,
        g.target,
        g.deadline,
        Math.round((g.saved / g.target) * 100) + '%'
      ])
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
              <span>{isRw ? 'Intego zikora:' : 'Active Goals:'} <b>{d.goals.length}</b></span>
              <span>·</span>
              <span>{isRw ? 'Intego yose hamwe:' : 'Total Target:'} <b>{money(Number(totalTargetInGoals))}</b></span>
              <span className={styles.pillPositive}>
                <TrendingUp size={12} />
                {totalTargetInGoals > 0n ? Math.min(100, Math.round((netWorth / Number(totalTargetInGoals)) * 100)) : 0}% {isRw ? 'byagezweho' : 'achieved'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '38px', padding: '8px 14px' }}
              onClick={() => setShowGoalModal(true)}
              disabled={busy}
            >
              <Plus size={15} />
              {isRw ? 'Intego nshya' : 'New Goal / Asset'}
            </button>
            <button
              className="button button-quiet"
              style={{ fontSize: '12px', minHeight: '38px', padding: '8px 14px' }}
              onClick={() => setShowExpenseModal(true)}
              disabled={busy}
            >
              <ArrowUpRight size={15} />
              {isRw ? 'Andika ikikoreshejwe' : 'Log Expense'}
            </button>
          </div>
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

      {/* 2. MINIMALIST SEGMENTED TABS */}
      <nav className={styles.tabsNav} aria-label="Personal finance views">
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
          className={`${styles.tabButton} ${activeTab === 'invest' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('invest')}
        >
          <TrendingUp size={16} />
          {isRw ? 'Ishoramari mu Rwanda' : 'Invest & Grow'}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'activity' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Calendar size={16} />
          {isRw ? 'Ibikorwa & Google Sheets' : 'Activity & Sheets'}
        </button>
      </nav>

      {/* 3. TAB CONTENT */}
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
            <button
              className="button button-primary"
              style={{ fontSize: '12px', minHeight: '36px' }}
              onClick={() => setShowExpenseModal(true)}
              disabled={busy}
            >
              <Plus size={15} />
              {isRw ? 'Andika ikikoreshejwe' : 'Log Expense'}
            </button>
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
                <span style={{ color: '#64748b' }}>{isRw ? 'Ingengo yose:' : 'Monthly Cap:'} {money(loggedIncome)}</span>
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

      {/* --- TAB 3: INVEST & GROW --- */}
      {activeTab === 'invest' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Amahirwe y’Ishoramari mu Rwanda' : 'Rwanda Wealth-Building Instruments'}</h2>
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

      {/* --- TAB 4: ACTIVITY & SHEETS SYNC --- */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.sectionHead}>
            <div>
              <h2>{isRw ? 'Guhuza na Google Sheets n’Ibikorwa' : 'Connected Sheets & Personal Activity'}</h2>
              <p>{isRw ? 'Icyegeranyo cy’ibikorwa byawe n’uburyo byoherezwa mu mbonerahamwe ya Google.' : 'Export your goals and activity automatically into linked spreadsheet summaries.'}</p>
            </div>
            <button
              className="button button-quiet"
              style={{ fontSize: '12px', minHeight: '36px' }}
              onClick={handleExportCSV}
            >
              <Download size={15} />
              {isRw ? 'Kuramo CSV' : 'Export CSV'}
            </button>
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
