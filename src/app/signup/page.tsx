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
  const next = query.next || (workspace ? `/app/${workspace}` : undefined);

  return (
    <AuthScreen
      mode="signup"
      next={next}
      purpose={workspace}
      intent={workspace ? labels[workspace] : undefined}
    />
  );
}
