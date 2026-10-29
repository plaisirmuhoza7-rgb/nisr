import {redirect} from 'next/navigation';import AuthScreen from '@/components/auth-screen';import {currentUser} from '@/server/auth';import {safeAccountRedirect} from '@/lib/access';
export const metadata={title:'Sign in'};
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}){const {next}=await searchParams;const user=await currentUser();if(user)redirect(safeAccountRedirect(next,user));return <AuthScreen mode="login" next={next}/>;}
