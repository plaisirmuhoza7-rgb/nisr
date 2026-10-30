'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,Check,CheckCircle2,Eye,EyeOff,HeartHandshake,Info,Mail,Phone,PiggyBank,ShieldCheck,Sparkles,UsersRound,type LucideIcon} from 'lucide-react';
import {browserSessionPersistence,createUserWithEmailAndPassword,onAuthStateChanged,sendEmailVerification,sendPasswordResetEmail,setPersistence,signInWithEmailAndPassword,signOut,updateProfile,type User} from 'firebase/auth';
import {firebaseAuth,firebaseClientConfigured,firebaseEmulatorEnabled} from '@/lib/firebase-client';
import {safeAccountRedirect,type AccountUser} from '@/lib/access';
import {BRAND} from '@/lib/brand';
import {useLanguage} from '@/lib/i18n/context';
import LanguageToggle from './language-toggle';
import BrandLogo from './brand-logo';
import s from './auth-screen.module.css';

type Mode='login'|'signup'|'forgot'|'verify';
type Purpose='personal'|'groups'|'cooperative'|'fundraising'|'impact';

const purposeIcons: Record<Purpose, LucideIcon> = {
 personal: Sparkles,
 groups: PiggyBank,
 cooperative: UsersRound,
 fundraising: HeartHandshake,
 impact: BriefcaseBusiness,
};

const purposeKeys: Purpose[] = ['personal', 'groups', 'cooperative', 'fundraising', 'impact'];

function isPurpose(value:unknown):value is Purpose{return purposeKeys.includes(value as Purpose);}

function readableError(error:unknown, isRw:boolean){
 const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
 if (isRw) {
   const rwMessages:Record<string,string>={
     'auth/invalid-credential':'Imeri cyangwa ijambobanga ntabwo bihuye. Ongera ugerageze.',
     'auth/user-not-found':'Imeri cyangwa ijambobanga ntabwo bihuye. Ongera ugerageze.',
     'auth/wrong-password':'Imeri cyangwa ijambobanga ntabwo bihuye. Ongera ugerageze.',
     'auth/email-already-in-use':'Hari indi konti isanzwe ikoresha iyi meri. Injira cyangwa uhindure ijambobanga.',
     'auth/weak-password':'Koresha ijambobanga rifite nibura inyuguti 10 zivanze n’imibare.',
     'auth/invalid-email':'Andika aderesi ya imeri ifite ireme.',
     'auth/too-many-requests':'Wagerageje inshuro nyinshi cyane. Tegereza gato maze wongere ugerageze.',
     'auth/network-request-failed':'Ntibyakunze kwihuza na seriveri. Genzura interineti yawe maze wongere ugerageze.',
     'auth/operation-not-allowed':'Kwinjira muri konti birimo gutunganywa. Ongera ugerageze mu kanya.',
     'auth/invalid-api-key':'Kwinjira muri konti birimo gutunganywa. Ongera ugerageze mu kanya.'
   };
   return rwMessages[code]||(error instanceof Error?error.message:'Ntitwabashije gusohoza iki cyifuzo. Ongera ugerageze.');
 }
 const messages:Record<string,string>={
   'auth/invalid-credential':'The email or password is incorrect. Please try again.',
   'auth/user-not-found':'The email or password is incorrect. Please try again.',
   'auth/wrong-password':'The email or password is incorrect. Please try again.',
   'auth/email-already-in-use':'An account already uses this email. Sign in or reset your password.',
   'auth/weak-password':'Use a longer password with a mix of letters, numbers and symbols.',
   'auth/invalid-email':'Enter a valid email address.',
   'auth/too-many-requests':'Too many attempts. Please wait a moment before trying again.',
   'auth/network-request-failed':'We could not connect. Check your connection and try again.',
   'auth/operation-not-allowed':'Account sign-in is being configured. Please try again later.',
   'auth/invalid-api-key':'Account sign-in is being configured. Please try again later.'
 };
 return messages[code]||(error instanceof Error?error.message:'We could not complete this request. Please try again.');
}

