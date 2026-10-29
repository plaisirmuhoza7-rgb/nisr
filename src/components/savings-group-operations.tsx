'use client';
import {useEffect,useState} from 'react';
import type {FinanceState,Role} from '@/lib/contracts';
import {useLanguage} from '@/lib/i18n/context';

function nextCycleDates(model:'ACCUMULATING'|'ROTATING',frequency:string){
  const start=new Date().toISOString().slice(0,10),end=new Date(`${start}T00:00:00Z`),share=new Date(end);
  if(model==='ACCUMULATING'){end.setUTCFullYear(end.getUTCFullYear()+1);share.setTime(end.getTime());}
  else if(frequency==='weekly'){share.setUTCDate(share.getUTCDate()+7);end.setUTCDate(end.getUTCDate()+7);}
  else{share.setUTCMonth(share.getUTCMonth()+1);end.setUTCMonth(end.getUTCMonth()+1);}
  return {startDate:start,endDate:end.toISOString().slice(0,10),shareOutDate:share.toISOString().slice(0,10)};
}

export default function SavingsGroupOperations({state,role,currentUserId,act,busy}:{state:FinanceState;role:Role;currentUserId:string;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean}){
 const { t, isKinyarwanda } = useLanguage();
 const money=(n:number)=>`${Math.round(n).toLocaleString(isKinyarwanda ? 'rw-RW' : 'en-US')} ${t.common.rwf}`;

 const [sheetsSyncing,setSheetsSyncing]=useState(false);const [sheetsStatus,setSheetsStatus]=useState('');
 const [groupSheetStatus,setGroupSheetStatus]=useState<'not_connected'|'pending'|'synced'|'needs_attention'|null>(null);
 const [sheetMode,setSheetMode]=useState<'shared'|'organization'|null>(null);
 const groupId=state.savingsGroup?.id??'';

 useEffect(()=>{
  if(!groupId){setGroupSheetStatus(null);setSheetMode(null);return;}
  let disposed=false;let request:AbortController|undefined;
  const poll=async()=>{
   request?.abort();const controller=new AbortController();request=controller;
   try{
    const response=await fetch(`/api/sheets/status?organizationId=${encodeURIComponent(groupId)}`,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`Status request failed (${response.status})`);
    const result:unknown=await response.json();
    const value=result&&typeof result==='object'&&'status'in result?result.status:null;
    if(value!=='not_connected'&&value!=='pending'&&value!=='synced'&&value!=='needs_attention')throw new Error('Invalid status response');
    if(!disposed){setGroupSheetStatus(value);setSheetMode(result&&typeof result==='object'&&'mode'in result&&result.mode==='shared'?'shared':'organization');}
   }catch(error){if(!disposed&&!(error instanceof DOMException&&error.name==='AbortError'))setGroupSheetStatus(null);}
  };
  void poll();const timer=setInterval(()=>void poll(),30000);
  return()=>{disposed=true;clearInterval(timer);request?.abort();};
 },[groupId]);

 const g=state.savingsGroup;if(!g)return null;

 const sheetStatusLabel=groupSheetStatus==='not_connected'
   ? (isKinyarwanda ? 'Google Sheets ntihuza n’iri tsinda.' : 'Google Sheets is not connected for this group.')
   : groupSheetStatus==='pending'
   ? (isKinyarwanda ? 'Guhuza na Google Sheets biracyatunganywa.' : 'Google Sheets update is pending and still waiting; it is not confirmed as synced.')
   : groupSheetStatus==='synced'
   ? (isKinyarwanda ? 'Imbonerahamwe y’itsinda iravuguruwe neza.' : 'The organization spreadsheet is up to date.')
   : groupSheetStatus==='needs_attention'
   ? (isKinyarwanda ? 'Google Sheets irakeneye ubugenzuzi. Baza umuyobozi w’itsinda.' : 'Google Sheets needs attention. Ask a group administrator to check the connection.')
   : (isKinyarwanda ? 'Imiterere ya Google Sheets ntibonetse ubu.' : 'Google Sheets status is currently unavailable.');

 async function syncSimulatedSummary(){
   setSheetsSyncing(true);setSheetsStatus('');
   try{
     const response=await fetch('/api/sheets/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:groupId})});
     let payload:unknown={};try{payload=await response.json()}catch{}
     const detail=payload&&typeof payload==='object'&&'error'in payload?String(payload.error):'';
     if(!response.ok)throw new Error(detail||`Sync failed (${response.status})`);
     setSheetsStatus(isKinyarwanda ? 'Incamake y’itsinda y’icyitegererezo yoherejwe muri Google Sheets.' : 'Simulated group aggregate sent to Google Sheets. No member details were sent.');
   }catch(error){
     setSheetsStatus(error instanceof Error?error.message:(isKinyarwanda ? 'Guhuza na Google Sheets byanze.' : 'Google Sheets sync failed.'));
   }finally{
     setSheetsSyncing(false);
   }
 }

 const freqLabel = g.frequency === 'weekly' ? (isKinyarwanda ? 'buri cyumweru' : 'weekly') : (isKinyarwanda ? 'buri kwezi' : 'monthly');

 return <section className="card savings-operations">
   <div className="card-heading">
     <div>
       <span className="welcome-tag">{g.model==='ROTATING'?(isKinyarwanda?'IKIMINA · GUTANGA NO GUHEREREKANYA':'IKIMINA · CONTRIBUTE & ROTATE'):(isKinyarwanda?'ITSINDA · KUBITSA NO KUGABANA':'ITSINDA · SAVE & SHARE')}</span>
       <h2>{g.name}</h2>
       <p>{g.memberCount} {isKinyarwanda ? 'binjiye' : 'joined'} / {g.expectedMembers} {isKinyarwanda ? 'bateganyijwe' : 'members'} · {money(g.contributionAmount)} {freqLabel}</p>
       <p className="subtle-note">{isKinyarwanda ? 'Icyiciro' : 'Cycle'}: {g.cycleStatus==='collecting'?(isKinyarwanda?'kirakomeza':'Collecting'):g.cycleStatus==='closed'?(isKinyarwanda?'cyarafunzwe':'Closed'):g.cycleStatus}</p>
     </div>
   </div>
   {g.inviteCode?<div className="detail-line"><span>{isKinyarwanda ? 'Kode y’ubutumire bw’itsinda' : 'Group invitation code'}</span><b>{g.inviteCode}</b></div>:['president','treasurer'].includes(role)&&<button className="button button-quiet" disabled={busy} onClick={()=>void act({action:'createGroupInvite'})}>{isKinyarwanda ? 'Kora kode y’ubutumire' : 'Create invitation code'}</button>}
   <details>
    <summary>{isKinyarwanda ? 'Igenamiterere ry’inyongera' : 'Advanced · administration & integrations'}</summary>
    <p className="subtle-note" role="status" aria-live="polite">{sheetStatusLabel}</p>
    <p className="subtle-note">{sheetMode==='shared'?(isKinyarwanda?'Imbonerahamwe rusange irimo inyandiko z’imiryango yose kandi igaragarira abafite uruhushya.':'The shared spreadsheet contains records from all organizations and is visible to everyone with access to the file.'):(isKinyarwanda?'Inyandiko z’itsinda zibitswe mu mbonerahamwe zigaragarira abafite uruhushya.':'Saved group records in the organization spreadsheet are visible to everyone with access to that file.')}</p>
    {sheetMode==='organization'&&(g.memberRole==='president'||g.memberRole==='treasurer')&&<div className="form-actions"><p className="subtle-note">{isKinyarwanda ? 'Guhuza na Google Sheets byohereza incamake y’itsinda gusa.' : 'Google Sheets sync sends a simulated aggregate for this group only. No member details are sent.'}</p><button className="button button-quiet" disabled={sheetsSyncing} onClick={()=>void syncSimulatedSummary()}>{sheetsSyncing?(isKinyarwanda?'Biragenda…':'Syncing…'):(isKinyarwanda?'Ohereza incamake muri Google Sheets':'Sync simulated summary to Google Sheets')}</button>{sheetsStatus&&<p role="status" aria-live="polite" className="subtle-note">{sheetsStatus}</p>}</div>}
    {role==='president'&&g.members.filter(m=>m.role!=='president').length>0&&<div className="member-role-list"><b>{isKinyarwanda ? 'Uburenganzira mu itsinda' : 'Group access'}</b>{g.members.filter(m=>m.role!=='president').map(m=><label key={m.id}>{m.name}<select value={m.role==='treasurer'?'treasurer':'member'} onChange={e=>void act({action:'setGroupMemberRole',userId:m.id,memberRole:e.target.value})}><option value="member">{isKinyarwanda ? 'Umunyamuryango' : 'Member'}</option><option value="treasurer">{isKinyarwanda ? 'Ushinzwe umutungo' : 'Treasurer'}</option></select></label>)}</div>}
   </details>
   {g.model==='ROTATING'?<>
    <p className="subtle-note">{isKinyarwanda ? 'Amafaranga y’itsinda acungwa nk’ayiteguye guhererekanywa. Nta nguzanyo ziteganyijwe mu kimina.' : 'Group funds are held as rotation payables. Ikimina lending is disabled.'}</p>
    {!g.rotationRounds.length&&g.cycleStatus==='closed'&&role==='president'&&<button className="button button-primary" disabled={busy} onClick={()=>void act({action:'startSavingsCycle',...nextCycleDates(g.model,g.frequency)})}>{isKinyarwanda ? 'Tangiza icyiciro gikurikira cy’Ikimina' : 'Start the next Ikimina cycle'}</button>}
    {!g.rotationRounds.length&&g.cycleStatus==='collecting'&&<div className="form-actions"><p className="subtle-note">{isKinyarwanda ? 'Tangaza urutonde rwemerejwe nyuma y’uko abanyamuryango bose binjiye.' : 'Publish the agreed order after all expected members have joined. Names must match each account’s registered name.'}</p>{role==='president'&&<button className="button button-primary" disabled={busy} onClick={()=>void act({action:'startRotation'})}>{isKinyarwanda ? 'Tangaza gahunda yo guhererekanya' : 'Publish rotation schedule'}</button>}</div>}
    {g.obligations.map(o=><div className="activity-row" key={o.id}><span><b>{isKinyarwanda ? 'Inshingano y’umusanzu' : 'Contribution obligation'}</b><small>{o.dueDate} · {o.status} · {isKinyarwanda ? 'Utegetswe' : 'Due'} {money(o.amountDue)}</small></span><b>{money(o.amountConfirmed)}</b>{o.userId===currentUserId&&o.status!=='paid'&&o.roundId&&o.amountDue>o.amountConfirmed&&<button disabled={busy} onClick={()=>void act({action:'contribute',amount:o.amountDue-o.amountConfirmed,roundId:o.roundId,outcome:'success',reference:`ROT-${o.id}-${o.amountConfirmed}`})}>{isKinyarwanda ? 'Ishyura muri demo' : 'Record simulated payment'}</button>}</div>)}
    {g.rotationRounds.map(r=><div className="detail-line" key={r.id}><span>{isKinyarwanda ? `Inshuro ${r.roundNumber}` : `Round ${r.roundNumber}`} · {r.recipientName} · {r.dueDate}<small>{r.status} · {isKinyarwanda ? 'yakusanyijwe' : 'pool'} {money(r.confirmed)} / {money(r.expectedPool)}{r.shortfall?` · ${isKinyarwanda ? 'habuze' : 'short'} ${money(r.shortfall)}`:''}</small></span>{role==='president'&&['ready','collecting','delayed','failed'].includes(r.status)&&<button disabled={busy} onClick={()=>void act({action:'payRotation',roundId:r.id,outcome:'pending'})}>{isKinyarwanda ? 'Tanga ubwishyu bw’inshuro' : 'Initiate synthetic payout'}</button>}</div>)}
   </>:<>
    <details><summary>{isKinyarwanda ? 'Reba ibisobanuro by’ibarura' : 'View settlement breakdown'}</summary>
     <p className="subtle-note">{isKinyarwanda ? 'Ibarura ry’icyitegererezo rishingira ku bwizigame bwemejwe, amafaranga ahari, ikigega kirinzwe n’inshingano.' : 'Projection based on confirmed savings, cash, reserve, and outstanding obligations.'}</p>
     <div className="detail-line"><span>{isKinyarwanda ? 'Ubwizigame bw’itsinda bwemejwe' : 'Confirmed group savings'}</span><b>{money(g.shareOut.contributions)}</b></div>
     <div className="detail-line"><span>{isKinyarwanda ? 'Amafaranga y’itsinda ahari' : 'Current group cash'}</span><b>{money(g.shareOut.cash)}</b></div>
     <div className="detail-line"><span>{isKinyarwanda ? 'Ikigega kirinzwe' : 'Protected reserve'}</span><b>{money(g.shareOut.reserve)}</b></div>
     <div className="detail-line"><span>{isKinyarwanda ? 'Inguzanyo ziri hanze' : 'Outstanding loans'}</span><b>{money(g.shareOut.outstandingLoans)}</b></div>
     <div className="detail-line"><span>{isKinyarwanda ? 'Ubwishyu butararangira' : 'Unresolved payment holds'}</span><b>{money(g.shareOut.pending)}</b></div>
    </details>
    <div className="detail-line"><span>{isKinyarwanda ? 'Amafaranga ashobora kugabanwa' : 'Indicative distributable amount'}</span><b>{money(g.shareOut.distributable)}</b></div>
    <p className="subtle-note">{g.shareOut.ready?(isKinyarwanda?'Isuzuma ryo kugabana ryagenze neza.':'Cycle settlement checks passed.'):(isKinyarwanda?'Kugabana ntibiratungana kugeza igihe inshingano zose zikemuwe.':'Settlement is not ready until the cycle is formally settled and all obligations are resolved.')}</p>
    {role==='president'&&g.cycleStatus==='closed'&&<button className="button button-primary" disabled={busy} onClick={()=>void act({action:'startSavingsCycle',...nextCycleDates(g.model,g.frequency)})}>{isKinyarwanda ? 'Tangiza icyiciro gikurikira cy’Itsinda' : 'Start the next Itsinda cycle'}</button>}
    {role==='president'&&g.cycleStatus==='collecting'&&g.cycleEnd&&new Date(`${g.cycleEnd}T00:00:00Z`)<=new Date(new Date().toISOString().slice(0,10))&&<button className="button button-primary" disabled={busy||g.shareOut.pending>0||g.shareOut.outstandingLoans>0} onClick={()=>void act({action:'settleGroupCycle'})}>{isKinyarwanda ? 'Tegura kugabana ubwizigame' : 'Prepare synthetic share-out'}</button>}
   </>}
 </section>;
}
