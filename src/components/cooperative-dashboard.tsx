'use client';

import { useEffect, useState } from 'react';
import type {
  FinanceState, Role, CooperativeState,
  CooperativeDelivery, CooperativeSale, CooperativeShareAccount,
  CooperativeSurplusAllocation, CooperativeInvestment
} from '@/lib/contracts';
import {
  Landmark,
  Coins,
  ShieldCheck,
  TrendingUp,
  Truck,
  ShoppingCart,
  Receipt,
  Sparkles,
  Users,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Lock,
  X,
  PieChart,
  Activity,
  Calculator,
  Check
} from 'lucide-react';
import s from './cooperative-dashboard.module.css';

interface CooperativeDashboardProps {
  d: FinanceState & { user: { id: string; name: string; role: Role; organizationName: string | null } };
  role: Role;
  act: (p: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  money: (n: number) => string;
  isRw: boolean;
  onCreateNew?: () => void;
}

export default function CooperativeDashboard({
  d,
  role,
  act,
  busy,
  money,
  isRw,
  onCreateNew
}: CooperativeDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'shares' | 'deliveries' | 'sales' | 'accounting' | 'memberValue' | 'guardian' | 'governance'
  >('overview');

  // Modals state
  const [showSubscribeSharesModal, setShowSubscribeSharesModal] = useState(false);
  const [showPaySharesModal, setShowPaySharesModal] = useState(false);
  const [showRecordDeliveryModal, setShowRecordDeliveryModal] = useState(false);
  const [showRecordSaleModal, setShowRecordSaleModal] = useState(false);
  const [showRecordExpenseModal, setShowRecordExpenseModal] = useState(false);
  const [showSurplusCalcModal, setShowSurplusCalcModal] = useState(false);
  const [showApproveSurplusModal, setShowApproveSurplusModal] = useState<string | null>(null);
  const [showNewInvestmentModal, setShowNewInvestmentModal] = useState(false);
  const [showNewGovernanceEventModal, setShowNewGovernanceEventModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberPin, setMemberPin] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  // Form states
  const [shareCount, setShareCount] = useState(10);
  const [deliveryProduct, setDeliveryProduct] = useState('Maize (Ibigori)');
  const [deliveryCategory, setDeliveryCategory] = useState<'grain'|'horticulture'|'coffee'|'dairy'|'other'>('grain');
  const [deliveryQty, setDeliveryQty] = useState(500);
  const [deliveryPrice, setDeliveryPrice] = useState(450);
  const [deliveryGrade, setDeliveryGrade] = useState('Grade A');
  const [saleBuyer, setSaleBuyer] = useState('Rwanda Grains Processing Ltd');
  const [saleProduct, setSaleProduct] = useState('Maize Grade A');
  const [saleQty, setSaleQty] = useState(2000);
  const [salePrice, setSalePrice] = useState(550);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(50000);
  const [expenseCategory, setExpenseCategory] = useState('Operational');
  const [periodLabel, setPeriodLabel] = useState('2025/2026 Agricultural Season');
  const [resolutionRef, setResolutionRef] = useState('GA-RES-2026-01');
  const [invTitle, setInvTitle] = useState('');
  const [invCost, setInvCost] = useState(0);
  const [invBenefit, setInvBenefit] = useState(0);
  const [invOpCost, setInvOpCost] = useState(0);
  const [govTitle, setGovTitle] = useState('');
  const [govType, setGovType] = useState<'board_meeting'|'general_assembly'|'supervisory_audit'>('board_meeting');
  const [govAgenda, setGovAgenda] = useState('');
  const [govResolutions, setGovResolutions] = useState('');

  // Digital Twin interactive simulation state
  const [simCost, setSimCost] = useState(0);
  const [simBenefit, setSimBenefit] = useState(0);
  const [simOpCost, setSimOpCost] = useState(0);

  const coop = d.cooperativeState;
  const members = coop?.members ?? [];
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const profile = coop?.profile;
  const statements = coop?.financialStatements;

  // Financial positions
  const cash = statements?.cash ?? d.cooperative.cash;
  const reserve = statements?.reserve ?? d.cooperative.reserve;
  const shareCapital = statements?.shareCapital ?? d.cooperative.shareCapital;
  const revenue = statements?.revenue ?? d.cooperative.revenue;
  const expenses = statements?.expenses ?? d.cooperative.expenses;
  const netSurplus = statements?.netSurplus ?? Math.max(0, revenue - expenses);

  const orgId = profile?.orgId ?? 'coop-imena';
  const orgName = profile?.name ?? d.user.organizationName ?? (isRw ? 'Koperative' : 'Cooperative');

  const canApproveExpense = ['president', 'cooperative'].includes(role);
  const canPayExpense = ['treasurer', 'president', 'cooperative'].includes(role);
  const coopExpenses = d.groupExpenses || [];

  // Digital Twin instant calculation
  const simNetGain = Math.max(0, simBenefit - simOpCost);
  const simPaybackMonths = simNetGain > 0 ? Math.ceil(simCost / simNetGain) : 999;
  const simRemainingCash = cash - simCost;
  const simLiquidityBuffer = simRemainingCash - reserve;
  const simVerdict =
    simRemainingCash < reserve
      ? 'critical_liquidity'
      : simPaybackMonths > 60
      ? 'caution'
      : 'sustainable';

  // Handlers
  const handleSubscribeShares = async () => {
    await act({ action: 'subscribeCoopShares', orgId, shares: shareCount });
    setShowSubscribeSharesModal(false);
  };

  const handlePayShares = async () => {
    await act({ action: 'payCoopShares', orgId, shares: shareCount });
    setShowPaySharesModal(false);
  };

  const handleRecordDelivery = async () => {
    await act({
      action: 'recordCoopDelivery',
      orgId,
      productName: deliveryProduct,
      category: deliveryCategory,
      quantity: deliveryQty,
      unitPrice: deliveryPrice,
      grade: deliveryGrade
    });
    setShowRecordDeliveryModal(false);
  };

  const handleRecordSale = async () => {
    await act({
      action: 'recordCoopSale',
      orgId,
      buyerName: saleBuyer,
      productName: saleProduct,
      quantity: saleQty,
      unitPrice: salePrice
    });
    setShowRecordSaleModal(false);
  };

  const handleRecordExpense = async () => {
    await act({
      action: 'recordCoopExpense',
      orgId,
      title: expenseTitle,
      amount: expenseAmount,
      category: expenseCategory
    });
    setShowRecordExpenseModal(false);
  };

  const handleCalculateSurplus = async () => {
    await act({ action: 'calculateSurplusAllocation', orgId, periodLabel });
    setShowSurplusCalcModal(false);
  };

  const handleApproveSurplus = async (allocationId: string) => {
    await act({ action: 'approveSurplusAllocation', orgId, allocationId, resolutionRef });
    setShowApproveSurplusModal(null);
  };

  const handleDistributeSurplus = async (allocationId: string) => {
    await act({ action: 'distributeMemberSurplus', orgId, allocationId });
  };

  const handleSimulateInvestment = async () => {
    await act({
      action: 'simulateInvestmentProposal',
      orgId,
      title: invTitle,
      capitalCost: invCost,
      expectedMonthlyBenefit: invBenefit,
      monthlyOperatingCost: invOpCost
    });
    setShowNewInvestmentModal(false);
  };

  const handleRecordGovernance = async () => {
    await act({
      action: 'recordGovernanceEvent',
      orgId,
      eventType: govType,
      title: govTitle,
      agenda: govAgenda,
      resolutions: govResolutions
    });
    setShowNewGovernanceEventModal(false);
  };

  const handleAddMember = async () => {
    if (!navigator.onLine) return;
    const saved = await act({ action: 'addCoopMember', orgId, name: memberName.trim(), phone: memberPhone.trim(), pin: memberPin });
    if (saved) {
      setMemberName('');
      setMemberPhone('');
      setMemberPin('');
      setShowAddMemberModal(false);
    }
  };

  return (
    <div className={s.container}>
      {/* Top Banner */}
      <section className={s.headerBanner}>
        <div className={s.titleArea}>
          <div className={s.badgeRow}>
            {profile?.category && <span className={s.categoryBadge}>{profile.category}</span>}
          </div>
          <h1 className={s.orgTitle}>{orgName}</h1>
          <p className={s.orgSubtitle}>
            {profile?.sector ? `${profile.sector}${profile.district ? ` · ${profile.district}` : ''}` : profile?.district ?? ''}
          </p>
          <p className={s.disclosure}>{isRw ? 'Iyi ni demo. Ibikorwa by’imari birageragezwa kandi amafaranga ntayo yoherezwa.' : 'Demo workspace. Financial activity is simulated; no real money is sent.'}</p>
        </div>

        <div className={s.headerActions}>
          <button className={s.primaryButton} disabled={busy || (role === 'cooperative' && !isOnline)} onClick={() => { setActiveTab('shares'); if (role === 'cooperative') setShowAddMemberModal(true); }}>
            {role === 'cooperative' ? <Plus size={16} /> : <Users size={16} />} {role === 'cooperative' ? (isRw ? 'Ongeraho umunyamuryango' : 'Add member') : (isRw ? 'Abanyamuryango' : 'Members')}
          </button>
          {onCreateNew && (
            <button className={s.secondaryButton} onClick={onCreateNew}>
              {isRw ? 'Kora indi Koperative' : 'Create Cooperative'}
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <nav className={s.tabsBar}>
        {[
          { id: 'overview', label: isRw ? 'Incamake' : 'Overview', icon: Landmark, active: activeTab === 'overview' },
          { id: 'shares', label: isRw ? 'Abanyamuryango' : 'Members', icon: Users, active: activeTab === 'shares' },
          { id: 'activity', label: isRw ? 'Ibikorwa' : 'Activity', icon: Activity, active: ['deliveries', 'sales', 'accounting'].includes(activeTab) },
          { id: 'more', label: isRw ? 'Ibindi' : 'More', icon: Plus, active: ['memberValue', 'guardian', 'governance'].includes(activeTab) }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`${s.tabButton} ${t.active ? s.activeTab : ''}`}
              onClick={() => t.id === 'activity' ? setActiveTab('deliveries') : t.id === 'more' ? setActiveTab('memberValue') : setActiveTab(t.id as typeof activeTab)}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </nav>
      {(['deliveries', 'sales', 'accounting'].includes(activeTab) || ['memberValue', 'guardian', 'governance'].includes(activeTab)) && (
        <nav className={s.subTabsBar} aria-label={isRw ? 'Ibikorwa' : 'Dashboard sections'}>
          {(activeTab === 'deliveries' || activeTab === 'sales' || activeTab === 'accounting'
            ? [{ id: 'deliveries', label: isRw ? 'Umusaruro' : 'Deliveries' }, { id: 'sales', label: isRw ? 'Igurisha' : 'Sales' }, { id: 'accounting', label: isRw ? 'Ibaruramari' : 'Accounting' }]
            : [{ id: 'memberValue', label: isRw ? 'Inyungu' : 'Surplus' }, { id: 'guardian', label: isRw ? 'Ishoramari' : 'Investment' }, { id: 'governance', label: isRw ? 'Imiyoborere' : 'Governance' }]
          ).map(item => <button key={item.id} className={`${s.subTabButton} ${activeTab === item.id ? s.subTabActive : ''}`} onClick={() => setActiveTab(item.id as typeof activeTab)}>{item.label}</button>)}
        </nav>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          <div className={s.kpiGrid}>
            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span>{isRw ? 'Amafaranga Ahari' : 'Available Cash'}</span>
                <span className={s.kpiIconWrapper}><Coins size={16} /></span>
              </div>
              <strong className={s.kpiValue}>{money(cash)}</strong>
              <small className={s.kpiNote}>{isRw ? 'Ari kuri konti ya banki na MoMo' : 'Bank & MoMo liquidity'}</small>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}><span>{isRw ? 'Abanyamuryango' : 'Members'}</span><span className={s.kpiIconWrapper}><Users size={16} /></span></div>
              <strong className={s.kpiValue}>{role === 'cooperative' ? members.length : profile?.memberCount ?? '—'}</strong>
              <small className={s.kpiNote}>{isRw ? 'Reba urutonde rw’abanyamuryango' : 'View the member list'}</small>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span>{isRw ? 'Inyungu Yanditswe' : 'Net Operating Surplus'}</span>
                <span className={s.kpiIconWrapper}><TrendingUp size={16} /></span>
              </div>
              <strong className={s.kpiValue} style={{ color: netSurplus >= 0 ? '#15803d' : '#b91c1c' }}>
                {money(netSurplus)}
              </strong>
              <small className={s.kpiNote}>{isRw ? 'Umusaruro w’igihembwe gishize' : 'Surplus available for allocation'}</small>
            </div>
          </div>

          <div className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div><h3 className={s.sectionTitle}>{isRw ? 'Abanyamuryango' : 'Members'}</h3><p className={s.sectionSubtitle}>{isRw ? 'Reba urutonde rw’abanyamuryango' : 'Your cooperative member list, in one place.'}</p></div>
              <button className={s.primaryButton} onClick={() => setActiveTab('shares')}><Users size={16} /> {isRw ? 'Fungura urutonde' : 'Open member list'}</button>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: SHARES & CAPITAL */}
      {activeTab === 'shares' && (
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><Users size={20} color="#2463a6" /> {isRw ? 'Abanyamuryango' : 'Members'}</h2>
              <p className={s.sectionSubtitle}>
                {isRw ? 'Reba kandi ucunge abanyamuryango ba koperative.' : 'View and manage cooperative members.'}
              </p>
            </div>
            {role === 'cooperative' && <button className={s.primaryButton} onClick={() => setShowAddMemberModal(true)} disabled={busy || !isOnline}><Plus size={16} /> {isRw ? 'Ongeraho umunyamuryango' : 'Add member'}</button>}
          </div>

          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead><tr><th>{isRw ? 'Izina' : 'Name'}</th><th>{isRw ? 'Telefoni' : 'Phone'}</th><th>{isRw ? 'Uruhare' : 'Role'}</th></tr></thead>
              <tbody>
                {members.map(member => <tr key={member.id}><td><b>{member.name}</b></td><td>{member.phone ?? '—'}</td><td>{member.role}</td></tr>)}
                {!members.length && <tr><td colSpan={3} className={s.tableEmpty}>{role === 'cooperative' ? (isRw ? 'Nta munyamuryango urongerwamo.' : 'No members added yet.') : (isRw ? 'Urutonde rw’abanyamuryango ntirubonetse kuri uru ruhare.' : 'Member list is available to the cooperative administrator.')}</td></tr>}
              </tbody>
            </table>
          </div>

          <details className={s.secondarySection}>
            <summary>{isRw ? 'Imigabane n’iyishyurwa' : 'Share capital and payments'}</summary>
            <div className={s.sectionHeader}>
              <div><p className={s.sectionSubtitle}>{isRw ? `Agaciro k’umugabane: ${money(profile?.nominalShareValue ?? 10000)}` : `Nominal share value: ${money(profile?.nominalShareValue ?? 10000)}`}</p></div>
              <div className={s.actionRow}>
                <button className={s.lightButton} onClick={() => setShowSubscribeSharesModal(true)} disabled={busy}><Plus size={16} /> {isRw ? 'Iyandikisheho imigabane' : 'Subscribe shares'}</button>
                <button className={s.lightButton} onClick={() => setShowPaySharesModal(true)} disabled={busy}><Coins size={16} /> {isRw ? 'Ishyura imigabane' : 'Pay shares'}</button>
              </div>
            </div>

          {coop?.myShareAccount && (
            <div className={s.mveBanner}>
              <strong>{isRw ? 'Konti Yanjye y’Imigabane:' : 'My Member Share Account:'}</strong>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <div><span>{isRw ? 'Imigabane Yanditse:' : 'Subscribed:'}</span> <b>{coop.myShareAccount.sharesSubscribed} ({money(coop.myShareAccount.amountSubscribed)})</b></div>
                <div><span>{isRw ? 'Imigabane Yishyuwe:' : 'Paid-Up:'}</span> <b style={{ color: '#15803d' }}>{coop.myShareAccount.sharesPaid} ({money(coop.myShareAccount.amountPaid)})</b></div>
                <div><span>{isRw ? 'Asigaye Kwishyurwa:' : 'Outstanding:'}</span> <b style={{ color: coop.myShareAccount.amountOutstanding > 0 ? '#b91c1c' : '#64748b' }}>{money(coop.myShareAccount.amountOutstanding)}</b></div>
              </div>
            </div>
          )}

          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Umunyamuryango' : 'Member'}</th>
                  <th>{isRw ? 'Yanditse' : 'Subscribed'}</th>
                  <th>{isRw ? 'Yishyuwe' : 'Paid-Up'}</th>
                  <th>{isRw ? 'Agaciro Yishyuwe' : 'Paid Amount'}</th>
                  <th>{isRw ? 'Asigaye' : 'Outstanding'}</th>
                  <th>{isRw ? 'Imiterere' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {(coop?.shares ?? []).map(sh => (
                  <tr key={sh.id}>
                    <td><b>{sh.userName ?? sh.userId}</b></td>
                    <td>{sh.sharesSubscribed} {isRw ? 'imigabane' : 'shares'}</td>
                    <td>{sh.sharesPaid} {isRw ? 'imigabane' : 'shares'}</td>
                    <td><strong style={{ color: '#15803d' }}>{money(sh.amountPaid)}</strong></td>
                    <td>{sh.amountOutstanding > 0 ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>{money(sh.amountOutstanding)}</span> : '—'}</td>
                    <td><span className={`${s.statusBadge} ${sh.sharesPaid > 0 ? s.statusPaid : s.statusPending}`}>{sh.status}</span></td>
                  </tr>
                ))}
                {(!coop?.shares || coop.shares.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                      {isRw ? 'Nta myirondoro y’imigabane irandikwa.' : 'No share capital accounts recorded.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </details>
        </div>
      )}

      {/* TAB 3: PRODUCTION & DELIVERIES */}
      {activeTab === 'deliveries' && (
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><Truck size={20} color="#2463a6" /> {isRw ? 'Umusaruro Watanzwe n’Abanyamuryango' : 'Member Produce Deliveries'}</h2>
              <p className={s.sectionSubtitle}>{isRw ? 'Ibyakiriwe, igipimo cy’ubuziranenge n’amafaranga yo kwishyura' : 'Intake records, quality inspection and member payment'}</p>
            </div>
            <button className={s.primaryButton} onClick={() => setShowRecordDeliveryModal(true)} disabled={busy}>
              <Plus size={16} /> {isRw ? 'Akira Umusaruro Mushya' : 'Intake New Delivery'}
            </button>
          </div>

          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Itariki' : 'Date'}</th>
                  <th>{isRw ? 'Umunyamuryango' : 'Member'}</th>
                  <th>{isRw ? 'Igihingwa' : 'Produce'}</th>
                  <th>{isRw ? 'Ingano' : 'Quantity'}</th>
                  <th>{isRw ? 'Ubuziranenge' : 'Grade'}</th>
                  <th>{isRw ? 'Igiciro / Igipimo' : 'Unit Price'}</th>
                  <th>{isRw ? 'Amafaranga Yose' : 'Total Amount'}</th>
                  <th>{isRw ? 'Kwishyura' : 'Payment Status'}</th>
                  <th>{isRw ? 'Igikorwa' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {(coop?.deliveries ?? []).map(dl => (
                  <tr key={dl.id}>
                    <td>{dl.deliveryDate}</td>
                    <td><b>{dl.memberName ?? dl.userId}</b></td>
                    <td>{dl.productName}</td>
                    <td><strong>{dl.quantity.toLocaleString()} {dl.unit}</strong></td>
                    <td><span className={s.categoryBadge}>{dl.grade}</span></td>
                    <td>{money(dl.unitPrice)} / {dl.unit}</td>
                    <td><strong style={{ color: '#2463a6' }}>{money(dl.totalValue)}</strong></td>
                    <td>
                      <span className={`${s.statusBadge} ${dl.paymentStatus === 'paid' ? s.statusPaid : s.statusPending}`}>
                        {dl.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {dl.paymentStatus === 'pending' ? (
                        <button
                          className={s.primaryButton}
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => act({ action: 'confirmDeliveryPayment', orgId, deliveryId: dl.id })}
                          disabled={busy}
                        >
                          {isRw ? 'Emeza Kwishyura (MoMo)' : 'Confirm MoMo Payout'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={14} /> {dl.paymentReference}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!coop?.deliveries || coop.deliveries.length === 0) && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                      {isRw ? 'Nta musaruro urakirwa.' : 'No member produce deliveries recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMMERCIAL SALES */}
      {activeTab === 'sales' && (
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><ShoppingCart size={20} color="#2463a6" /> {isRw ? 'Kugurisha ku Masoko n’Inganda' : 'Commercial Sales to Off-Takers'}</h2>
              <p className={s.sectionSubtitle}>{isRw ? 'Amasezerano yo kugurisha, ingano yagurishijwe n’amafaranga yinjiye' : 'Commercial buyer sales, contracts and sales revenue'}</p>
            </div>
            <button className={s.primaryButton} onClick={() => setShowRecordSaleModal(true)} disabled={busy}>
              <Plus size={16} /> {isRw ? 'Andika Igurisha' : 'Record Sale'}
            </button>
          </div>

          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Itariki' : 'Date'}</th>
                  <th>{isRw ? 'Umuguzi' : 'Buyer'}</th>
                  <th>{isRw ? 'Igicuruzwa' : 'Product'}</th>
                  <th>{isRw ? 'Ingano' : 'Quantity'}</th>
                  <th>{isRw ? 'Igiciro' : 'Unit Price'}</th>
                  <th>{isRw ? 'Amafaranga Yose' : 'Total Revenue'}</th>
                  <th>{isRw ? 'Imiterere' : 'Status'}</th>
                  <th>{isRw ? 'Inyandiko' : 'Reference'}</th>
                </tr>
              </thead>
              <tbody>
                {(coop?.sales ?? []).map(sl => (
                  <tr key={sl.id}>
                    <td>{sl.saleDate}</td>
                    <td><b>{sl.buyerName}</b></td>
                    <td>{sl.productName}</td>
                    <td>{sl.quantity.toLocaleString()} {sl.unit}</td>
                    <td>{money(sl.unitPrice)} / {sl.unit}</td>
                    <td><strong style={{ color: '#15803d' }}>+{money(sl.totalAmount)}</strong></td>
                    <td><span className={`${s.statusBadge} ${s.statusPaid}`}>{sl.paymentStatus}</span></td>
                    <td><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{sl.paymentReference ?? '—'}</span></td>
                  </tr>
                ))}
                {(!coop?.sales || coop.sales.length === 0) && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                      {isRw ? 'Nta bikorwa byo kugurisha birandikwa.' : 'No commercial sales recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ACCOUNTANT WORKSPACE */}
      {activeTab === 'accounting' && (
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><Receipt size={20} color="#2463a6" /> {isRw ? 'Ibaruramari ry’Umwuga' : 'Cooperative Financial Accounting & Statements'}</h2>
              <p className={s.sectionSubtitle}>{isRw ? 'Ibitabo by’imari, inyandiko z’ubucuruzi n’amasoko yasohotse' : 'Double-entry ledger, P&L statement, balance sheet and expenses'}</p>
            </div>
            <button className={s.primaryButton} onClick={() => setShowRecordExpenseModal(true)} disabled={busy}>
              <Plus size={16} /> {isRw ? 'Andika Iyasohotse' : 'Record Expense'}
            </button>
          </div>

          {/* Statements Summary */}
          <div className={s.kpiGrid}>
            <div className={s.kpiCard}>
              <div className={s.kpiTop}><span>{isRw ? 'Umusaruro Winjiye (Revenue)' : 'Total Revenue'}</span></div>
              <strong className={s.kpiValue} style={{ color: '#15803d' }}>{money(revenue)}</strong>
              <small className={s.kpiNote}>{isRw ? 'Amasoko no kugurisha ibihingwa' : 'Commercial sales & services'}</small>
            </div>
            <div className={s.kpiCard}>
              <div className={s.kpiTop}><span>{isRw ? 'Amafaranga Yasohotse (Expenses)' : 'Total Expenses'}</span></div>
              <strong className={s.kpiValue} style={{ color: '#b91c1c' }}>{money(expenses)}</strong>
              <small className={s.kpiNote}>{isRw ? 'Kwishyura umusaruro n’imikorere' : 'Produce costs & operations'}</small>
            </div>
            <div className={s.kpiCard}>
              <div className={s.kpiTop}><span>{isRw ? 'Inyungu/Igihombo (Net Surplus)' : 'Net Surplus / Loss'}</span></div>
              <strong className={s.kpiValue} style={{ color: netSurplus >= 0 ? '#15803d' : '#b91c1c' }}>{money(netSurplus)}</strong>
              <small className={s.kpiNote}>{isRw ? 'Umusaruro usigaye mu gitabo' : 'Operating performance'}</small>
            </div>
            <div className={s.kpiCard}>
              <div className={s.kpiTop}><span>{isRw ? 'Umutungo Ufatika (Assets)' : 'Equipment & Fixed Assets'}</span></div>
              <strong className={s.kpiValue}>{money(statements?.equipmentAssets ?? 0)}</strong>
              <small className={s.kpiNote}>{isRw ? 'Imashini zo gusya no gutunganya' : 'Grain mills & solar storage'}</small>
            </div>
          </div>

          {/* 3-Step Expense Approval Workflow Banner */}
          <div className={s.mveFormulaExplanation}>
            <strong>{isRw ? 'Uburyo bwo Kwemeza Amafaranga Asohoka (3-Step Workflow):' : 'Strict 3-Step Expense Approval Workflow:'}</strong><br />
            {isRw
              ? '1. Umucungamari yandika fagitire (status: recorded) → 2. Perezida abyemeza (status: approved) → 3. Umubitsi asohoza kuri MoMo (status: paid). Amafaranga agabanuka gusa ku ntambwe ya 3!'
              : '1. Accountant logs expense (recorded) → 2. Chairperson approves (approved) → 3. Treasurer confirms via MoMo (paid). Cash balance reduces strictly on step 3!'}
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem 0' }}>
            {isRw ? 'Urutonde rw’Amasoko & Kwemeza (Expenses & Approval Queue)' : 'Expenses & Approval Workflow Queue'}
          </h3>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Itariki' : 'Date'}</th>
                  <th>{isRw ? 'Icyiciro' : 'Category'}</th>
                  <th>{isRw ? 'Umutwe' : 'Title'}</th>
                  <th>{isRw ? 'Amafaranga' : 'Amount'}</th>
                  <th>{isRw ? 'Yanditswe na' : 'Recorded By'}</th>
                  <th>{isRw ? 'Yemejwe na' : 'Approved By'}</th>
                  <th>{isRw ? 'Imiterere' : 'Status'}</th>
                  <th>{isRw ? 'Igikorwa' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {coopExpenses.map(e => (
                  <tr key={e.id}>
                    <td>{e.createdAt}</td>
                    <td><span className={s.statusBadge}>{e.category}</span></td>
                    <td><b>{e.title}</b>{e.description && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{e.description}</div>}</td>
                    <td><strong style={{ color: '#b91c1c' }}>-{money(e.amount)}</strong></td>
                    <td>{e.recordedByName || e.recordedBy}</td>
                    <td>{e.approvedByName || e.approvedBy || '—'}</td>
                    <td>
                      <span className={`${s.statusBadge} ${e.status === 'paid' ? s.statusPaid : e.status === 'approved' ? s.statusSubscribed : s.statusPending}`}>
                        {e.status}
                      </span>
                    </td>
                    <td>
                      {e.status === 'recorded' && canApproveExpense && (
                        <button
                          className={s.primaryButton}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => act({ action: 'approveCoopExpense', orgId, expenseId: e.id, decision: 'approve' })}
                          disabled={busy}
                        >
                          {isRw ? 'Emeza' : 'Approve'}
                        </button>
                      )}
                      {e.status === 'approved' && canPayExpense && (
                        <button
                          className={s.primaryButton}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: '#059669' }}
                          onClick={() => act({ action: 'confirmCoopExpensePayment', orgId, expenseId: e.id })}
                          disabled={busy}
                        >
                          {isRw ? 'Kwishyura (MoMo)' : 'Confirm MoMo Payment'}
                        </button>
                      )}
                      {e.status === 'paid' && (
                        <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={14} /> {e.paymentReference || 'Paid'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!coopExpenses.length && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      {isRw ? 'Nta fagitire cyangwa amasoko byanditswe.' : 'No expenses recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem 0' }}>{isRw ? 'Ibitabo by’Imari (Recent Journal Entries)' : 'Recent Ledger Journal Entries'}</h3>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Itariki' : 'Date'}</th>
                  <th>{isRw ? 'Ibisobanuro' : 'Description'}</th>
                  <th>{isRw ? 'Inyandiko' : 'Reference'}</th>
                  <th>{isRw ? 'Debit (Frw)' : 'Debit (RWF)'}</th>
                  <th>{isRw ? 'Credit (Frw)' : 'Credit (RWF)'}</th>
                </tr>
              </thead>
              <tbody>
                {d.ledger.slice(0, 10).map(l => (
                  <tr key={l.id}>
                    <td>{l.date}</td>
                    <td><b>{l.description}</b></td>
                    <td><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.reference}</span></td>
                    <td>{l.debit > 0 ? <strong style={{ color: '#15803d' }}>{money(l.debit)}</strong> : '—'}</td>
                    <td>{l.credit > 0 ? <strong style={{ color: '#b91c1c' }}>{money(l.credit)}</strong> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: MEMBER VALUE ENGINE */}
      {activeTab === 'memberValue' && (
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><Sparkles size={20} color="#2463a6" /> {isRw ? 'HURIZA Member Value Engine' : 'HURIZA Member Value Engine'}</h2>
              <p className={s.sectionSubtitle}>
                {isRw
                  ? 'Guhuza imigabane n’umusaruro watanzwe kugira ngo habarwe inyungu z’abanyamuryango (Dividends & Patronage Bonuses)'
                  : 'Automated, transparent distribution calculations linking member shares, produce deliveries, and net surplus'}
              </p>
            </div>
            <button className={s.primaryButton} onClick={() => setShowSurplusCalcModal(true)} disabled={busy}>
              <Calculator size={16} /> {isRw ? 'Bara Inyungu z’Igihembwe' : 'Run Surplus Calculation'}
            </button>
          </div>

          {/* Allocation explanation banner */}
          <div className={s.mveBanner}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#14283f' }}>
                {isRw ? 'Ihame ryo Kugabana Inyungu (Statutory & Bylaw Rules):' : 'Lawful Distribution Framework:'}
              </span>
              <span className={s.categoryBadge}>{isRw ? 'Amategeko ya RCA n’Amabwiriza y’Iteka' : 'RCA Guidance & Bylaws'}</span>
            </div>
            <div className={s.mveGrid}>
              <div className={s.mveStatBox}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Ikigega cy’Itegeko (Statutory Reserve)' : 'Legal Reserve Allocation'}</span>
                <strong style={{ fontSize: '1.25rem', color: '#2463a6' }}>{((profile?.statutoryReserveBps ?? 2000) / 100).toFixed(0)}%</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{isRw ? 'Kirinzwe ku mutungo' : 'Retained for resilience'}</small>
              </div>
              <div className={s.mveStatBox}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Ikigega cy’Imibereho (Social Fund)' : 'Social & Education Fund'}</span>
                <strong style={{ fontSize: '1.25rem', color: '#2463a6' }}>{((profile?.socialFundBps ?? 1000) / 100).toFixed(0)}%</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{isRw ? 'Amahugurwa n’imibereho' : 'Member training & social'}</small>
              </div>
              <div className={s.mveStatBox}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Gahunda y’Imigabane (Dividends Pool)' : 'Capital Dividends Pool'}</span>
                <strong style={{ fontSize: '1.25rem', color: '#15803d' }}>{((profile?.dividendPoolBps ?? 4000) / 100).toFixed(0)}%</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{isRw ? 'Ibarirwa ku migabane yishyuwe' : 'Based on paid shares'}</small>
              </div>
              <div className={s.mveStatBox}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{isRw ? 'Gahunda y’Umusaruro (Patronage Bonus)' : 'Patronage Bonus Pool'}</span>
                <strong style={{ fontSize: '1.25rem', color: '#15803d' }}>{((profile?.bonusPoolBps ?? 6000) / 100).toFixed(0)}%</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{isRw ? 'Ibarirwa ku bihingwa byatanzwe' : 'Based on produce delivered'}</small>
              </div>
            </div>
          </div>

          {/* Allocations Table */}
          {(coop?.surplusAllocations ?? []).map(alloc => (
            <div key={alloc.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{alloc.periodLabel}</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    {isRw ? 'Inyungu yose:' : 'Net Surplus:'} <b>{money(alloc.netSurplus)}</b> · {isRw ? 'Igabanywa:' : 'Distributable:'} <b>{money(alloc.distributableSurplus)}</b> (Dividends: {money(alloc.dividendPool)} · Bonuses: {money(alloc.bonusPool)})
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`${s.statusBadge} ${alloc.status === 'distributed' ? s.statusPaid : alloc.status === 'approved_by_assembly' ? s.statusConfirmed : s.statusPending}`}>
                    {alloc.status}
                  </span>
                  {alloc.status === 'calculated' && (
                    <button
                      className={s.primaryButton}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => setShowApproveSurplusModal(alloc.id)}
                      disabled={busy}
                    >
                      {isRw ? 'Emeza nka General Assembly' : 'Approve by General Assembly'}
                    </button>
                  )}
                  {alloc.status === 'approved_by_assembly' && (
                    <button
                      className={s.primaryButton}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#15803d' }}
                      onClick={() => handleDistributeSurplus(alloc.id)}
                      disabled={busy}
                    >
                      {isRw ? 'Tanga Amafaranga (MoMo Payouts)' : 'Execute MoMo Payouts'}
                    </button>
                  )}
                </div>
              </div>

              {/* Members distribution breakdown table */}
              <div className={s.tableWrapper}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>{isRw ? 'Umunyamuryango' : 'Member'}</th>
                      <th>{isRw ? 'Imigabane (% y’imigabane)' : 'Shares (% Equity)'}</th>
                      <th>{isRw ? 'Inyungu ku Migabane' : 'Share Dividend'}</th>
                      <th>{isRw ? 'Umusaruro (% y’ibicurujwe)' : 'Deliveries (% Volume)'}</th>
                      <th>{isRw ? 'Inyungu ku Musaruro' : 'Patronage Bonus'}</th>
                      <th>{isRw ? 'Amafaranga Yose' : 'Total Entitlement'}</th>
                      <th>{isRw ? 'Imiterere' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(alloc.distributions ?? []).map(dst => (
                      <tr key={dst.id}>
                        <td><b>{dst.userName ?? dst.userId}</b></td>
                        <td>{dst.sharesHeld} ({(dst.shareRatioBps / 100).toFixed(1)}%)</td>
                        <td style={{ color: '#2463a6' }}><strong>{money(dst.dividendAmount)}</strong></td>
                        <td>{dst.participationUnits.toLocaleString()} kg ({(dst.participationRatioBps / 100).toFixed(1)}%)</td>
                        <td style={{ color: '#2463a6' }}><strong>{money(dst.bonusAmount)}</strong></td>
                        <td><strong style={{ color: '#15803d', fontSize: '1rem' }}>{money(dst.totalEntitlement)}</strong></td>
                        <td>
                          <span className={`${s.statusBadge} ${dst.payoutStatus === 'paid' ? s.statusPaid : s.statusPending}`}>
                            {dst.payoutStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {(!coop?.surplusAllocations || coop.surplusAllocations.length === 0) && (
            <div className={s.emptyState}>
              <Sparkles className={s.emptyIcon} size={40} />
              <p>{isRw ? 'Nta miterere y’inyungu irabarwa. Kanda hejuru kugira ngo ubare inyungu.' : 'No surplus allocations calculated yet. Click above to run the Member Value Engine.'}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: INVESTMENT GUARDIAN */}
      {activeTab === 'guardian' && (
        <div className={s.guardianCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><ShieldCheck size={20} color="#2463a6" /> {isRw ? 'HURIZA Investment Guardian — Digital Twin' : 'HURIZA Investment Guardian — Financial Digital Twin'}</h2>
              <p className={s.sectionSubtitle}>
                {isRw
                  ? 'Gusesengura ishoramari mbere yo gusohora amafaranga (Payback Period, Reserve Headroom & Risk Verdict)'
                  : 'Explainable financial simulation engine for evaluating machinery, processing facilities, and productive investments'}
              </p>
            </div>
            <button className={s.primaryButton} onClick={() => setShowNewInvestmentModal(true)} disabled={busy}>
              <Plus size={16} /> {isRw ? 'Tanga Umushinga Mushya' : 'Submit Investment Proposal'}
            </button>
          </div>

          {/* Interactive Digital Twin Simulator */}
          <div className={s.simulatorControls}>
            <div className={s.controlGroup}>
              <div className={s.sliderLabel}>
                <span>{isRw ? 'Igiciro cy’Imashini (Capital Cost):' : 'Capital Cost (Asset Price):'}</span>
                <b>{money(simCost)}</b>
              </div>
              <input
                type="range"
                min={500000}
                max={15000000}
                step={250000}
                value={simCost}
                onChange={e => setSimCost(Number(e.target.value))}
                className={s.slider}
              />
            </div>

            <div className={s.controlGroup}>
              <div className={s.sliderLabel}>
                <span>{isRw ? 'Inyungu Zitezwe / Ukwezi (Monthly Benefit):' : 'Expected Monthly Benefit:'}</span>
                <b>{money(simBenefit)}</b>
              </div>
              <input
                type="range"
                min={50000}
                max={2000000}
                step={25000}
                value={simBenefit}
                onChange={e => setSimBenefit(Number(e.target.value))}
                className={s.slider}
              />
            </div>

            <div className={s.controlGroup}>
              <div className={s.sliderLabel}>
                <span>{isRw ? 'Gusana & Gukoresha / Ukwezi (Operating Cost):' : 'Monthly Maintenance & OpEx:'}</span>
                <b>{money(simOpCost)}</b>
              </div>
              <input
                type="range"
                min={10000}
                max={500000}
                step={10000}
                value={simOpCost}
                onChange={e => setSimOpCost(Number(e.target.value))}
                className={s.slider}
              />
            </div>
          </div>

          {/* Digital Twin Simulation Verdict */}
          <div className={`${s.verdictBanner} ${simVerdict === 'sustainable' ? s.verdictSustainable : simVerdict === 'caution' ? s.verdictCaution : s.verdictCritical}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {simVerdict === 'sustainable' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              <div>
                <strong style={{ fontSize: '1.05rem', textTransform: 'uppercase' }}>
                  {isRw ? 'Icyemezo cya Guardian:' : 'Guardian Verdict:'} {simVerdict.replace('_', ' ')}
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                  {isRw
                    ? `Igihe cyo kugarura igishoro: Amezi ${simPaybackMonths} · Amafaranga asigaye: ${money(simRemainingCash)} · Umutekano w’ikigega: ${money(simLiquidityBuffer)}`
                    : `Simple Payback Period: ${simPaybackMonths} months · Remaining Cash: ${money(simRemainingCash)} · Reserve Headroom: ${money(simLiquidityBuffer)}`}
                </p>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', maxWidth: '350px', lineHeight: 1.4 }}>
              {simVerdict === 'sustainable' && (
                <span>
                  {isRw
                    ? 'Ishoramari rifite umutekano. Amafaranga asigaye arenze ikigega kirinzwe n’amategeko (20%) kandi inyungu yishyura igishoro mu gihe gikwiye.'
                    : 'Investment is financially sound. Post-purchase cash satisfies the 20% legal reserve and cash inflows cover costs within expected lifetime.'}
                </span>
              )}
              {simVerdict === 'caution' && (
                <span>
                  {isRw
                    ? 'Iri shoramari rirasaba kwitonda. Igihe cyo kwishyura ni kirekire cyane cyangwa inyungu ya buri kwezi ni nkeya.'
                    : 'Caution: The payback horizon is excessively long relative to equipment depreciation. Review revenue assumptions.'}
                </span>
              )}
              {simVerdict === 'critical_liquidity' && (
                <span>
                  {isRw
                    ? 'Iburira rikomeye: Iri shoramari ryabangamira ikigega kirinzwe cya koperative! Koperative ntiyemerewe gushora amafaranga mu buryo bwishe amategeko.'
                    : 'Critical Warning: Purchasing this asset would breach the cooperative’s mandatory statutory reserve! Funding requires debt or share capital.'}
                </span>
              )}
            </div>
          </div>

          {/* Log of recorded investment proposals */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>{isRw ? 'Imishinga Yanditswe n’Ibyemezo' : 'Recorded Investment Proposals'}</h3>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Umushinga' : 'Proposal Title'}</th>
                  <th>{isRw ? 'Ubwoko' : 'Category'}</th>
                  <th>{isRw ? 'Igiciro' : 'Capital Cost'}</th>
                  <th>{isRw ? 'Inyungu / Kwezi' : 'Monthly Net'}</th>
                  <th>{isRw ? 'Kwishyura (Mezi)' : 'Payback'}</th>
                  <th>{isRw ? 'Icyemezo cya Guardian' : 'Verdict'}</th>
                  <th>{isRw ? 'Imiterere' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {(coop?.investments ?? []).map(inv => (
                  <tr key={inv.id}>
                    <td><b>{inv.title}</b></td>
                    <td><span className={s.categoryBadge}>{inv.category}</span></td>
                    <td><strong>{money(inv.capitalCost)}</strong></td>
                    <td style={{ color: '#15803d' }}>+{money(inv.netMonthlyGain)} / mo</td>
                    <td><b>{inv.paybackMonths} {isRw ? 'mezi' : 'months'}</b></td>
                    <td>
                      <span className={`${s.statusBadge} ${inv.guardianVerdict === 'sustainable' ? s.statusSustainable : inv.guardianVerdict === 'caution' ? s.statusCaution : s.statusCriticalLiquidity}`}>
                        {inv.guardianVerdict}
                      </span>
                    </td>
                    <td><span className={s.statusBadge}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: GOVERNANCE & STAFF */}
      {activeTab === 'governance' && (
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div>
              <h2 className={s.sectionTitle}><Users size={20} color="#2463a6" /> {isRw ? 'Imiyoborere n’Abakozi ba Koperative' : 'Cooperative Governance, Leadership & Staff'}</h2>
              <p className={s.sectionSubtitle}>{isRw ? 'Inama z’ubutegetsi, ibyemezo by’Inteko Rusange n’inshingano z’abayobozi' : 'Board meetings, General Assembly resolutions and staff appointments'}</p>
            </div>
            <button className={s.primaryButton} onClick={() => setShowNewGovernanceEventModal(true)} disabled={busy}>
              <Plus size={16} /> {isRw ? 'Andika Inama / Icyemezo' : 'Record Meeting / Resolution'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {(coop?.staff ?? []).map(st => (
              <div key={st.id} className={s.mveStatBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={s.categoryBadge}>{st.department}</span>
                  <span className={`${s.statusBadge} ${s.statusPaid}`}>{st.status}</span>
                </div>
                <strong style={{ fontSize: '1.05rem', marginTop: '0.25rem' }}>{st.userName ?? st.userId}</strong>
                <span style={{ fontSize: '0.85rem', color: '#2463a6', fontWeight: 600 }}>{st.title}</span>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{isRw ? 'Yatangiye:' : 'Appointed:'} {st.appointedAt}</small>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem 0' }}>{isRw ? 'Inyandikomvugo n’Ibyemezo by’Inteko Rusange' : 'Resolutions & Governance Minutes'}</h3>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{isRw ? 'Itariki' : 'Date'}</th>
                  <th>{isRw ? 'Ubwoko bw’Inama' : 'Event Type'}</th>
                  <th>{isRw ? 'Umutwe' : 'Title'}</th>
                  <th>{isRw ? 'Ibyigwa' : 'Agenda'}</th>
                  <th>{isRw ? 'Ibyemezo byafashwe' : 'Resolutions Passed'}</th>
                </tr>
              </thead>
              <tbody>
                {(coop?.governance ?? []).map(gv => (
                  <tr key={gv.id}>
                    <td>{gv.meetingDate}</td>
                    <td><span className={s.categoryBadge}>{gv.eventType.replace('_', ' ')}</span></td>
                    <td><b>{gv.title}</b></td>
                    <td style={{ fontSize: '0.825rem', color: '#334155' }}>{gv.agenda}</td>
                    <td style={{ fontSize: '0.825rem', color: '#15803d', fontWeight: 600 }}>{gv.resolutions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Subscribe Shares Modal */}
      {showSubscribeSharesModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Iyandikisheho Imigabane' : 'Subscribe for Cooperative Shares'}</h3>
              <button className={s.modalClose} onClick={() => setShowSubscribeSharesModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Umubare w’imigabane ushaka kwandikwaho:' : 'Number of shares to subscribe:'}</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={shareCount}
                  onChange={e => setShareCount(Math.max(1, Number(e.target.value)))}
                  className={s.textInput}
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {isRw ? 'Agaciro k’umugabane umwe:' : 'Price per share:'} <b>{money(profile?.nominalShareValue ?? 10000)}</b><br />
                {isRw ? 'Amafaranga yose azishyurwa:' : 'Total subscription value:'} <b style={{ color: '#2463a6' }}>{money(shareCount * (profile?.nominalShareValue ?? 10000))}</b>
              </p>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowSubscribeSharesModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleSubscribeShares} disabled={busy}>
                {isRw ? 'Emeza Kwiyandikisha' : 'Confirm Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Pay Shares Modal */}
      {showPaySharesModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Ishyura Imigabane Yanditswe (MoMo)' : 'Pay Subscribed Shares via MoMo'}</h3>
              <button className={s.modalClose} onClick={() => setShowPaySharesModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Umubare w’imigabane wishyuye:' : 'Number of subscribed shares to pay:'}</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={shareCount}
                  onChange={e => setShareCount(Math.max(1, Number(e.target.value)))}
                  className={s.textInput}
                />
              </div>
              <div className={s.mveFormulaExplanation}>
                {isRw
                  ? 'Icyitonderwa: Kwishyura imigabane gusa ni byo byongera amafaranga ya koperative mu gitabo cy’imari. Kwiyandikisha gusa ntibihindura konti ya koperative.'
                  : 'Important: Only confirmed share payment updates available cooperative cash in the ledger. Subscription records member commitment.'}
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowPaySharesModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handlePayShares} disabled={busy}>
                {isRw ? 'Ishyura na MoMo (*182#)' : 'Pay via MoMo (*182#)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Record Delivery Modal */}
      {showRecordDeliveryModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Yakira Umusaruro w’Umunyamuryango' : 'Intake Member Produce Delivery'}</h3>
              <button className={s.modalClose} onClick={() => setShowRecordDeliveryModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ubwoko bw’igihingwa:' : 'Produce Name:'}</label>
                <input type="text" value={deliveryProduct} onChange={e => setDeliveryProduct(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ingano (Quantity):' : 'Quantity (kg):'}</label>
                <input type="number" min={1} value={deliveryQty} onChange={e => setDeliveryQty(Number(e.target.value))} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Igiciro fatizo kuri kg (RWF):' : 'Price per kg (RWF):'}</label>
                <input type="number" min={1} value={deliveryPrice} onChange={e => setDeliveryPrice(Number(e.target.value))} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ubuziranenge (Grade):' : 'Quality Grade:'}</label>
                <select value={deliveryGrade} onChange={e => setDeliveryGrade(e.target.value)} className={s.selectInput}>
                  <option value="Grade A">Grade A (High Quality)</option>
                  <option value="Grade B">Grade B (Standard Quality)</option>
                  <option value="Standard">Standard</option>
                </select>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {isRw ? 'Amafaranga yose azishyurwa umunyamuryango:' : 'Total member intake amount:'} <b style={{ color: '#2463a6' }}>{money(deliveryQty * deliveryPrice)}</b>
              </p>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowRecordDeliveryModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleRecordDelivery} disabled={busy}>
                {isRw ? 'Andika Umusaruro' : 'Record Intake'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Record Commercial Sale Modal */}
      {showRecordSaleModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Andika Igurisha ku Masoko' : 'Record Commercial Sale'}</h3>
              <button className={s.modalClose} onClick={() => setShowRecordSaleModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Izina ry’Umuguzi / Uruganda:' : 'Buyer / Processing Factory:'}</label>
                <input type="text" value={saleBuyer} onChange={e => setSaleBuyer(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Igicuruzwa:' : 'Product Name:'}</label>
                <input type="text" value={saleProduct} onChange={e => setSaleProduct(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ingano yagurishijwe (kg):' : 'Quantity Sold (kg):'}</label>
                <input type="number" min={1} value={saleQty} onChange={e => setSaleQty(Number(e.target.value))} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Igiciro kuri kg (RWF):' : 'Selling Price / kg (RWF):'}</label>
                <input type="number" min={1} value={salePrice} onChange={e => setSalePrice(Number(e.target.value))} className={s.textInput} />
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {isRw ? 'Amafaranga yose azinjira muri koperative:' : 'Total sales revenue collected:'} <b style={{ color: '#15803d' }}>+{money(saleQty * salePrice)}</b>
              </p>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowRecordSaleModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleRecordSale} disabled={busy}>
                {isRw ? 'Emeza Igurisha' : 'Record Sale & Collect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Record Expense Modal */}
      {showRecordExpenseModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Andika Amafaranga Asosotse' : 'Record Operating Expense'}</h3>
              <button className={s.modalClose} onClick={() => setShowRecordExpenseModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ibisobanuro by’ikiguzi:' : 'Expense Title:'}</label>
                <input type="text" placeholder="e.g. Grain storage bags & transport" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Amafaranga (RWF):' : 'Amount (RWF):'}</label>
                <input type="number" min={1} value={expenseAmount} onChange={e => setExpenseAmount(Number(e.target.value))} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Icyiciro:' : 'Category:'}</label>
                <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className={s.selectInput}>
                  <option value="Operational">Operational Expenses</option>
                  <option value="Transport">Transport & Logistics</option>
                  <option value="Packaging">Bags & Packaging</option>
                  <option value="Maintenance">Equipment Maintenance</option>
                  <option value="Administration">Office & Administration</option>
                </select>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowRecordExpenseModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleRecordExpense} disabled={busy}>
                {isRw ? 'Andika Ikiguzi' : 'Log Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Surplus Calculation Modal */}
      {showSurplusCalcModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Bara Inyungu z’Igihembwe' : 'Run Member Value Surplus Allocation'}</h3>
              <button className={s.modalClose} onClick={() => setShowSurplusCalcModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Izina ry’igihembwe cy’ubuhinzi:' : 'Fiscal / Season Period Label:'}</label>
                <input type="text" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.mveFormulaExplanation}>
                {isRw
                  ? 'Icyiciro cya 1: Kubara inyungu rusange muri sisitemu. Iki gikorwa gikora imbonerahamwe y’inyungu z’umunyamuryango wese bitewe n’imigabane n’umusaruro yatangiye igihembwe.'
                  : 'Stage 1: System surplus reconciliation. The engine calculates verified net surplus, applies reserve policies, and prepares proposed member dividend and bonus allotments.'}
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowSurplusCalcModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleCalculateSurplus} disabled={busy}>
                {isRw ? 'Bara Umutungo' : 'Calculate Allocations'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Approve Surplus Modal */}
      {showApproveSurplusModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Emeza Inyungu nka General Assembly' : 'Approve Distribution (General Assembly)'}</h3>
              <button className={s.modalClose} onClick={() => setShowApproveSurplusModal(null)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Nomero y’Icyemezo cy’Inteko Rusange:' : 'General Assembly Resolution Reference:'}</label>
                <input type="text" value={resolutionRef} onChange={e => setResolutionRef(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.mveFormulaExplanation}>
                {isRw
                  ? 'Amategeko y’u Rwanda asaba ko inyungu zigabanywa nyuma y’uko Inteko Rusange y’abanyamuryango yemeje raporo y’ibaruramari n’imbonerahamwe yo kugabana.'
                  : 'Rwandan cooperative law requires formal General Assembly resolution approval before any surplus distribution or dividend payout can be initiated.'}
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowApproveSurplusModal(null)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={() => handleApproveSurplus(showApproveSurplusModal)} disabled={busy}>
                {isRw ? 'Emeza Icyemezo' : 'Record Formal Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. New Investment Modal */}
      {showNewInvestmentModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Tanga Umushinga Mushya w’Ishoramari' : 'Submit Investment Proposal for Guardian Appraisal'}</h3>
              <button className={s.modalClose} onClick={() => setShowNewInvestmentModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Izina ry’imashini / umushinga:' : 'Asset / Facility Title:'}</label>
                <input type="text" value={invTitle} onChange={e => setInvTitle(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Igiciro cyo kugura (RWF):' : 'Capital Cost (RWF):'}</label>
                <input type="number" min={10000} value={invCost} onChange={e => setInvCost(Number(e.target.value))} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Inyungu zitezwe buri kwezi (RWF):' : 'Expected Monthly Cash Benefit (RWF):'}</label>
                <input type="number" min={0} value={invBenefit} onChange={e => setInvBenefit(Number(e.target.value))} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Amafaranga yo gukoresha buri kwezi (RWF):' : 'Monthly Maintenance Cost (RWF):'}</label>
                <input type="number" min={0} value={invOpCost} onChange={e => setInvOpCost(Number(e.target.value))} className={s.textInput} />
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowNewInvestmentModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleSimulateInvestment} disabled={busy}>
                {isRw ? 'Suzuma na Guardian' : 'Run Guardian Evaluation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Governance Event Modal */}
      {showNewGovernanceEventModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>{isRw ? 'Andika Inama cyangwa Icyemezo' : 'Record Governance Meeting & Resolution'}</h3>
              <button className={s.modalClose} onClick={() => setShowNewGovernanceEventModal(false)}><X size={18} /></button>
            </div>
            <div className={s.modalBody}>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ubwoko bw’inama:' : 'Meeting Type:'}</label>
                <select value={govType} onChange={e => setGovType(e.target.value as typeof govType)} className={s.selectInput}>
                  <option value="board_meeting">Board Meeting (Inama y'Ubuyobozi)</option>
                  <option value="general_assembly">General Assembly (Inteko Rusange)</option>
                  <option value="supervisory_audit">Supervisory Committee Audit (Komite Ngenzuzi)</option>
                </select>
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Umutwe w’inama:' : 'Meeting Title:'}</label>
                <input type="text" value={govTitle} onChange={e => setGovTitle(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ibyigwa (Agenda):' : 'Agenda:'}</label>
                <input type="text" value={govAgenda} onChange={e => setGovAgenda(e.target.value)} className={s.textInput} />
              </div>
              <div className={s.inputGroup}>
                <label className={s.inputLabel}>{isRw ? 'Ibyemezo byafashwe (Resolutions):' : 'Resolutions Passed:'}</label>
                <input type="text" value={govResolutions} onChange={e => setGovResolutions(e.target.value)} className={s.textInput} />
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.cancelBtn} onClick={() => setShowNewGovernanceEventModal(false)}>{isRw ? 'Reka' : 'Cancel'}</button>
              <button className={s.submitBtn} onClick={handleRecordGovernance} disabled={busy}>
                {isRw ? 'Andika Icyemezo' : 'Save Meeting Minutes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddMemberModal && (
        <div className={s.modalOverlay} role="presentation">
          <form className={s.modalContent} role="dialog" aria-modal="true" aria-labelledby="add-coop-member-title" onSubmit={event => { event.preventDefault(); void handleAddMember(); }}>
            <div className={s.modalHeader}><h3 id="add-coop-member-title" className={s.modalTitle}>{isRw ? 'Ongeraho umunyamuryango' : 'Add a member'}</h3><button type="button" className={s.modalClose} onClick={() => { setShowAddMemberModal(false); setMemberPin(''); }} aria-label={isRw ? 'Funga' : 'Close'}><X size={18} /></button></div>
            <div className={s.modalBody}>
              <p className={s.sectionSubtitle}>{isRw ? 'Konti nshya izafungurwa ikoresheje telefoni na PIN.' : 'A new member account will be created with this phone number and PIN.'}</p>
              <div className={s.inputGroup}><label className={s.inputLabel} htmlFor="member-name">{isRw ? 'Amazina' : 'Full name'}</label><input id="member-name" autoFocus autoComplete="name" required minLength={2} maxLength={100} value={memberName} onChange={event => setMemberName(event.target.value)} className={s.textInput} /></div>
              <div className={s.inputGroup}><label className={s.inputLabel} htmlFor="member-phone">{isRw ? 'Telefoni yo mu Rwanda' : 'Rwanda phone number'}</label><input id="member-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="078…" required value={memberPhone} onChange={event => setMemberPhone(event.target.value)} className={s.textInput} /></div>
              <div className={s.inputGroup}><label className={s.inputLabel} htmlFor="member-pin">PIN (4–8 {isRw ? 'imibare' : 'digits'})</label><input id="member-pin" type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={8} pattern="[0-9]{4,8}" required value={memberPin} onChange={event => setMemberPin(event.target.value.replace(/\D/g, '').slice(0, 8))} className={s.textInput} /></div>
              {!isOnline && <p className={s.disclosure} role="status">{isRw ? 'Ongera ubone interineti kugira ngo wongere umunyamuryango.' : 'Connect to the internet to add a member.'}</p>}
            </div>
            <div className={s.modalFooter}><button type="button" className={s.cancelBtn} onClick={() => { setShowAddMemberModal(false); setMemberPin(''); }}>{isRw ? 'Reka' : 'Cancel'}</button><button type="submit" className={s.submitBtn} disabled={busy || !isOnline || memberPin.length < 4}>{isRw ? 'Bika umunyamuryango' : 'Create member'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
