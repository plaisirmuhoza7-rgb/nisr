import type { Metadata } from 'next';
import AboutClient from './about-client';

export const metadata: Metadata = {
  title: 'About HURIZA | Unified Financial Workspace for Rwanda',
  description:
    'Discover HURIZA: bridging Rwandan grassroots savings groups (Itsinda & Ikimina), agricultural cooperatives, personal household vaults, and verified community fundraising with deterministic mathematical clarity.',
};

export default function AboutPage() {
  return <AboutClient />;
}
