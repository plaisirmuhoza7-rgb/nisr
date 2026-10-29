import {redirect} from 'next/navigation';
import {currentUser} from '@/server/auth';
export default async function AppPage(){const user=await currentUser();if(!user)redirect('/login');redirect(`/app/${user.homeWorkspace}`);}
