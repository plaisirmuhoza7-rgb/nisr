import type { Metadata } from 'next';
import PublicInformation from '@/components/public-information';

export const metadata: Metadata = {
  title: 'About HURIZA',
  description: 'Learn about the HURIZA financial workspace prototype, its savings models, Guardian scenarios and evidence boundaries.',
};

export default function AboutPage() {
  return <PublicInformation kind="about" />;
}