export default function AuthScreen({mode,next='',intent='',purpose:initialPurpose}:{mode:Mode;next?:string;intent?:string;purpose?:Purpose}){
 const { t, isKinyarwanda } = useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[showPassword,setShowPassword]=useState(false),[verificationUser,setVerificationUser]=useState<User|null>(null),[purpose,setPurpose]=useState<Purpose|undefined>(initialPurpose),[verifyPurpose,setVerifyPurpose]=useState<Purpose|undefined>(initialPurpose),[signupStep,setSignupStep]=useState<'purpose'|'details'>(initialPurpose?'details':'purpose');
 const [loginMethod,setLoginMethod]=useState<'email'|'phone'>('email');
 const [phone,setPhone]=useState(''),[pin,setPin]=useState('');
 const headingRef=useRef<HTMLHeadingElement>(null);
 const configured=firebaseClientConfigured();

 const selectedPurposeDef = purpose ? t.auth.purposes[purpose] : null;
 const verifyPurposeDef = verifyPurpose ? t.auth.purposes[verifyPurpose] : null;
 const SelectedIcon = purpose ? purposeIcons[purpose] : null;

 useEffect(()=>{if(mode!=='verify'||!configured)return;const savedPurpose=sessionStorage.getItem('huriza-signup-purpose');setVerifyPurpose(initialPurpose||(isPurpose(savedPurpose)?savedPurpose:undefined));return onAuthStateChanged(firebaseAuth(),setVerificationUser);},[mode,configured,initialPurpose]);
 useEffect(()=>{if(mode==='signup'&&signupStep==='details'&&!initialPurpose)headingRef.current?.focus();},[mode,signupStep,initialPurpose]);
 const intendedNext=(workspace?:Purpose)=>next||(workspace?`/app/${workspace}`:'/app');
 const verificationPath=()=>{const workspace=purpose||verifyPurpose;const destination=intendedNext(workspace);const params=new URLSearchParams();if(destination)params.set('next',destination);if(workspace)params.set('workspace',workspace);return '/verify-email'+(params.size?`?${params.toString()}`:'');};
 async function exchange(user:User){
  const idToken=await user.getIdToken(true);
  const savedPurpose=typeof window!=='undefined'?sessionStorage.getItem('huriza-signup-purpose'):null;
  const targetPurpose=((mode==='verify'?verifyPurpose:purpose)||(isPurpose(savedPurpose)?savedPurpose:undefined)) as Purpose|undefined;
  const response=await fetch('/api/session',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({idToken,workspace:targetPurpose})
  });
  let result: Record<string, unknown> | null = null;
  try {
    result = await response.json();
  } catch {
    // Non-JSON response
  }
  if(!response.ok) {
    throw new Error(
      (result && typeof result.error === 'string' ? result.error : '') ||
      (isKinyarwanda ? 'Ntibyakunze kwinjira muri konti yawe. Ongera ugerageze.' : 'Your sign-in could not be completed. Please try again.')
    );
  }
  const account=result?.user as AccountUser;
  await signOut(firebaseAuth());
  if(mode==='verify')sessionStorage.removeItem('huriza-signup-purpose');
  window.location.assign(safeAccountRedirect(intendedNext(targetPurpose),account));
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setSuccess('');
  if(mode==='login'&&loginMethod==='phone'){
   try{
    const res=await fetch('/api/session/phone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,pin})});
    const result=await res.json();
    if(!res.ok)throw new Error(result.error||(isKinyarwanda?'Nimero ya terefoni cyangwa PIN ntabwo bihuye. Ongera ugerageze.':'Invalid telephone number or PIN. Please try again.'));
    const account=result.user as AccountUser;
    const dest=intendedNext((account.homeWorkspace||'groups') as Purpose);
    window.location.assign(safeAccountRedirect(dest,account));
   }catch(err){setError(err instanceof Error?err.message:(isKinyarwanda?'Ntibyakunze kwinjira. Ongera ugerageze.':'Failed to sign in. Please try again.'));}finally{setBusy(false);}
   return;
  }
  const values=new FormData(event.currentTarget);const email=String(values.get('email')||'').trim(),password=String(values.get('password')||'');
  try{
   const auth=firebaseAuth();await setPersistence(auth,browserSessionPersistence);
   if(mode==='forgot'){await sendPasswordResetEmail(auth,email);setSuccess(isKinyarwanda?'Niba iyi meri ifite konti, ubutumwa bwo guhindura ijambobanga bwoherejwe.':'If an account uses this email, a password-reset link is on its way.');return;}
   if(mode==='signup'){
    const name=String(values.get('name')||'').trim();if(!purpose)throw new Error(isKinyarwanda?'Hitamo uko uteganya gukoresha HURIZA.':'Choose how you plan to use HURIZA.');if(name.length<2)throw new Error(isKinyarwanda?'Injiza izina wifuza gukoresha.':'Enter the name you would like to use.');if(password!==values.get('confirmation'))throw new Error(isKinyarwanda?'Amagambobanga ntabwo ahura.':'Your passwords do not match.');
    const created=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(created.user,{displayName:name});await sendEmailVerification(created.user);sessionStorage.setItem('huriza-signup-purpose',purpose);window.location.assign(verificationPath());return;
   }
   const credential=await signInWithEmailAndPassword(auth,email,password);if(!credential.user.emailVerified){window.location.assign(verificationPath());return;}await exchange(credential.user);
  }catch(err){setError(readableError(err, isKinyarwanda));}finally{setBusy(false);}
 }
 async function checkVerified(){setBusy(true);setError('');setSuccess('');try{const user=firebaseAuth().currentUser;if(!user)throw new Error(isKinyarwanda?'Ongera winjire kugira ngo urangize kwemeza imeri.':'Sign in again to finish verification.');await user.reload();if(!user.emailVerified)throw new Error(isKinyarwanda?'Imeri yawe ntiyaremejwe. Kanda ku murongo wo kwemeza mu butumwa bwawe maze wongere ugerageze.':'Your email has not been verified yet. Open the verification link, then try again.');await exchange(user);}catch(err){setError(readableError(err, isKinyarwanda));}finally{setBusy(false);}}
 async function resend(){setBusy(true);setError('');try{const user=firebaseAuth().currentUser;if(!user)throw new Error(isKinyarwanda?'Banza winjire.':'Please sign in first.');await sendEmailVerification(user);setSuccess(isKinyarwanda?'Ubutumwa bushya bwo kwemeza bwoherejwe.':'A new verification link has been sent.');}catch(err){setError(readableError(err, isKinyarwanda));}finally{setBusy(false);}}

 const title = mode === 'login' ? t.auth.login : mode === 'signup' ? t.auth.signup : mode === 'forgot' ? t.auth.forgot : t.auth.verify;

 return <main className={s.shell}>
  <aside className={`${s.story} ${mode==='signup'?s.storySignup:''}`}>
   <Link className={s.brand} href="/"><span className={s.mark}><BrandLogo size={28} priority /></span>{BRAND.name.toLowerCase()}</Link>
   <div className={s.storyCopy}>
    <div className={s.eyebrow}>{t.auth.story.eyebrow}</div>
    <h2 style={{ whiteSpace: 'pre-line' }}>{t.auth.story.heading}</h2>
    <p>{t.auth.story.sub}</p>
   </div>
  </aside>

  <section className={s.formSide}>
   <div className={s.panel}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <Link className={s.back} href="/"><ArrowLeft size={15}/> {t.auth.backToHuriza}</Link>
      <LanguageToggle compact />
    </div>
    {firebaseEmulatorEnabled()&&<div className={s.pill}>LOCAL TESTING · FIREBASE AUTH EMULATOR</div>}
    {mode==='verify'&&<div className={s.verify}><Mail size={26}/></div>}
    {mode==='signup'&&<div className={s.progress} aria-label={`Signup step ${signupStep==='purpose'?1:2} of 2`}><span className={signupStep==='details'?s.complete:''}/><span className={signupStep==='details'?s.active:''}/><small>{signupStep==='purpose'?t.auth.signup.step1:t.auth.signup.step2}</small></div>}
    <h1 ref={headingRef} tabIndex={-1}>{mode==='signup'&&signupStep==='details'?t.auth.signup.detailsTitle:title.title}</h1>
    <p className={s.sub}>{mode==='signup'&&signupStep==='details'?t.auth.signup.detailsSub:title.sub}{mode==='verify'&&verificationUser?.email&&<> {isKinyarwanda?'Twohereje ubutumwa kuri':'We sent the link to'} <strong>{verificationUser.email}</strong>.</>}</p>

    {mode==='signup'&&signupStep==='purpose'&&<div className={s.purposeGrid} role="group" aria-label={t.auth.labels.purposeChoose}>
      {purposeKeys.map((id, index)=>{
        const pDef = t.auth.purposes[id];
        const Icon = purposeIcons[id];
        return <button className={`${s.purposeCard} ${s[`purposeCard_${id}`]} ${purpose===id?s.purposeCardSelected:''}`} type="button" key={id} aria-pressed={purpose===id} onClick={()=>{setPurpose(id);setSignupStep('details');setError('');}}>
          <div className={s.purposeCardHeader}>
            <span className={s.purposeBadge}>0{index + 1}</span>
            <span className={s.purposeIcon}><Icon size={18}/></span>
          </div>
          <div className={s.purposeText}>
            <span className={s.purposeName}>{pDef.title}</span>
            <p className={s.purposeDesc}>{pDef.description}</p>
          </div>
          <span className={s.choose} aria-hidden="true">
            {purpose===id?<span className={s.selectionIndicator} aria-label={t.common.selected}><Check size={12}/></span>:<ArrowRight size={14}/>}
          </span>
        </button>;
      })}
    </div>}

    {mode==='signup'&&signupStep==='details'&&<div className={s.intent}>
      <div>
        <span className={s.selectedIcon}>{SelectedIcon&&<SelectedIcon size={18}/>}</span>
        <span><small>{t.auth.labels.selectedPurpose}</small><b>{selectedPurposeDef?.title||intent||'HURIZA account'}</b></span>
      </div>
      <button type="button" className={s.change} onClick={()=>setSignupStep('purpose')}>{t.common.change}</button>
      <p>{selectedPurposeDef?.note}</p>
      <small className={s.securityNote}><ShieldCheck size={14}/> {t.auth.securityNote}</small>
    </div>}

    {mode==='verify'&&verifyPurposeDef&&<div className={s.intent}>
      <b>{t.auth.labels.selectedPurpose}: {verifyPurposeDef.title}</b>
      <p>{verifyPurposeDef.note}</p>
    </div>}

    {!configured&&<div className={s.notice}>{isKinyarwanda?'Gufungura konti birimo gutunganywa. Garuka mu kanya.':'Account sign-in is being configured. Please check back soon.'}</div>}
    {error&&<div className={s.notice} role="alert">{error}</div>}
    {success&&<div className={`${s.notice} ${s.success}`} role="status"><CheckCircle2 size={17}/>{success}</div>}

    {mode==='signup'&&<div className={s.roleNotice}><Info size={16}/><span>{isKinyarwanda ? 'Icyitonderwa: Abayobozi b’amatsinda n’abategura imiryango nibo biyandikisha hano bakoresheje imeri. Abanyamuryango basanzwe bandikwa na Perezida cyangwa Umubitsi bakoresheje terefoni na PIN.' : 'President & Founder sign-up: Only group organizers create new accounts with email. Group members are registered directly by their leadership with their telephone and numeric PIN.'}</span></div>}

    {mode==='login'&&(
      <div className={s.loginTabs} role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={loginMethod==='email'}
          className={`${s.loginTab} ${loginMethod==='email'?s.loginTabActive:''}`}
          onClick={()=>{setLoginMethod('email');setError('');}}
        >
          <Mail size={15}/> {isKinyarwanda ? 'Umuyobozi (Imeri)' : 'President / Officer (Email)'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={loginMethod==='phone'}
          className={`${s.loginTab} ${loginMethod==='phone'?s.loginTabActive:''}`}
          onClick={()=>{setLoginMethod('phone');setError('');}}
        >
          <Phone size={15}/> {isKinyarwanda ? 'Umunyamuryango (Terefoni)' : 'Member (Phone & PIN)'}
        </button>
      </div>
    )}

    {mode==='verify'?(
      <>
        <button className={s.submit} disabled={busy||!configured||!verificationUser} onClick={()=>void checkVerified()}>{busy?t.auth.verify.checking:t.auth.verify.verifiedBtn}<ArrowRight size={17}/></button>
        <button className={s.secondary} disabled={busy||!configured||!verificationUser} onClick={()=>void resend()}>{t.auth.verify.resendBtn}</button>
        <p className={s.switch}><Link href={'/login'+(next?`?next=${encodeURIComponent(next)}`:'')}>{t.auth.backToSignIn}</Link></p>
      </>
    ):mode==='signup'&&signupStep==='purpose'?(
      <p className={s.switch}>{t.auth.switchLogin.split('?')[0]}? <Link href={'/login'+(next?`?next=${encodeURIComponent(next)}`:'')}>{t.common.signIn}</Link></p>
    ):(
      <form className={s.form} onSubmit={submit}>
        {mode==='login'&&loginMethod==='phone'?(
          <>
            <label className={s.field}>
              {isKinyarwanda ? 'Nimero ya terefoni (MTN / Airtel)' : 'Telephone number (MTN / Airtel)'}
              <div className={s.inputGroup}>
                <span className={s.phonePrefix}>+250</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={e=>setPhone(e.target.value)}
                  placeholder="0788 123 456"
                  disabled={busy}
                />
              </div>
            </label>
            <label className={s.field}>
              {isKinyarwanda ? 'Ijambobanga ry’imibare (PIN y’imibare 4-8)' : 'Numeric PIN (4-8 digits)'}
              <span className={s.inputWrap}>
                <input
                  name="pin"
                  type={showPassword?'text':'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  minLength={4}
                  maxLength={8}
                  required
                  value={pin}
                  onChange={e=>setPin(e.target.value.replace(/\D/g,''))}
                  placeholder="••••"
                  disabled={busy}
                />
                <button className={s.eye} type="button" aria-label={showPassword?t.auth.labels.hidePassword:t.auth.labels.showPassword} onClick={()=>setShowPassword(v=>!v)}>
                  {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
                </button>
              </span>
            </label>
          </>
        ):(
          <>
            {mode==='signup'&&<label className={s.field}>{t.auth.labels.fullName}<span className={s.inputWrap}><input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder={t.auth.labels.fullNamePlaceholder} disabled={busy||!configured}/></span></label>}
            <label className={s.field}>{t.auth.labels.email}<span className={s.inputWrap}><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder={t.auth.labels.emailPlaceholder} disabled={busy||!configured}/></span></label>
            {mode!=='forgot'&&<label className={s.field}>{t.auth.labels.password}<span className={s.inputWrap}><input name="password" type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?10:1} maxLength={128} placeholder={mode==='signup'?t.auth.labels.passwordPlaceholderSignup:t.auth.labels.passwordPlaceholderLogin} disabled={busy||!configured}/><button className={s.eye} type="button" aria-label={showPassword?t.auth.labels.hidePassword:t.auth.labels.showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>}
            {mode==='signup'&&<label className={s.field}>{t.auth.labels.confirmPassword}<span className={s.inputWrap}><input name="confirmation" type={showPassword?'text':'password'} autoComplete="new-password" required minLength={10} maxLength={128} placeholder={t.auth.labels.confirmPasswordPlaceholder} disabled={busy||!configured}/></span></label>}
            {mode==='login'&&<Link className={s.forgot} href="/forgot-password">{t.auth.labels.forgotPasswordLink}</Link>}
          </>
        )}
        <div className={s.formActions}>
          {mode==='signup'&&<button type="button" className={s.secondary} onClick={()=>setSignupStep('purpose')}><ArrowLeft size={15}/> {t.common.back}</button>}
          <button className={s.submit} disabled={busy||(loginMethod==='email'&&!configured)}>
            {busy ? t.common.working : mode==='signup' ? t.auth.signup.button : mode==='forgot' ? t.auth.forgot.button : (loginMethod==='phone' ? (isKinyarwanda ? 'Injira na Terefoni' : 'Sign in with Phone') : t.auth.login.button)}
            <ArrowRight size={17}/>
          </button>
        </div>
      </form>
    )}

    {mode==='login'&&<p className={s.switch}>{t.auth.switchSignup.split('?')[0]}? <Link href={'/signup'+(next?`?next=${encodeURIComponent(next)}`:'')}>{t.auth.signup.detailsTitle.replace('.', '')}</Link></p>}
    {mode==='signup'&&signupStep==='details'&&<p className={s.switch}>{t.auth.switchLogin.split('?')[0]}? <Link href={'/login'+(next?`?next=${encodeURIComponent(next)}`:'')}>{t.common.signIn}</Link></p>}
    {mode==='forgot'&&<p className={s.switch}><Link href="/login">{t.auth.backToSignIn}</Link></p>}
    <p className={s.fine}>{t.auth.footerNote} <Link href="/methodology">{t.footer.methodology}</Link>.</p>
   </div>
  </section>
 </main>;
}
