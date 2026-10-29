import type { Metadata } from 'next';
import PublicInformation from '@/components/public-information';

export const metadata: Metadata = {
  title: 'Prototype terms',
  description: 'Read HURIZA prototype-use information, financial simulation limits and evidence disclosures.',
};

export default function TermsPage() {
  return <PublicInformation kind="terms" />;
}
