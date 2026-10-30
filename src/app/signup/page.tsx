import {FUNDRAISING_ENABLED} from '@/lib/competition';
import {localDemoEnabled} from '@/server/auth';
import AuthScreen from '@/components/auth-screen';

export const metadata = { title: 'Create an account' };

const labels: Record<string, string> = {
  personal: 'personal finance',
  groups: 'a savings group',
  fundraising: 'community fundraising',
  cooperative: 'cooperative finance',
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; next?: string }>;
}) {
  const query = await searchParams;
  const workspace = ['personal', 'groups', 'fundraising', 'cooperative'].includes(
    query.workspace || ''
  )
    ? (query.workspace as 'personal' | 'groups' | 'fundraising' | 'cooperative')
    : undefined;
  const visibleWorkspace = workspace === 'fundraising' && !FUNDRAISING_ENABLED ? undefined : workspace;
  const next = query.next || (visibleWorkspace ? `/app/${visibleWorkspace}` : undefined);

  return (
    <AuthScreen
      mode="signup"
      localDemo={localDemoEnabled()}
      next={next}
      purpose={visibleWorkspace}
      intent={visibleWorkspace ? labels[visibleWorkspace] : undefined}
    />
  );
}
