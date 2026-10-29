import type { Metadata } from 'next';
import PublicInformation from '@/components/public-information';

export const metadata: Metadata = {
  title: 'Privacy overview',
  description: 'A prototype overview of HURIZA account, session and synthetic demonstration data handling.',
};

export default function PrivacyPage() {
  return <PublicInformation kind="privacy" />;
}
