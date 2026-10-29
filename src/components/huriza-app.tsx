'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import styles from './workspace-access.module.css';
import SavingsGroupsSetup from './savings-groups-setup';
import SavingsGroupOperations from './savings-group-operations';
import OrganizationSheetStatus from './organization-sheet-status';
import PersonalSheetDestination from './personal-sheet-destination';
import LanguageToggle from './language-toggle';
import PersonalFinanceDashboard from './personal-finance-dashboard';
import SavingsGroupDashboard from './savings-group-dashboard';
import CooperativeDashboard from './cooperative-dashboard';
import CooperativeSetup, { type CooperativeDraft } from './cooperative-setup';
import FundraisingDashboard from './fundraising-dashboard';
import { NgoImpactDashboard } from './ngo-impact-dashboard';
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, Check, ChevronDown, CircleHelp, Coins, Download, HandCoins, HeartHandshake, Home, Landmark, Leaf, LogOut, Menu, Plus, RefreshCw, ShieldCheck, Sparkles, Users, Wallet, X } from 'lucide-react';
import type { FinanceState, Role } from '@/lib/contracts';
import { calculateScenario, scenarioPreset } from '@/lib/guardian';
import { BRAND } from '@/lib/brand';
import { useLanguage } from '@/lib/i18n/context';

type Workspace = 'personal'|'groups'|'fundraising'|'cooperative'|'impact'|'guardian'|'simulator'|'connect';
type Goal = {id:string;name:string;target:number;saved:number;deadline:string};
type Membership = {orgId:string;role:Role};
type Account = {id:string;name:string;email:string;role:Role;tenantId:string;workspaces:Workspace[];homeWorkspace:Workspace;organizationName:string|null;memberships:Membership[];emailVerified:boolean;isTestAccount:boolean};
type State = FinanceState & {user:Account;goals:Goal[];interventions:{id:string;title:string}[];notifications:{id:string;message:string}[]};

const rawSections: {id:Workspace; icon:typeof Home; groupKey:'finances'|'organization'|'tools'}[] = [
  {id:'personal', icon:Wallet, groupKey:'finances'},
  {id:'groups', icon:Users, groupKey:'finances'},
  {id:'fundraising', icon:HeartHandshake, groupKey:'organization'},
  {id:'cooperative', icon:Landmark, groupKey:'organization'},
  {id:'impact', icon:Activity, groupKey:'organization'},
  {id:'guardian', icon:ShieldCheck, groupKey:'tools'},
  {id:'simulator', icon:Sparkles, groupKey:'tools'},
  {id:'connect', icon:BriefcaseBusiness, groupKey:'tools'},
];

const pct=(a:number,b:number)=>b?Math.min(100,Math.round(a/b*100)):0;

