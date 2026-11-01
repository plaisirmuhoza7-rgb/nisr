import {redirect} from 'next/navigation';
import {currentUser} from '@/server/auth';
import SavingsGroupOnboarding from '@/components/savings-group-onboarding';
import {startGoogleSheetsRunner} from '@/server/sheets/runner';
import Link from 'next/link';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import s from '@/components/organization-onboarding.module.css';
export const metadata={title:'Create or join a savings group'};
export const dynamic='force-dynamic';
export default async function StartSavingsGroup(){const user=await currentUser();if(!user)redirect('/login?next=%2Fapp%2Fgroups%2Fstart');if(user.dedicatedWorkspace==='groups'||user.dedicatedWorkspace==='cooperative')redirect(`/app/${user.homeWorkspace}`);if(process.env.HURIZA_SHEETS_PRIMARY==='true'&&process.env.HURIZA_SHEETS_AUTO_SYNC==='true')startGoogleSheetsRunner();const hasGroups=user.memberships.some(m=>m.orgId.startsWith('group-'));return <main className={s.shell}><header><Link className={s.brand} href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><BrandLogo size={28} /> HURIZA</Link><Link href="/app/personal">Your workspace <ArrowRight size={16}/></Link></header><div className={s.content}><Link className={s.back} href="/app/personal"><ArrowLeft size={15}/> Back to personal finance</Link><span className={s.eyebrow}>BUILD A SHARED FINANCIAL RHYTHM</span><h1>Save together.<br/>Start with clear rules.</h1><p className={s.intro}>Create a new group or join by invitation. Itsinda accumulates savings for a cycle; Ikimina schedules a recipient each round. All financial activity in this prototype is simulated.</p>{hasGroups&&<p className={s.intro}>You already belong to a savings group. <Link className={s.button} href="/app/groups">Open your saved groups <ArrowRight size={15}/></Link></p>}<SavingsGroupOnboarding name={user.name}/></div></main>}
