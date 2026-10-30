import {FUNDRAISING_ENABLED} from '@/lib/competition';
import GuidedDemo from '@/components/guided-demo';
export const metadata={title:'Explore the HURIZA demo',description:'Explore synthetic HURIZA workspaces, Guardian financial scenarios, and a simulated USSD menu. No real money.'};
export default async function DemoPage({searchParams}:{searchParams:Promise<{workspace?:string}>}){const {workspace}=await searchParams;const initialWorkspace=workspace==='personal'||workspace==='groups'||(FUNDRAISING_ENABLED&&workspace==='fundraising')||workspace==='cooperative'?workspace:'personal';return <GuidedDemo initialWorkspace={initialWorkspace}/>;}
