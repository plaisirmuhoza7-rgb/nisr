import {redirect} from 'next/navigation';
import {currentUser} from '@/server/auth';
import {getDb} from '@/server/db';
import {workspaceRequests} from '@/server/onboarding';
import {organizationPurpose} from '@/lib/onboarding';
import OrganizationOnboarding from '@/components/organization-onboarding';
export const metadata={title:'Organization onboarding'};
export const dynamic='force-dynamic';
export default async function Onboarding({searchParams}:{searchParams:Promise<{purpose?:string}>}){
 const purpose=organizationPurpose((await searchParams).purpose);
 const next='/app/onboarding'+(purpose?`?purpose=${purpose}`:'');
 const user=await currentUser();if(!user)redirect(`/login?next=${encodeURIComponent(next)}`);
 if(user.dedicatedWorkspace==='groups'||user.dedicatedWorkspace==='cooperative')redirect(`/app/${user.homeWorkspace}`);
 const requests=await workspaceRequests(await getDb(),{tenantId:user.tenantId,userId:user.id});
 return <OrganizationOnboarding name={user.name} purpose={purpose} requests={requests}/>;
}
