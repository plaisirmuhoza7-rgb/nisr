import AuthScreen from '@/components/auth-screen';
export const metadata={title:'Verify your email'};
export default async function VerifyEmail({searchParams}:{searchParams:Promise<{next?:string;workspace?:string}>}){
 const {next,workspace}=await searchParams;
 const purpose=workspace==='personal'||workspace==='groups'||workspace==='fundraising'||workspace==='cooperative'?workspace:undefined;
 return <AuthScreen mode="verify" next={next} purpose={purpose}/>;
}
