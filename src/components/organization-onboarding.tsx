'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,ShieldCheck} from 'lucide-react';
import {ORGANIZATION_LABELS,ORGANIZATION_PURPOSES,type OrganizationPurpose,type WorkspaceRequest} from '@/lib/onboarding';
import {useLanguage} from '@/lib/i18n/context';
import LanguageToggle from './language-toggle';
import BrandLogo from './brand-logo';
import s from './organization-onboarding.module.css';

const rwOrgLabels: Record<OrganizationPurpose, string> = {
  fundraising: 'Gukusanya inkunga y’abaturage',
  cooperative: 'Ubuyobozi bwa koperative',
  impact: 'Gahunda z’iterambere n’ibipimo by’amatsinda',
};

export default function OrganizationOnboarding({purpose:initial='fundraising',requests:initialRequests,name}:{purpose?:OrganizationPurpose;requests:WorkspaceRequest[];name:string}){
 const { t, isKinyarwanda } = useLanguage();
 const [purpose,setPurpose]=useState(initial),[requests,setRequests]=useState(initialRequests),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const existing=requests.find(item=>item.purpose===purpose);

 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
   try{
     const response=await fetch('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({purpose,organizationName:String(form.get('organizationName')||''),district:String(form.get('district')||''),description:String(form.get('description')||'')})});
     const result=await response.json();
     if(!response.ok)throw new Error(result.error||(isKinyarwanda?'Ntibyakunze kubika ubusabe.':'Could not save the onboarding request.'));
     setRequests(previous=>[result.request,...previous.filter(item=>item.purpose!==purpose)]);
   }catch(err){
     setError(err instanceof Error?err.message:(isKinyarwanda?'Ntibyakunze kubika ubusabe.':'Could not save the request.'));
   }finally{
     setBusy(false);
   }
 }

 const orgLabel = (p: OrganizationPurpose) => isKinyarwanda ? rwOrgLabels[p] : ORGANIZATION_LABELS[p];

 return <main className={s.shell}>
  <header>
    <Link className={s.brand} href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BrandLogo size={28} /> HURIZA</Link>
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <LanguageToggle compact />
      <Link href="/app">{isKinyarwanda ? 'Umwanya wawe' : 'Your workspace'} <ArrowRight size={16}/></Link>
    </div>
  </header>
  <div className={s.content}>
    <Link href="/app" className={s.back}><ArrowLeft size={15}/> {isKinyarwanda ? 'Subira mu mwanya wawe' : 'Back to your workspace'}</Link>
    <span className={s.eyebrow}>{isKinyarwanda ? 'KWINJIZA UMURYANGO' : 'ORGANIZATION ONBOARDING'}</span>
    <h1>{isKinyarwanda ? <>Tangirana n’umuryango<br/>wifuza gushyigikira.</> : <>Start with the organization<br/>you want to support.</>}</h1>
    <p className={s.intro}>{isKinyarwanda ? `Murakaza neza, ${name.split(' ')[0]}. Tubwire umwanya wifuza gukoresha. Ubusabe bwawe bubikwa kuri iri gerageza; ntibutanga uburenganzira bw’umuryango ako kanya.` : `Welcome, ${name.split(' ')[0]}. Tell us the workspace you intend to use. Your request is saved for this prototype; it does not create organization permissions.`}</p>
    <div className={s.layout}>
      <section className={s.panel}>
        <label className={s.field}>{isKinyarwanda ? 'Intego y’umwanya w’akazi' : 'Workspace purpose'}
          <select value={purpose} disabled={busy} onChange={event=>{setPurpose(event.target.value as OrganizationPurpose);setError('');}}>
            {ORGANIZATION_PURPOSES.map(item=><option value={item} key={item}>{orgLabel(item)}</option>)}
          </select>
        </label>
        {error&&<p className={s.error} role="alert">{error}</p>}
        {existing?(
          <div className={s.receipt} role="status">
            <CheckCircle2 size={30}/>
            <h2>{isKinyarwanda ? 'Ubusabe bwarabitswe.' : 'Request saved.'}</h2>
            <p>{isKinyarwanda ? `Ubusabe bwawe bwo muri ${orgLabel(existing.purpose).toLowerCase()} ku muryango ` : `Your ${ORGANIZATION_LABELS[existing.purpose].toLowerCase()} request for `}<strong>{existing.organizationName}</strong> {isKinyarwanda ? 'bwanditswe nk’ubwoherejwe.' : 'is recorded as submitted.'}</p>
            <dl>
              <div><dt>{isKinyarwanda ? 'Akarere / aho rikorera' : 'District / location'}</dt><dd>{existing.district}</dd></div>
              <div><dt>{isKinyarwanda ? 'Imiterere' : 'Status'}</dt><dd>{isKinyarwanda ? 'Bwoherejwe · nta burenganzira buratangwa' : 'Submitted · no access assigned'}</dd></div>
              <div><dt>{isKinyarwanda ? 'Indangamuntu y’ubusabe' : 'Reference'}</dt><dd>{existing.id}</dd></div>
            </dl>
            <p className={s.small}>{isKinyarwanda ? 'Isuzuma n’igihe cyo kwemeza ntibikora muri iri gerageza. Nta burenganzira bw’umuryango buratangwa.' : 'An approval workflow and review timeline are not active in this prototype. No existing organization membership or financial access has been granted.'}</p>
            <Link className={s.button} href="/app">{isKinyarwanda ? 'Komeza ku mwanya wawe' : 'Continue to your workspace'} <ArrowRight size={16}/></Link>
          </div>
        ):(
          <form onSubmit={submit} className={s.form}>
            <label className={s.field}>{isKinyarwanda ? 'Izina ry’umuryango' : 'Organization name'}
              <input name="organizationName" autoComplete="organization" minLength={2} maxLength={120} required disabled={busy} placeholder={isKinyarwanda ? 'Koresha umuryango w’icyitegererezo' : 'Use a fictional organization for this prototype'}/>
            </label>
            <label className={s.field}>{isKinyarwanda ? 'Akarere / aho rikorera' : 'District / location'}
              <input name="district" minLength={2} maxLength={100} required disabled={busy} placeholder={isKinyarwanda ? 'Urugero: Gasabo' : 'e.g. Gasabo'}/>
            </label>
            <label className={s.field}>{isKinyarwanda ? 'Ni iki mwifuza gucunga?' : 'What would you like to manage?'}
              <textarea name="description" minLength={20} maxLength={2000} required rows={5} disabled={busy} placeholder={isKinyarwanda ? 'Sobanura ibyo itsinda ryanyu rikeneye. Ntugashyiremo amakuru bwite y’umutungo w’ibanga.' : 'Describe your team\'s needs. Do not include personal or sensitive financial information.'}/>
            </label>
            <p className={s.small}>{isKinyarwanda ? 'Konti yawe ibika ubusabe bumwe kuri buri cyiciro. Iyi fomu ntiyemeza uburenganzira ako kanya.' : 'One request per purpose is saved for your account. This application form creates no privileged role, invitation, or permission.'}</p>
            <button className={s.button} disabled={busy}>{busy?(isKinyarwanda?'Birabikwa…':'Saving request…'):(isKinyarwanda?'Bika ubusabe bwo kwinjira':'Save onboarding request')}<ArrowRight size={16}/></button>
          </form>
        )}
      </section>
      <aside className={s.help}>
        <span className={s.icon}><ShieldCheck size={24}/></span>
        <h2>{isKinyarwanda ? 'Konti yawe iguma ari iyawe.' : 'Your account stays yours.'}</h2>
        <p>{isKinyarwanda ? 'Imyanya yose itanu ikoresha umwirondoro umwe wemejwe. Uburenganzira bw’umuryango butangwa nyuma y’isuzuma.' : 'All five workspaces use one verified identity. Organization permissions depend on trusted creation, invitation, or review.'}</p>
        <ol>
          <li><b>{isKinyarwanda ? 'Andika icyifuzo cyawe' : 'Record your intent'}</b><span>{isKinyarwanda ? 'Bika intego y’umuryango n’ibyo ukeneye.' : 'Save the organization\'s purpose and needs.'}</span></li>
          <li><b>{isKinyarwanda ? 'Kwemezwa bikorwa ukwabyo' : 'Authorization comes separately'}</b><span>{isKinyarwanda ? 'Iri gerageza ntirihita ritanga uburenganzira kuri iyi fomu.' : 'This prototype does not automate approval or grant roles from this form.'}</span></li>
          <li><b>{isKinyarwanda ? 'Komeza ukoreshe ibikoresho bwite' : 'Keep moving with personal tools'}</b><span>{isKinyarwanda ? 'Intego zawe n’igereranya rya Guardian biraboneka mu gihe ubusabe bugisuzumwa.' : 'Your goals and Guardian scenarios are available while organization access is pending.'}</span></li>
        </ol>
        <Link href="/app/groups/start">{isKinyarwanda ? 'Ushaka amatsinda yo kuzigama? Tangiza cyangwa winjire mu Itsinda cyangwa Ikimina' : 'Looking for savings groups? Create or join an Itsinda or Ikimina'} <ArrowRight size={15}/></Link>
      </aside>
    </div>
  </div>
 </main>;
}
