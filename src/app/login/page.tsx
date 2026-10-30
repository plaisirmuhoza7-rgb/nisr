import {localDemoEnabled} from '@/server/auth';
import AuthScreen from '@/components/auth-screen';

export const metadata = { title: 'Sign in' };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthScreen mode="login" next={next} localDemo={localDemoEnabled()} />;
}