export default function HurizaApp({workspace}:{workspace:string}) {
  const { t, isKinyarwanda } = useLanguage();
  const money = useCallback((n:number)=>`${Math.round(n||0).toLocaleString(isKinyarwanda?'rw-RW':'en-US')} ${t.common.rwf}`, [isKinyarwanda, t.common.rwf]);

  const sections = useMemo(() => rawSections.map(s => ({
    ...s,
    label: t.workspace.sections[s.id],
    group: t.workspace.groups[s.groupKey],
  })), [t]);

  const roleLabel: Record<Role, string> = useMemo(() => ({
    member: t.workspace.roles.member,
    president: t.workspace.roles.president,
    treasurer: t.workspace.roles.treasurer,
    accountant: t.workspace.roles.accountant,
    secretary: t.workspace.roles.secretary,
    cooperative: t.workspace.roles.cooperative,
    ngo: t.workspace.roles.ngo,
  }), [t]);

  const active=(rawSections.some(s=>s.id===workspace)?workspace:'personal') as Workspace;
  const [data,setData]=useState<State|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[forbidden,setForbidden]=useState(false),[success,setSuccess]=useState(''),[mobileOpen,setMobileOpen]=useState(false),[showNotifications,setShowNotifications]=useState(false),[selectedGroup,setSelectedGroup]=useState('');

  useEffect(()=>{
    if(!mobileOpen)return;
    const previous=document.activeElement as HTMLElement|null;
    const navigation=document.getElementById('workspace-navigation');
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    navigation?.querySelector<HTMLElement>('button,a')?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setMobileOpen(false);return;}
      if(event.key!=='Tab'||!navigation)return;
      const targets=Array.from(navigation.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select'));
      const first=targets[0],last=targets[targets.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handleKey);
    return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',handleKey);previous?.focus();};
  },[mobileOpen]);

  useEffect(()=>{if(active==='groups'){const requested=new URLSearchParams(window.location.search).get('orgId');const first=data?.user.memberships.find(m=>m.orgId.startsWith('group-'))?.orgId;if(requested)setSelectedGroup(requested);else if(!selectedGroup&&first)setSelectedGroup(first)}},[active,data,selectedGroup]);

  const refresh=useCallback(async()=>{setLoading(true);setError('');setForbidden(false);try{const qs=new URLSearchParams({workspace:active});if(active==='groups'&&selectedGroup)qs.set('orgId',selectedGroup);const r=await fetch(`/api/state?${qs}`,{cache:'no-store'});const j=await r.json();if(r.status===401){setData(null);return}if(r.status===403){setData(null);setForbidden(true);return}if(!r.ok)throw new Error(j.error||(isKinyarwanda?'Ntibyakunze gufungura umwanya wawe.':'Could not load your workspace.'));setData(j)}catch(e){setError(e instanceof Error?e.message:(isKinyarwanda?'Ntibyakunze gufungura umwanya wawe.':'Could not load your workspace.'))}finally{setLoading(false)}},[active,selectedGroup,isKinyarwanda]);

  useEffect(()=>{void refresh()},[refresh]);

  const act=async(payload:Record<string,unknown>)=>{setBusy(true);setError('');setSuccess('');try{const scoped=active==='groups'&&selectedGroup&&!('orgId'in payload)?{...payload,orgId:selectedGroup}:payload;const r=await fetch('/api/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(scoped)});const j=await r.json();if(!r.ok)throw new Error(j.error||(isKinyarwanda?'Icyo gikorwa nticyakunze.':'That action could not be completed.'));setSuccess(typeof j.message==='string'?j.message:(isKinyarwanda?'Byabitswe. Umwanya wawe wavuguruwe.':'Saved. Your workspace is up to date.'));await refresh();return true}catch(e){setError(e instanceof Error?e.message:(isKinyarwanda?'Icyo gikorwa nticyakunze.':'That action could not be completed.'));return false}finally{setBusy(false)}};

  const visibleSections=data?sections.filter(s=>data.user.workspaces.includes(s.id)):[sections[0]];
  const groups=useMemo(()=>[...new Set(visibleSections.map(s=>s.group))],[visibleSections]);
  const nav=<>{groups.map(g=><div className="nav-group" key={g}><div className="nav-label">{g}</div>{visibleSections.filter(s=>s.group===g).map(s=><Link key={s.id} href={`/app/${s.id}`} onClick={()=>setMobileOpen(false)} className={`nav-link ${active===s.id?'selected':''}`}><s.icon size={18}/><span>{s.label}</span>{active===s.id&&<span className="nav-dot"/>}</Link>)}</div>)}</>;

  const signOut=async()=>{setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'DELETE',headers:{'content-type':'application/json'},body:'{}'});if(!response.ok)throw new Error(isKinyarwanda?'Ntibyakunze gusohoka. Ongera ugerageze.':'Could not sign out. Please try again.');const {firebaseAuth}=await import('@/lib/firebase-client');const {signOut:firebaseSignOut}=await import('firebase/auth');try{await firebaseSignOut(firebaseAuth())}catch{}window.location.assign('/login')}catch(err){setError(err instanceof Error?err.message:(isKinyarwanda?'Ntibyakunze gusohoka. Ongera ugerageze.':'Could not sign out. Please try again.'))}finally{setBusy(false)}};

  return <div className="app-frame"><a href="#workspace-content" className="skip-link">{t.common.skipToContent}</a>
    <aside id="workspace-navigation" aria-label="Workspace navigation" role={mobileOpen?'dialog':undefined} aria-modal={mobileOpen?true:undefined} className={`sidebar ${mobileOpen?'open':''}`}>
      <button className="icon-button sidebar-close" aria-label={t.common.close} onClick={()=>setMobileOpen(false)}><X size={18}/></button>
      <Link href="/" className="brand-lockup"><span className="brand-mark"><Leaf size={21}/></span><span>{BRAND.name.toLowerCase()}<small>{isKinyarwanda ? 'UMWANYA W’IMARI' : 'HURIZA WORKSPACE'}</small></span></Link>
      {data&&<div className="org-switch"><span className="org-emblem">{data.user.organizationName?.[0]||'P'}</span><span className="org-copy"><b>{data.user.organizationName||t.workspace.titles.personal.title}</b><small>{data.user.organizationName?(isKinyarwanda?'Umwanya w’itsinda':'Organization workspace'):(isKinyarwanda?'Umwanya bwite':'Your private workspace')}</small></span></div>}
      {visibleSections.length > 1 && <label className="workspace-switch"><span>{t.workspace.switchWorkspace}</span><select aria-label="Switch authorized workspace" value={active} onChange={event=>window.location.assign(`/app/${event.target.value}`)}>{visibleSections.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      <nav aria-label="Authorized workspaces">{nav}{(!data || data.user.workspaces.length > 1) && <div className="nav-group"><div className="nav-label">{t.workspace.groups.getStarted}</div><Link className="nav-link" href="/app/groups/start"><Users size={18}/><span>{isKinyarwanda ? 'Tangiza itsinda ryo kuzigama' : 'Create or join a group'}</span></Link><Link className="nav-link" href="/app/onboarding"><Landmark size={18}/><span>{isKinyarwanda ? 'Gahunda y’umuryango' : 'Organization setup'}</span></Link></div>}</nav>
      <div className="sidebar-bottom">
        {data&&visibleSections.some(s=>s.id==='guardian')&&<div className="sidebar-help"><CircleHelp size={18}/><span><b>{t.common.needHelp}</b><small>{t.common.visitGuide}</small></span><Link href="/app/guardian" aria-label="Money guide"><ArrowRight size={16}/></Link></div>}
        {data&&<div className="profile-row"><span className="avatar">{data.user.name?.[0]||'H'}</span><span className="profile-copy"><b>{data.user.name}</b><small className={styles.roleBadge}>{roleLabel[active==='groups'?data.savingsGroup?.memberRole||data.user.role:active==='cooperative'?(data.user.memberships.find(m=>m.orgId.startsWith('coop-'))?.role||data.user.role):data.user.role]}</small></span><button className="icon-button" title={t.common.signOut} aria-label={t.common.signOut} onClick={()=>void signOut()}><LogOut size={16}/></button></div>}
      </div>
    </aside>
    {mobileOpen&&<button className="mobile-shade" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}><Menu size={20}/></button>
        <div className="crumb">{isKinyarwanda ? 'Umwanya' : 'Workspace'} <span>/</span> <b>{sections.find(s=>s.id===active)?.label}</b></div>
        <div className="top-actions">
          <LanguageToggle compact />
          <span className="demo-pill"><i/><span className="demo-long">{t.workspace.simulatedRecords}</span><span className="demo-short">{isKinyarwanda ? 'IGERAGEZA' : 'SIMULATED'}</span></span>
          {data&&<button className="icon-button notification-button" aria-label={t.common.notifications} onClick={()=>setShowNotifications(v=>!v)}><Bell size={18}/>{(data.notifications?.length||0)>0&&<i/>}</button>}
        </div>
        {showNotifications&&<div className="notification-popover"><b>{t.common.notifications}</b>{data?.notifications.length?data.notifications.map(n=><p key={n.id}>{n.message}</p>):<p>{t.common.noNotifications}</p>}<button onClick={()=>setShowNotifications(false)}>{t.common.close}</button></div>}
      </header>
      <div className="content-wrap" id="workspace-content" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <div className="eyebrow">{active==='impact'?(isKinyarwanda?'RAPORO N’IBIPIMO':'EVIDENCE & INSIGHT'):(isKinyarwanda?'UMWANYA WA HURIZA':'YOUR HURIZA WORKSPACE')}</div>
            <h1>{t.workspace.titles[active].title}</h1>
            <p>{t.workspace.titles[active].sub}</p>
          </div>
          <button className="button button-quiet refresh" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> {t.common.refresh}</button>
        </div>
        {active==='personal'&&data?.user.workspaces.includes('groups')&&<div className="notice success-notice"><Users size={17}/><span>{isKinyarwanda ? 'Uri mu itsinda ryo kuzigama? Tangiza iryawe cyangwa winjiremo.' : 'In a savings group? Create one or join with an invitation.'}</span><Link href="/app/groups/start">{isKinyarwanda ? 'Amatsinda yo kuzigama' : 'Savings groups'} <ArrowRight size={15}/></Link></div>}
        {data&&['cooperative','fundraising','impact'].includes(active)&&<OrganizationSheetStatus organizationId={active==='cooperative'?(data.cooperativeState?.profile.orgId||'coop-imena'):active==='fundraising'?'fund-school':'ngo-imizi'}/>}
        {error&&<div className="notice error-notice" role="alert"><X size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label={t.common.dismiss}><X size={15}/></button></div>}
        {success&&<div className="notice success-notice"><Check size={17}/>{success}<button onClick={()=>setSuccess('')} aria-label={t.common.dismiss}><X size={15}/></button></div>}
        {loading ? (
          <div className="loading-card"><span className="spinner"/> {t.common.loading}</div>
        ) : forbidden ? (
          <AccessMessage href="/app/personal" title={isKinyarwanda ? 'Uyu mwanya ntuboneka kuri konti yawe.' : 'This workspace is not available to your account.'} body={isKinyarwanda ? 'Koresha umwanya wawe bwite cyangwa usabe uburenganzira umuyobozi w’itsinda.' : 'Use your personal workspace or ask your organization administrator for access.'} buttonText={isKinyarwanda ? 'Jya ku mwanya wawe' : 'Go to your workspace'}/>
        ) : !data ? (
          <div className="signin-card"><div className="signin-icon"><ShieldCheck size={22}/></div><h2>{t.common.signIn}</h2><p>{isKinyarwanda ? 'Konti yawe icunga umwirondoro wayo n’imyanya yemerewe.' : 'Your account keeps its own identity and authorized workspaces.'}</p><Link className="button button-primary" href={`/login?next=${encodeURIComponent(`/app/${active}`)}`}>{t.common.continue} <ArrowRight size={16}/></Link></div>
        ) : (
          <>
            {active==='groups'&&data.user.memberships.filter(m=>m.orgId.startsWith('group-')).length>1&&(
              <label className="group-selector">{isKinyarwanda ? 'Itsinda ryo kuzigama' : 'Savings group'}<select value={selectedGroup} onChange={e=>{setSelectedGroup(e.target.value);const u=new URL(window.location.href);u.searchParams.set('orgId',e.target.value);window.history.replaceState({},'',u)}}>{data.user.memberships.filter(m=>m.orgId.startsWith('group-')).map(m=><option key={m.orgId} value={m.orgId}>{m.orgId}</option>)}</select></label>
            )}
            {active !== 'personal' && active !== 'cooperative' && (
              <Overview data={data} workspace={active} money={money} isRw={isKinyarwanda}/>
            )}
            <WorkspaceView active={active} data={data} role={active==='groups'?data.savingsGroup?.memberRole||data.user.role:active==='cooperative'?(data.user.memberships.find(m=>m.orgId.startsWith('coop-'))?.role||data.user.role):data.user.role} act={act} busy={busy} money={money} isRw={isKinyarwanda}/>
          </>
        )}
        <footer className="app-footer"><span>{BRAND.name} · {t.common.brandTagline}</span><span>{t.common.demoDisclosure}</span></footer>
      </div>
    </main>
  </div>;
}

function AccessMessage({href,title,body,buttonText}:{href:string;title:string;body:string;buttonText:string}){return <div className="signin-card access-card"><div className="signin-icon"><ShieldCheck size={22}/></div><h2>{title}</h2><p>{body}</p><Link className="button button-primary" href={href}>{buttonText} <ArrowRight size={16}/></Link></div>}

function Overview({data:d,workspace,money,isRw}:{data:State;workspace:Workspace;money:(n:number)=>string;isRw:boolean}){
  const role=workspace==='groups'?d.savingsGroup?.memberRole||d.user.role:d.user.role;
  const inGroup=d.user.memberships.some(m=>m.orgId.startsWith('group-')&&m.role===role);
  const personalOnly=role==='member'&&!inGroup;
  const kpis=workspace==='personal'?[
    [isRw?'Intego bwite':'Personal goals',String(d.goals.length),isRw?'Gahunda zawe zo kuzigama':'Your own savings plans'],
    [isRw?'Ubwizigame bwanditswe':'Recorded personal savings',money(Number(d.goals.reduce((total,g)=>total+BigInt(g.saved),0n))),isRw?'Bitandukanye n’iby’itsinda':'Separate from group-held funds'],
    [isRw?'Inguzanyo ufite':'Your loan principal',money(d.member.outstanding),isRw?'Inshingano zawe zanditswe':'Your own recorded obligations']
  ]:personalOnly?[]:role==='member'?[
    [isRw?'Urugero rw’inguzanyo rushoboka':'Savings-based loan cap',money(d.member.loanLimit),isRw?'Icyemezo cya nyuma kireba amafaranga ahari':'Final decision checks liquidity and obligations'],
    [isRw?'Ubwizigame bwemewe':'Eligible group savings',money(d.member.eligibleSavings),isRw?'Biri mu itsinda; ntibyakurwamo ako kanya':'Group-held; not personal withdrawals'],
    [isRw?'Inguzanyo isigaye':'Loan balance',money(d.member.outstanding),isRw?'Amafaranga asigaye kwishyurwa':'Outstanding amount']
  ]:role==='cooperative'?[
    [isRw?'Amafaranga ya koperative':'Cooperative cash',money(d.cooperative.cash),isRw?'Amafaranga ahari yo gukoresha':'Available cooperative funds'],
    [isRw?'Imigabane':'Share capital',money(d.cooperative.shareCapital),isRw?'Imigabane y’abanyamuryango yanditswe':'Member capital recorded'],
    [isRw?'Umutungo ufatika':'Assets',money(d.cooperative.assets.reduce((n,a)=>n+a.value,0)),isRw?'Umutungo wa koperative wanditswe':'Recorded cooperative assets']
  ]:role==='ngo'?[
    [isRw?'Amatsinda agaragazwa':'Groups represented',String(d.impact.groups),isRw?'Ibyitegererezo rusange':'Aggregate demo view'],
    [isRw?'Abanyamuryango bose':'Members represented',String(d.impact.members),isRw?'Ibyitegererezo rusange':'Aggregate demo view'],
    [isRw?'Raporo zujujwe':'Reporting completeness',`${d.impact.reportingCompleteness}%`,isRw?'Igipimo cy’icyitegererezo':'Synthetic reporting indicator']
  ]:[
    [isRw?'Amafaranga y’itsinda':'Group cash',money(d.treasury.cash),isRw?'Amafaranga ahari mu itsinda':'Available group funds'],
    [isRw?'Yiteguye kugurizwa':'Ready to lend',money(d.treasury.lendingCapacity),isRw?'Nyuma yo gushyira mu kigega':'After reserve allocation'],
    [isRw?'Inguzanyo ziri hanze':'Loans outstanding',money(d.treasury.outstandingLoans),isRw?'Mu nguzanyo zose zikora':'Across active loans']
  ];

  return <section className="overview-grid">
    <div className="welcome-card">
      <div className="welcome-orbit orbit-one"/>
      <div className="welcome-orbit orbit-two"/>
      <div className="welcome-content">
        <div className="welcome-tag"><Sparkles size={14}/> {isRw ? 'ISHUSHO Y’IMARI YAWE' : 'YOUR FINANCIAL SNAPSHOT'}</div>
        <div className="welcome-name">{isRw ? 'Muraho' : 'Hello'}, {d.user.name.split(' ')[0]} <span>✦</span></div>
        <p>{isRw ? 'Intambwe ikurikira yoroha iyo ubona ishusho yose.' : 'Your next step is easier when you can see the whole picture.'}</p>
        <div className="welcome-foot">
          <span><i/> {isRw ? 'Inyandiko ni iz’icyitegererezo' : 'Financial records are simulated'}</span>
          {d.user.workspaces.includes('guardian')&&<Link href="/app/guardian">{isRw ? 'Sura umuyobozi w’imari' : 'Explore money guide'} <ArrowRight size={14}/></Link>}
        </div>
      </div>
    </div>
    {kpis.map(([name,value,note],i)=><div className="metric-card" key={name}><div className="metric-top"><span>{name}</span><span className={`metric-icon mi-${i}`}><Wallet size={17}/></span></div><strong className="money-value">{value}</strong><small>{note}</small></div>)}
  </section>;
}

function WorkspaceView({active,data:d,role,act,busy,money,isRw}:{active:Workspace;data:State;role:Role;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}){
  switch(active){
    case'personal':return <Personal d={d} act={act} busy={busy} money={money} isRw={isRw}/>;
    case'groups':return <Groups d={d} role={role} act={act} busy={busy} money={money} isRw={isRw}/>;
    case'fundraising':return <Fundraising d={d} role={role} act={act} busy={busy} money={money} isRw={isRw}/>;
    case'cooperative':return <Coop d={d} role={role} act={act} busy={busy} money={money} isRw={isRw}/>;
    case'impact':return <Impact d={d} act={act} busy={busy} money={money} isRw={isRw}/>;
    case'guardian':return <Guardian d={d} money={money} isRw={isRw}/>;
    case'simulator':return <Simulator d={d} money={money} isRw={isRw}/>;
    case'connect':return <Connect d={d} act={act} busy={busy} money={money} isRw={isRw}/>;
  }
}

function Card({title,sub,children,action}:{title:string;sub?:string;children:ReactNode;action?:ReactNode}){return <section className="card"><div className="card-head"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>{children}</section>}

function Personal({d,act,busy,money,isRw}:{d:State;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}) {
  return <PersonalFinanceDashboard d={d} act={act} busy={busy} money={money} isRw={isRw} />;
}

function Form({fields,onSubmit,busy,submit='Save',initial,isRw=false}:{fields:string[][];onSubmit:(v:Record<string,string>)=>void;busy:boolean;submit?:string;initial?:Record<string,string>;isRw?:boolean}){
  const f=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const fd=new FormData(e.currentTarget);const v:Object=Object.fromEntries([...fd.entries()].map(([k,val])=>[k,String(val)]));onSubmit(v as Record<string,string>)};
  const options:Record<string,{value:string;label:string}[]>={
    kind: isRw ? [{value:'revenue',label:'Umusaruro / Amafaranga yinjiye'},{value:'expense',label:'Amasoko / Amafaranga yasohotse'},{value:'capital',label:'Imigabane'}] : [{value:'revenue',label:'Revenue'},{value:'expense',label:'Expense'},{value:'capital',label:'Share capital'}]
  };
  const outcomeOptions = isRw ? [{value:'success',label:'Byagenze neza'},{value:'pending',label:'Biracyatunganywa'},{value:'failed',label:'Byanze'},{value:'unknown',label:'Ntibiramenyekana'}] : [{value:'success',label:'Success'},{value:'pending',label:'Pending'},{value:'failed',label:'Failed'},{value:'unknown',label:'Unknown'}];

  return <form className="action-form" onSubmit={f}>
    {fields.map(([name,label,type,placeholder])=><label key={name}>{label}{type==='select'?<select name={name} defaultValue={placeholder}>{(options[name]||outcomeOptions).map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select>:<input required name={name} type={type} min={type==='number'?1:undefined} placeholder={placeholder} defaultValue={initial?.[name]} />}</label>)}
    <button className="button button-primary" disabled={busy}>{busy?(isRw?'Biratunganywa…':'Working…'):submit}<ArrowRight size={15}/></button>
  </form>;
}

function Transactions({d,money,isRw}:{d:State;money:(n:number)=>string;isRw:boolean}){
  return <Card title={isRw ? 'Ibikorwa biheruka' : 'Recent activity'} sub={isRw ? 'Ibikorwa byawe byaherutse kwandikwa.' : 'Your latest recorded activity.'}>
    <div className="activity-list">
      {d.contributions.slice(0,4).map(c=><div className="activity-row" key={c.id}><span className="activity-icon"><ArrowDownLeft size={17}/></span><span><b>{isRw ? 'Umusanzu w’itsinda' : 'Group contribution'}</b><small>{c.date} · {c.status}</small></span><strong>+{money(c.amount)}</strong></div>)}
      {d.contributions.length===0&&<div className="empty-state">{isRw ? 'Ibikorwa bizagaragara hano nibimara kwandikwa.' : 'Activity will appear here when recorded.'}</div>}
    </div>
  </Card>;
}

function Groups({d,role,act,busy,money,isRw}:{d:State;role:Role;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}) {
  const submitGroup=async(draft:import('./savings-groups-setup').SavingsGroupDraft)=>{const r=await fetch('/api/groups',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({intent:'create',model:draft.model,name:draft.name,description:draft.description,location:draft.location,contact:draft.contact,administratorLabel:draft.administrator,expectedMembers:draft.memberCount,contributionAmount:draft.contributionAmount,frequency:draft.frequency,startDate:draft.startDate,endDate:draft.model==='ROTATING'?draft.shareOutDate:draft.cycleEndDate,shareOutDate:draft.shareOutDate,rotationOrder:draft.rotationOrder.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),reserveBps:draft.reservePercent*100,accepted:draft.acceptsRules})});const j=await r.json();if(!r.ok)throw new Error(j.error||(isRw?'Gutunganya itsinda byanze.':'Group setup failed.'));window.location.assign(`/app/groups?orgId=${encodeURIComponent(j.result.orgId)}`);return true};
  const joinGroup=async(code:string)=>{const r=await fetch('/api/groups',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({intent:'join',inviteCode:code})});const j=await r.json();if(!r.ok)throw new Error(j.error||(isRw?'Ntibyakunze kwinjira muri iri tsinda.':'Could not join this group.'));window.location.assign(`/app/groups?orgId=${encodeURIComponent(j.result.orgId)}`);return true};

  if (!d.savingsGroup) {
    return <SavingsGroupsSetup currentGroupName={d.user.organizationName} onCreate={submitGroup} onJoin={joinGroup}/>;
  }

  return (
    <>
      <SavingsGroupDashboard d={d} role={role} act={act} busy={busy} money={money} isRw={isRw} />

      <details className="card" style={{ marginTop: '20px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, padding: '4px 0' }}>
          {isRw ? 'Igenamiterere ry’Itsinda & Kwinjira mu rindi tsinda' : 'Advanced Settings & Switch/Setup Another Group'}
        </summary>
        <div style={{ marginTop: '16px' }}>
          <SavingsGroupsSetup currentGroupName={d.savingsGroup.name} onCreate={submitGroup} onJoin={joinGroup}/>
        </div>
      </details>

      <details className="card" style={{ marginTop: '14px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, padding: '4px 0' }}>
          {isRw ? 'Igitabo cy’Imari n’Ibikorwa bya Kera' : 'Immutable Ledger & Payment Audit History'}
        </summary>
        <div style={{ marginTop: '16px' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{isRw ? 'Itariki' : 'Date'}</th>
                  <th>{isRw ? 'Ibisobanuro' : 'Description'}</th>
                  <th>{isRw ? 'Debit' : 'Debit'}</th>
                  <th>{isRw ? 'Credit' : 'Credit'}</th>
                  <th>{isRw ? 'Indangamuntu' : 'Reference'}</th>
                </tr>
              </thead>
              <tbody>
                {d.ledger.map(l => (
                  <tr key={l.id}>
                    <td>{l.date}</td>
                    <td>{l.description}</td>
                    <td>{money(l.debit)}</td>
                    <td>{money(l.credit)}</td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{l.reference}</span></td>
                  </tr>
                ))}
                {!d.ledger.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      {isRw ? 'Nta nyandiko z’ibaruramari zizewe zanditswe.' : 'No ledger records yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}

function Fundraising({d,role,act,busy,money,isRw}:{d:State;role:Role;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}) {
  const [campaignId,setCampaignId]=useState(d.campaigns[0]?.id||'');
  if (d.fundraisingState) {
    return (
      <FundraisingDashboard
        fundraisingState={d.fundraisingState}
        userRole={role}
        userId={d.user.id}
        userName={d.user.name}
        onAction={async (payload) => {
          await act({ orgId: 'fund-school', ...payload });
        }}
      />
    );
  }
  return <div className="dashboard-grid">
    <div className="column-stack">
      <Card title={isRw ? 'Ubukangurambaga' : 'Campaigns'} sub={isRw ? 'Intambwe igana ku ntego z’abaturage.' : 'Progress toward community goals.'}>
        <div className="campaign-grid">
          {d.campaigns.map(c=><div className="campaign-card" key={c.id}>
            <span className="campaign-category">{c.category}</span>
            <h3>{c.title}</h3>
            <p>{c.description}</p>
            <div className="campaign-amount">{money(c.raised)} <small>{isRw ? 'byakusanyijwe' : 'raised'}</small></div>
            <div className="progress-track"><span style={{width:`${pct(c.raised,c.target)}%`}}/></div>
            <div className="campaign-meta"><span>{pct(c.raised,c.target)}% {isRw ? 'kuri' : 'of'} {money(c.target)}</span><span>{money(c.spent)} {isRw ? 'byakoreshejwe' : 'spent'}</span></div>
            <Form onSubmit={v=>act({action:'donate',orgId:'fund-school',campaignId:c.id,amount:Number(v.amount),outcome:v.outcome,reference:'DEMO-DONATION-'+crypto.randomUUID()})} busy={busy} fields={[["amount",isRw?"Impano y’icyitegererezo (Frw)":"Demo donation (RWF)","number","1000"],["outcome",isRw?"Igisubizo":"Outcome","select","success"]]} submit={isRw?"Tanga impano":"Simulate donation"} isRw={isRw}/>
          </div>)}
          {!d.campaigns.length&&<div className="empty-state">{isRw ? 'Ubukangurambaga buhagaragara.' : 'Campaigns will appear here.'}</div>}
        </div>
      </Card>
      <Card title={isRw ? 'Ubwishyu bw’ubukangurambaga' : 'Campaign payments'} sub={isRw ? 'Suzuma ubusabe n’amasoko yemejwe.' : 'Review simulated outcomes and confirm unresolved provider results.'}>
        <div className="activity-list">
          {d.payments.filter(p=>p.kind.includes('donation')||p.kind.includes('expense')).map(p=><div className="activity-row" key={p.id}><span className="activity-icon"><HeartHandshake size={16}/></span><span><b>{p.kind}</b><small>{p.reference} · {p.status}</small></span><strong>{money(p.amount)}</strong>{['treasurer','president'].includes(role)&&['pending','unknown'].includes(p.status)&&<button className="button button-quiet" onClick={()=>void act({action:'confirmPayment',orgId:'fund-school',paymentId:p.id,outcome:'success'})} disabled={busy}>{isRw ? 'Emeza ko byagenze neza' : 'Confirm success'}</button>}</div>)}
          {!d.payments.some(p=>p.kind.includes('donation')||p.kind.includes('expense'))&&<div className="empty-state">{isRw ? 'Nta bwishyu bw’ubukangurambaga bwanditswe.' : 'No campaign payments recorded yet.'}</div>}
        </div>
      </Card>
    </div>
    <div className="column-stack">
      {['president','treasurer'].includes(role)&&<Card title={isRw ? 'Tangiza ubukangurambaga' : 'Start a campaign'} sub={isRw ? 'Garagaza intego y’abaturage mu mucyo.' : 'Make a community goal visible.'}>
        <Form onSubmit={v=>act({action:'createCampaign',orgId:'fund-school',title:v.title,description:v.description,category:v.category,target:Number(v.target)})} busy={busy} fields={[["title",isRw?"Izina ry’ubukangurambaga":"Campaign title","text",isRw?"Urugero: Isomero ry’abaturage":"e.g. Community library"],["description",isRw?"Ibisobanuro":"Short description","text",isRw?"Ubukangurambaga bugamije iki?":"What is this campaign for?"],["category",isRw?"Icyiciro":"Category","text",isRw?"Uburezi":"Education"],["target",isRw?"Intego (Frw)":"Target (RWF)","number","500000"]]} submit={isRw?"Tangiza ubukangurambaga":"Create campaign"} isRw={isRw}/>
      </Card>}
      {['president','treasurer'].includes(role)&&<Card title={isRw ? 'Saba amafaranga y’amasoko' : 'Request an expense'} sub={isRw ? 'Undi muyobozi ubifitiye uburenganzira agomba kubanza kwemeza ubu busabe.' : 'A different authorized person must approve the request.'}>
        <label className="standalone-field">{isRw ? 'Ubukangurambaga' : 'Campaign'}<select value={campaignId} onChange={e=>setCampaignId(e.target.value)}>{d.campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <Form onSubmit={v=>act({action:'requestExpense',orgId:'fund-school',campaignId,amount:Number(v.amount),title:v.title})} busy={busy} fields={[["title",isRw?"Izina ry’isoko":"Expense title","text",isRw?"Kugura ibikoresho":"Materials purchase"],["amount",isRw?"Amafaranga (Frw)":"Amount (RWF)","number","15000"]]} submit={isRw?"Ohereza ubusabe":"Submit request"} isRw={isRw}/>
      </Card>}
      <Card title={isRw ? 'Kwemeza amafaranga yasohotse' : 'Expense approvals'} sub={isRw ? 'Bisaba kwemezwa na Perezida mbere y’uko amafaranga asohoka.' : 'President review required before provider confirmation.'}>
        <div className="activity-list">
          {d.alerts.filter(a=>a.kind==='expense').map(a=><div className="activity-row" key={a.id}><span className="activity-icon"><ShieldCheck size={16}/></span><span><b>{isRw ? 'Isuzuma ry’amafaranga' : 'Expense review'}</b><small>{a.message}</small></span>{role==='president'&&<button className="button button-quiet" onClick={()=>void act({action:'approveExpense',orgId:'fund-school',expenseId:a.id})} disabled={busy}>{isRw ? 'Emeza' : 'Approve'}</button>}</div>)}
          {!d.alerts.some(a=>a.kind==='expense')&&<div className="empty-state">{isRw ? 'Nta mafaranga ategereje kwemezwa.' : 'No expenses awaiting approval.'}</div>}
        </div>
      </Card>
    </div>
  </div>;
}

function Coop({d,role,act,busy,money,isRw}:{d:State;role:Role;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}){
  const [showSetup, setShowSetup] = useState(false);

  const submitCoop = async (draft: CooperativeDraft) => {
    const r = await fetch('/api/cooperative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        intent: 'create',
        ...draft
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || (isRw ? 'Gushinga koperative byanze.' : 'Cooperative setup failed.'));
    window.location.assign(`/app/cooperative?orgId=${encodeURIComponent(j.result.orgId)}`);
    return true;
  };

  const joinCoop = async (orgId: string) => {
    const r = await fetch('/api/cooperative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'join', orgId })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || (isRw ? 'Ntibyakunze kwinjira muri iyi koperative.' : 'Could not join this cooperative.'));
    window.location.assign(`/app/cooperative?orgId=${encodeURIComponent(j.result.orgId)}`);
    return true;
  };

  if (!d.cooperativeState || showSetup) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {d.cooperativeState && (
          <div>
            <button
              className="button button-quiet"
              onClick={() => setShowSetup(false)}
            >
              ← {isRw ? 'Subira kuri Koperative' : 'Back to Cooperative Dashboard'}
            </button>
          </div>
        )}
        <CooperativeSetup onCreate={submitCoop} onJoin={joinCoop} isRw={isRw} />
      </div>
    );
  }

  return (
    <CooperativeDashboard
      d={d}
      role={role}
      act={act}
      busy={busy}
      money={money}
      isRw={isRw}
      onCreateNew={() => setShowSetup(true)}
    />
  );
}

function Impact({d,act,busy,money,isRw}:{d:State;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}){
  return (
    <NgoImpactDashboard
      ngoState={d.ngoState}
      legacyImpact={d.impact}
      interventions={d.interventions}
      act={act}
      busy={busy}
      money={money}
      isRw={isRw}
    />
  );
}

function Guardian({d,money,isRw}:{d:State;money:(n:number)=>string;isRw:boolean}){
  return <>
    <div className="dashboard-grid">
      <div className="column-stack">
        <Card title={isRw ? 'Amafaranga yawe asobanutse' : 'Your money, explained'} sub={isRw ? 'Inama z’ingenzi zigufasha gufata imyanzuro ifite ireme.' : 'A few clear ideas to help you make confident choices.'}>
          <div className="guide-list">
            {[
              [isRw ? 'Kuzigama bitanga amahitamo' : 'Savings create options', isRw ? `Kuzigama buri gihe bitanga umutekano kandi bikagufasha kubona inguzanyo mu itsinda. Ubwizigame bwawe bwemewe ubu ni ${money(d.member.eligibleSavings)}.` : 'Regular contributions can build a cushion and improve your access to group lending. Your current eligible savings are '+money(d.member.eligibleSavings)+'.'],
              [isRw ? 'Gufata inguzanyo ni icyemezo gisangiwe' : 'Borrowing is a shared decision', isRw ? 'Ubusabe bw’inguzanyo busuzumwa hagendewe ku mategeko y’itsinda n’amafaranga ahari. Reba neza ko gahunda yo kwishyura ihura n’ubushobozi bwawe.' : 'A loan request is reviewed according to group rules and available funds. Make sure the repayment schedule fits your cash flow.'],
              [isRw ? 'Rinda ikigega cy’ibiza' : 'Keep a reserve for surprises', isRw ? 'Amatsinda ashyira ku ruhande ikigega kirinzwe mbere yo kuguriza abandi.' : 'Groups set aside a reserve to handle uncertainty before lending out the rest.']
            ].map(([t,p],i)=><article key={t} className="guide-item"><span>0{i+1}</span><div><h3>{t}</h3><p>{p}</p></div></article>)}
          </div>
        </Card>
        <Card title={isRw ? 'Intambwe ikurikira' : 'Your next steps'} sub={isRw ? 'Bishingiye ku biboneka mu mwanya wawe.' : 'Based on what is available in your workspace.'}>
          <div className="detail-line"><span>{isRw ? 'Urugero rw’inguzanyo rushoboka' : 'Indicative loan limit'}</span><b>{money(d.member.loanLimit)}</b></div>
          <div className="detail-line"><span>{isRw ? 'Ubutumwa bw’itsinda' : 'Group alerts'}</span><b>{d.alerts.length} {isRw ? 'bwo gusuzuma' : 'to review'}</b></div>
          {d.alerts.slice(0,3).map(a=><div className="alert-row" key={a.id}><Sparkles size={15}/>{a.message}</div>)}
        </Card>
      </div>
      <div className="column-stack">
        <div className="guide-callout">
          <div className="callout-icon"><ShieldCheck size={22}/></div>
          <h2>{isRw ? 'Banza umenye mbere yo guhitamo.' : 'Know before you choose.'}</h2>
          <p>{isRw ? 'HURIZA ifasha koroshya imyumvire ku bwizigame, inguzanyo n’imari y’itsinda. Itsinda rigenzura amabwiriza yaryo, kandi ushobora kubaza ushinzwe umutungo kugira ngo mugenzurire hamwe icyemezo.' : 'Huriza helps make savings, loans and group finances easier to understand. Your group decides its own rules, and you can always ask your treasurer to walk through a decision with you.'}</p>
          <div className="callout-foot">{isRw ? 'Amakuru asobanutse. Amahitamo yawe.' : 'Clear information. Your choice.'}</div>
        </div>
        <Card title={isRw ? 'Genzura ibikoresho byawe' : 'Explore your tools'} sub={isRw ? 'Itondere kureba imibare.' : 'Take a closer look at the numbers.'}>
          <Link className="action-link" href="/app/simulator"><Sparkles size={18}/><span><b>{isRw ? 'Igerageza ry’imari' : 'Scenario lab'}</b><small>{isRw ? 'Gerageza kureba ejo hazaza' : 'Try a what-if with demo figures'}</small></span><ArrowRight size={16}/></Link>
          <Link className="action-link" href="/app/personal"><Wallet size={18}/><span><b>{isRw ? 'Umwanya bwite' : 'Personal workspace'}</b><small>{isRw ? 'Suzuma ubwizigame n’intego' : 'Review savings and goals'}</small></span><ArrowRight size={16}/></Link>
        </Card>
      </div>
    </div>
    <section className="guardian-calculator" aria-label="Guardian decision simulator">
      <div className="card-head">
        <div>
          <h2>{isRw ? 'Genzura icyemezo cy’imari' : 'Test a financial decision'}</h2>
          <p>{isRw ? 'Hindura ibipimo maze urebe ibarura ry’ikigega kirinzwe ridasanzwe. Nta gitabo cy’imari gihinduka.' : 'Adjust a scenario and see the deterministic reserve calculation. No ledger changes.'}</p>
        </div>
      </div>
      <Simulator d={d} money={money} isRw={isRw}/>
    </section>
  </>;
}

function Simulator({d,money,isRw}:{d:State;money:(n:number)=>string;isRw:boolean}){
  const contextCash=d.user.role==='cooperative'?d.cooperative.cash:d.treasury.cash||5000000;
  const [cash,setCash]=useState(contextCash),[reserve,setReserve]=useState(2000),[requests,setRequests]=useState(1),[loanAmount,setLoanAmount]=useState(50000),[contributions,setContributions]=useState(0),[repay,setRepay]=useState(10000),[delay,setDelay]=useState(0),[investment,setInvestment]=useState(0);
  const input={cash,reserveBps:reserve,requests,loanAmount,contributions,expectedRepayments:repay,delayBps:delay,investment,outstandingLoans:d.treasury.outstandingLoans};
  const result=calculateScenario(input);

  const preset=(kind:'reset'|'healthy'|'warning'|'critical')=>{
    if(kind==='reset'){setCash(contextCash);setReserve(2000);setRequests(1);setLoanAmount(50000);setContributions(0);setRepay(10000);setDelay(0);setInvestment(0);return;}
    const p=scenarioPreset(kind);setCash(p.cash);setReserve(p.reserveBps);setRequests(p.requests);setLoanAmount(p.loanAmount);setContributions(p.contributions);setRepay(p.expectedRepayments);setDelay(p.delayBps);setInvestment(p.investment);
  };

  const presetLabels: Record<'reset'|'healthy'|'warning'|'critical', string> = {
    reset: isRw ? 'Tangira bushya' : 'reset',
    healthy: isRw ? 'Biteguye neza' : 'healthy',
    warning: isRw ? 'Ikigega kito' : 'warning',
    critical: isRw ? 'Ikigega kibuzeho' : 'critical',
  };

  return <div className="dashboard-grid">
    <div className="column-stack">
      <Card title={isRw ? 'Hindura ibishingirwaho' : 'Adjust your assumptions'} sub={isRw ? 'Genzura ibyemezo bitandukanye. Nta kintu gihinduka kuri konti yawe.' : 'Explore a hypothetical outcome. Nothing here changes your account.'} action={<div className="segmented">{(['reset','healthy','warning','critical'] as const).map(p=><button key={p} onClick={()=>preset(p)}>{presetLabels[p]}</button>)}</div>}>
        <Range label={isRw ? 'Amafaranga y’itsinda atangira' : 'Starting group cash'} value={cash} min={0} max={Math.max(10000000,contextCash*2)} set={setCash} display={money(cash)}/>
        <Range label={isRw ? 'Ikigega cyo kubika (%)' : 'Reserve to keep'} value={reserve} min={0} max={8000} set={setReserve} display={`${(reserve/100).toFixed(0)}%`}/>
        <Range label={isRw ? 'Umubare w’abaka inguzanyo' : 'Number of loan requests'} value={requests} min={0} max={20} set={setRequests} display={String(requests)}/>
        <Range label={isRw ? 'Inguzanyo igereranije' : 'Average loan amount'} value={loanAmount} min={0} max={500000} set={setLoanAmount} display={money(loanAmount)}/>
        <Range label={isRw ? 'Imisanzu yitezwe' : 'Expected contributions'} value={contributions} min={0} max={250000} set={setContributions} display={money(contributions)}/>
        <Range label={isRw ? 'Ubwishyu bwiteganyijwe' : 'Expected repayments'} value={repay} min={0} max={250000} set={setRepay} display={money(repay)}/>
        <Range label={isRw ? 'Gukererwa kwishyura (%)' : 'Repayment delay'} value={delay} min={0} max={10000} set={setDelay} display={`${(delay/100).toFixed(0)}%`}/>
        <Range label={isRw ? 'Amafaranga y’ishoramari' : 'Investment spending'} value={investment} min={0} max={Math.max(5000000,contextCash*2)} set={setInvestment} display={money(investment)}/>
        <div className="safe-note"><Sparkles size={16}/> {isRw ? 'Ibarura rikoresha amafaranga yuzuye ya Frw. Nta gitabo cy’imari gihinduka.' : 'Inputs use integer RWF. Prepared examples start at 5,000,000 RWF. Expected inflows are assumptions; existing pending commitments must be allowed for separately.'}</div>
      </Card>
    </div>
    <div className="column-stack">
      <div className={`scenario-result scenario-${result.status}`}>
        <span className="welcome-tag">{isRw ? 'ICYITEGEREREZO CY’IBISUBIZO' : 'SIMULATED OUTCOME'} · {result.status.toUpperCase()}</span>
        <h2>{result.status==='critical'?(isRw?'Ikigega kibuzeho amafaranga yo kwitondera':'Reserve shortfall to address'):result.status==='warning'?(isRw?'Ubushobozi bwo kuguriza buragabanutse':'Tight lending capacity'):(isRw?'Umutungo uhagaze neza':'Healthy modeled position')}</h2>
        <p>{result.explanation}</p>
        <div className="scenario-big">{money(result.cashAfter)}<small>{isRw ? 'Amafaranga azasigara nyuma y’ibyemezo' : 'Estimated cash after modeled decisions'}</small></div>
      </div>
      <Card title={isRw ? 'Ibyo iri gerageza ryerekana' : 'What the scenario shows'} sub={isRw ? 'Byabazwe n’uburyo bw’imibare bwa HURIZA.' : 'Calculated by Huriza’s integer scenario model.'}>
        <ScenarioChart result={result} cash={cash} money={money} isRw={isRw}/>
        <p className="subtle-note">{isRw ? 'Ikigega kibarirwa ku mafaranga atangira mbere y’uko andi yinjira.' : 'The reserve is calculated against starting cash before scenario inflows. Starting cash is a scenario assumption; it does not change the operational ledger.'}</p>
        <div className="detail-line"><span>{isRw ? 'Ikigega kirinzwe' : 'Protected reserve'}</span><b>{money(result.reserve)}</b></div>
        <div className="detail-line"><span>{isRw ? 'Amafaranga asigaye yo kuguriza' : 'Available lending capacity'}</span><b>{money(result.lendingCapacity)}</b></div>
        <div className="detail-line"><span>{isRw ? 'Ikigega kibuzeho' : 'Reserve shortfall'}</span><b>{money(result.shortfall)}</b></div>
        <div className="detail-line"><span>{isRw ? 'Inguzanyo zose hamwe' : 'Loan exposure after requests'}</span><b>{money(result.loanExposure)}</b></div>
      </Card>
    </div>
  </div>;
}

function ScenarioChart({result,cash,money,isRw}:{result:ReturnType<typeof calculateScenario>;cash:number;money:(n:number)=>string;isRw:boolean}) {
  const rows=[
    [isRw ? 'Amafaranga atangira' : 'Starting cash', cash, '#4A90E2'],
    [isRw ? 'Ateganyijwe kwinjira' : 'Expected inflows', result.inflows, '#83b8f5'],
    [isRw ? 'Inguzanyo nshya n’ishoramari' : 'New loans + investment', result.outflows, '#2463A6'],
    [isRw ? 'Amafaranga azasigara' : 'Estimated ending cash', result.cashAfter, result.cashAfter<result.reserve?'#b7634d':'#4A90E2'],
    [isRw ? 'Ikigega kirinzwe' : 'Protected reserve', result.reserve, '#83b8f5']
  ] as const;
  const scaleMax=Math.max(...rows.map(([,v])=>Math.abs(v)),1);
  const width=(value:number)=>Number(BigInt(Math.abs(value))*360n/BigInt(scaleMax));

  return <div className="scenario-chart-wrap">
    <svg className="scenario-chart" viewBox="0 0 860 226" role="img" aria-label={`Scenario amounts. ${rows.map(([label,value])=>`${label} ${money(value)}`).join('; ')}`}>
      <title>{isRw ? 'Icyerekezo cy’amafaranga' : 'Scenario cash flow'}</title>
      <desc>{isRw ? 'Igipimo kigereranya amafaranga atangira n’azasigara' : 'Bars compare starting cash, expected inflows, new loans and investment, estimated ending cash, and the protected reserve.'}</desc>
      {rows.map(([label,value,color],i)=>{
        const y=25+i*42;
        return <g key={label}>
          <text x="0" y={y+15} className="chart-label">{label}</text>
          <rect x="200" y={y} width="360" height="22" rx="5" fill="#EAF3FE"/>
          <rect x="200" y={y} width={width(value)} height="22" rx="5" fill={color}/>
          <text x="570" y={y+15} className="chart-value">{money(value)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function Range({label,value,min,max,set,display}:{label:string;value:number;min:number;max:number;set:(n:number)=>void;display:string}){
  return <label className="range-control"><span>{label}<b>{display}</b></span><input type="range" min={min} max={max} step={min===0&&max>100?1000:1} value={value} onChange={e=>set(Number(e.target.value))}/></label>;
}

function Connect({d,act,busy,money,isRw}:{d:State;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean;money:(n:number)=>string;isRw:boolean}) {
  type Screen='home'|'savings'|'groups'|'loans'|'repay'|'contributions'|'notifications'|'contribute'|'requestLoan'|'done';
  const [screen,setScreen]=useState<Screen>('home'),[amount,setAmount]=useState('5000'),[months,setMonths]=useState('6'),[outcome,setOutcome]=useState('success'),[loanId,setLoanId]=useState(d.loans.find(l=>l.status==='active'&&l.userId===d.user.id)?.id||'');
  const back=()=>setScreen('home');
  const submit=async()=>{
    let payload:Record<string,unknown>;
    if(screen==='requestLoan')payload={action:'requestLoan',amount:Number(amount),months:Number(months)};
    else if(screen==='repay')payload={action:'repay',loanId,amount:Number(amount),outcome,reference:'DEMO-USSD-REPAY-'+crypto.randomUUID()};
    else payload={action:'contribute',amount:Number(amount),outcome,reference:'DEMO-USSD-'+crypto.randomUUID()};
    if(await act(payload))setScreen('done');
  };

  const menu:[Screen,string][] = isRw ? [
    ['savings','1 · Ubwizigame bwanjye'],
    ['groups','2 · Umutungo w’itsinda'],
    ['loans','3 · Inguzanyo zanjye'],
    ['contribute','4 · Tanga umusanzu'],
    ['repay','5 · Ishyura inguzanyo'],
    ['contributions','6 · Urutonde rw’imisanzu'],
    ['notifications','7 · Ubutumwa']
  ] : [
    ['savings','1 · My savings'],
    ['groups','2 · Group treasury'],
    ['loans','3 · My loans'],
    ['contribute','4 · Make contribution'],
    ['repay','5 · Repay a loan'],
    ['contributions','6 · Contribution history'],
    ['notifications','7 · Notifications']
  ];

  return <div className="ussd-layout">
    <div className="ussd-copy">
      <span className="welcome-tag">{isRw ? 'IKORESHWA KURI BURI TELEFONE' : 'FEATURE PHONE FRIENDLY'}</span>
      <h2>{isRw ? 'Imari y’itsinda mu buryo bwa menu bumenyerewe.' : 'Community finance through a familiar menu.'}</h2>
      <p>{isRw ? 'Ubu buryo bwerekana uko USSD ikora kuri konti yawe y’icyitegererezo. Ntibukora ku mirongo y’itumanaho nyakuri.' : 'This interactive mock-up demonstrates a USSD flow. It uses your demo account and never contacts a mobile network or sends money.'}</p>
      <div className="safe-note"><ShieldCheck size={16}/> {isRw ? 'Ibikorwa bya USSD by’icyitegererezo gusa' : 'Synthetic USSD activity only'}</div>
    </div>
    <div className="phone-shell">
      <div className="phone-screen">
        <div className="phone-top"><span>{BRAND.name} · DEMO</span><span>●●● 4G</span></div>
        <div className="ussd-content">
          <div className="ussd-star">✳</div>
          <b>{screen==='home'?(isRw?'Murakaza neza muri HURIZA':'Welcome to Huriza'):menu.find(x=>x[0]===screen)?.[1]||'Huriza'}</b>
          {screen==='home'?(
            <div className="ussd-options">{menu.map(([id,label])=><button key={id} onClick={()=>setScreen(id)}>{label}</button>)}</div>
          ):screen==='savings'?(
            <><p>{isRw ? 'Ubwizigame bw’itsinda bwemewe' : 'Eligible group savings'}<br/><b>{money(d.member.eligibleSavings)}</b><br/>{isRw ? 'Bicungirwa mu itsinda; si amafaranga abikuzwa ako kanya.' : 'Held by your savings group; not a personal withdrawal balance.'}</p><button className="ussd-back" onClick={back}>{isRw ? 'Subira kuri menu' : 'Back to menu'}</button></>
          ):screen==='groups'?(
            <><p>{d.user.organizationName||(isRw?'Itsinda ryawe':'Your savings group')}<br/>{isRw ? 'Amafaranga y’itsinda' : 'Group cash'}: {money(d.treasury.cash)}<br/>{isRw ? 'Ashobora kugurizwa' : 'Available to lend'}: {money(d.treasury.lendingCapacity)}</p><button className="ussd-back" onClick={back}>{isRw ? 'Subira kuri menu' : 'Back to menu'}</button></>
          ):screen==='loans'?(
            <><p>{d.loans.length?d.loans.map(l=>`${l.status}: ${money(l.amount)} · ${l.months} ${isRw ? 'amezi' : 'months'}`).join(' · '):(isRw ? 'Nta nguzanyo zanditse.' : 'No loan records.')}</p><div className="ussd-options"><button onClick={()=>setScreen('requestLoan')}>{isRw ? 'Saba inguzanyo' : 'Request a loan'}</button><button onClick={()=>setScreen('repay')}>{isRw ? 'Ishyura inguzanyo' : 'Repay a loan'}</button><button onClick={back}>{isRw ? 'Subira kuri menu' : 'Back to menu'}</button></div></>
          ):screen==='contributions'?(
            <><p>{d.contributions.length?d.contributions.slice(0,5).map(c=>`${c.date} · ${money(c.amount)} · ${c.status}`).join(' · '):(isRw ? 'Nta misanzu yanditse.' : 'No contributions recorded.')}</p><button className="ussd-back" onClick={back}>{isRw ? 'Subira kuri menu' : 'Back to menu'}</button></>
          ):screen==='notifications'?(
            <><p>{d.notifications.length?d.notifications.slice(0,5).map(n=>n.message).join(' · '):(isRw ? 'Nta butumwa ufite.' : 'You have no notifications.')}</p><button className="ussd-back" onClick={back}>{isRw ? 'Subira kuri menu' : 'Back to menu'}</button></>
          ):screen==='done'?(
            <div className="ussd-confirm">{isRw ? 'Ubusabe bwawe bw’icyitegererezo bwanditswe.' : 'Your simulated request was recorded.'}<button onClick={back}>{isRw ? 'Subira kuri menu' : 'Back to menu'}</button></div>
          ):(
            <>
              <label>{isRw ? 'Injiza amafaranga (Frw)' : 'Enter amount (RWF)'}<input value={amount} type="number" min="1" onChange={e=>setAmount(e.target.value)}/></label>
              {screen==='requestLoan'&&<label>{isRw ? 'Amezi yo kwishyura' : 'Repayment term (months)'}<input value={months} type="number" min="1" max="24" onChange={e=>setMonths(e.target.value)}/></label>}
              {screen==='repay'&&<label>{isRw ? 'Inguzanyo' : 'Loan'}<select value={loanId} onChange={e=>setLoanId(e.target.value)}>{d.loans.filter(l=>l.status==='active'&&l.userId===d.user.id).map(l=><option key={l.id} value={l.id}>{money(l.amount)} · {l.months} {isRw ? 'amezi' : 'months'}</option>)}</select></label>}
              <label>{isRw ? 'Igisubizo cy’urugero' : 'Demo provider result'}<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="success">{isRw ? 'Byagenze neza' : 'Success'}</option><option value="pending">{isRw ? 'Biracyatunganywa' : 'Pending'}</option><option value="failed">{isRw ? 'Byanze' : 'Failed'}</option><option value="unknown">{isRw ? 'Ntibiramenyekana' : 'Unknown'}</option></select></label>
              <button className="ussd-send" onClick={()=>void submit()} disabled={busy||!amount||(screen==='repay'&&!loanId)}>{busy?(isRw?'Biragenda…':'Sending…'):(isRw?'Ohereza ubusabe':'Send request')}</button>
              <button className="ussd-back" onClick={back}>{isRw ? 'Reka' : 'Cancel'}</button>
            </>
          )}
        </div>
        <div className="phone-bottom"><span>◁</span><span className="phone-home"/><span>▣</span></div>
      </div>
      <div className="phone-caption">{isRw ? 'TELEFONE Y’ICYITEGEREREZO' : 'SIMULATED FEATURE PHONE'}</div>
    </div>
  </div>;
}
