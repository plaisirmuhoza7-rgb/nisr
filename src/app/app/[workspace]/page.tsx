import {notFound,redirect} from 'next/navigation';
import {currentUser} from '@/server/auth';
import type {Workspace} from '@/lib/access';
import HurizaApp from '@/components/huriza-app';
const routes=['personal','groups','fundraising','cooperative','impact','guardian','simulator','connect'];
export default async function WorkspacePage({params}:{params:Promise<{workspace:string}>}){const {workspace}=await params;if(!routes.includes(workspace))notFound();const user=await currentUser();if(!user)redirect(`/login?next=${encodeURIComponent('/app/'+workspace)}`);if(!user.workspaces.includes(workspace as Workspace))redirect('/app');return <HurizaApp workspace={workspace}/>;}
