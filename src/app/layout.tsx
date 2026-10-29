import type {Metadata} from 'next';
import './globals.css';
import './workspace-theme.css';
import { LanguageProvider } from '@/lib/i18n/context';

export const metadata:Metadata={title:{default:'HURIZA — Community Financial Intelligence',template:'%s · HURIZA'},description:'Beyond Saving. Toward Financial Intelligence. A connected community finance demonstration for Rwanda.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>;}

