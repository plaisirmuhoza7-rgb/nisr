'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeInfo, CircleHelp, FileText, HandHeart, Leaf, LockKeyhole, Mail, ShieldCheck, Users } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import LanguageToggle from './language-toggle';
import styles from './public-information.module.css';

export type PublicInformationKind = 'about' | 'contact' | 'privacy' | 'terms';

function AboutContent({ isRw }: { isRw: boolean }) {
  if (isRw) {
    return <>
      <section className={styles.featurePanel}>
        <div className={styles.panelIcon}><Users size={20} /></div>
        <div>
          <span className={styles.panelEyebrow}>URUBANGA RUMWE RUHUJE BYOSE</span>
          <h2>Imibereho y’imari itandukanye. Umucyo kuri bose.</h2>
          <p>Urubuga rwa HURIZA ruhuza intego bwite, amatsinda yo kuzigama, gukusanya inkunga, amakoperative na raporo z’imishinga muri gahunda imwe. Kwinjira mu mwanya bishingira ku burenganzira bwemejwe.</p>
        </div>
      </section>
      <div className={styles.sectionGrid}>
        <article className={styles.infoCard}>
          <div className={styles.cardIcon}><HandHeart size={18}/></div>
          <h2>Imyanya itanu y’ingenzi</h2>
          <p>Imari bwite ifasha ku ntego zawe. Amatsinda yo kuzigama akurikirana ibikorwa by’amatsinda. Gukusanya inkunga bitunganya ubukangurambaga n’isuzuma. Koperative igaragaza imigabane n’ibyemezo. Gahunda z’iterambere zerekana raporo z’imishinga.</p>
          <Link href="/signup">Fungura konti <ArrowRight size={15}/></Link>
        </article>
        <article className={styles.infoCard}>
          <div className={styles.cardIcon}><Users size={18}/></div>
          <h2>Itsinda n’Ikimina</h2>
          <p>Itsinda rigaragaza uburyo bwo kubitsa buhoro buhoro aho abanyamuryango bagabana ubwizigame ku mpera z’icyiciro. Ikimina cyo gihererekanya imisanzu kuri buri nshuro ku munyamuryango utahiwe. Ni uburyo bubiri butandukanye mu micungire y’imari.</p>
          <Link href="/demo">Reba igerageza <ArrowRight size={15}/></Link>
        </article>
        <article className={styles.infoCard}>
          <div className={styles.cardIcon}><BadgeInfo size={18}/></div>
          <h2>Guardian isobanura imyanzuro</h2>
          <p>Guardian ikoresha imibare ifatika kugira ngo ifashe abanyamuryango gusuzuma amafaranga ahari, ikigega kirinzwe n’icyemezo cyifujwe mbere yo kugifata. Ntiyemeza inguzanyo yonyine.</p>
          <Link href="/demo#guardian">Menya byinshi kuri Guardian <ArrowRight size={15}/></Link>
        </article>
      </div>
      <div className={styles.notePanel}>
        <ShieldCheck size={18}/>
        <p><b>Igerageza riracyakomeza.</b> Amwe mu mashusho agaragaza ibikorwa by’icyitegererezo. Ntibikwiriye gufatwa nk’amakuru nyakuri y’abaturage cyangwa amatsinda ariho.</p>
      </div>
    </>;
  }

  return <>
    <section className={styles.featurePanel}>
      <div className={styles.panelIcon}><Users size={20} /></div>
      <div><span className={styles.panelEyebrow}>ONE CONNECTED ECOSYSTEM</span><h2>Different financial lives. Shared clarity.</h2><p>The HURIZA prototype brings personal goals, community savings, fundraising, cooperatives and aggregate programme reporting into one connected product direction. Workspace access follows account and organization permissions.</p></div>
    </section>
    <div className={styles.sectionGrid}>
      <article className={styles.infoCard}><div className={styles.cardIcon}><HandHeart size={18}/></div><h2>Five practical workspaces</h2><p>Personal finance supports individual goals. Savings Groups models group activity. Fundraising organizes campaigns and review steps. Cooperative views support financial records and proposals. Programs supports authorized activity reporting.</p><Link href="/signup">Explore account setup <ArrowRight size={15}/></Link></article>
      <article className={styles.infoCard}><div className={styles.cardIcon}><Users size={18}/></div><h2>Itsinda and Ikimina</h2><p>Itsinda represents an accumulating cycle in which eligible savings can be shared at the end of a defined period. Ikimina represents contributions collected by round and rotated to a scheduled recipient. They are separate group models with different accounting flows.</p><Link href="/demo">See the guided demo <ArrowRight size={15}/></Link></article>
      <article className={styles.infoCard}><div className={styles.cardIcon}><BadgeInfo size={18}/></div><h2>Guardian explains scenarios</h2><p>Guardian’s demonstration uses deterministic calculations over stated scenario inputs to help people examine liquidity, reserves and a proposed decision. It does not approve loans autonomously or guarantee an outcome.</p><Link href="/demo#guardian">Explore Guardian <ArrowRight size={15}/></Link></article>
    </div>
    <div className={styles.notePanel}><ShieldCheck size={18}/><p><b>Prototype in progress.</b> Some screens illustrate product workflows with synthetic records. They should not be read as claims about users, partners or programme results.</p></div>
  </>;
}

function ContactContent({ isRw }: { isRw: boolean }) {
  if (isRw) {
    return <>
      <section className={styles.contactPanel}>
        <div className={styles.contactIcon}><Mail size={21}/></div>
        <div>
          <span className={styles.panelEyebrow}>KUVUGANA NATWE</span>
          <h2>Hamagara cyangwa utwandikire ako kanya.</h2>
          <p>Turi hano gufatanya nawe: hamagara kuri <b>0782557168</b>, ohereza imeri kuri <b>plaisirmuhoza7@gmail.com</b>, cyangwa koresha fomu y’itumanaho kuri uru rubuga.</p>
        </div>
      </section>
      <div className={styles.contactGrid}>
        <article className={styles.contactCard}>
          <span className={styles.cardIcon}><Mail size={18}/></span>
          <div>
            <h3>Fomu y’Itumanaho</h3>
            <p>Ohereza ubutumwa binyuze kuri Resend, bwakirwa n’abayobozi b’umushinga ako kanya.</p>
            <Link href="/contact">Fungura fomu <ArrowUpRight size={15}/></Link>
          </div>
        </article>
        <article className={styles.contactCard}>
          <span className={styles.cardIcon}><HandHeart size={18}/></span>
          <div>
            <h3>Igerageza ry’urubuga</h3>
            <p>Gerageza uburyo bw’icyitegererezo. Imibare yose iri hano ni iy’igerageza kandi iguma muri brawuza.</p>
            <Link href="/demo">Fungura igerageza <ArrowUpRight size={15}/></Link>
          </div>
        </article>
        <article className={styles.contactCard}>
          <span className={styles.cardIcon}><LockKeyhole size={18}/></span>
          <div>
            <h3>Guhindura ijambobanga</h3>
            <p>Koresha uburyo bwo gusubirana ijambobanga kuri konti ya Firebase mu gihe waba wayibagiwe.</p>
            <Link href="/forgot-password">Gusubirana ijambobanga <ArrowUpRight size={15}/></Link>
          </div>
        </article>
      </div>
      <div className={styles.notePanel}>
        <CircleHelp size={18}/>
        <p><b>Nomero ya telefone:</b> Hamagara <b>0782557168</b> (Kuwa Mbere - Kuwa Gatandatu, 8:00 - 18:00 CAT) cyangwa utwandikire kuri WhatsApp.</p>
      </div>
    </>;
  }

  return <>
    <section className={styles.contactPanel}><div className={styles.contactIcon}><Mail size={21}/></div><div><span className={styles.panelEyebrow}>PUBLIC CONTACT DETAILS</span><h2>Connect directly with the HURIZA team.</h2><p>Call our direct hotline at <b>0782557168</b>, email <b>plaisirmuhoza7@gmail.com</b>, or submit a message through the dedicated contact form.</p></div></section>
    <div className={styles.contactGrid}>
      <article className={styles.contactCard}><span className={styles.cardIcon}><Mail size={18}/></span><div><h3>Send a direct message</h3><p>Fill out our clean and secure contact form with instant Resend email routing.</p><Link href="/contact">Open contact form <ArrowUpRight size={15}/></Link></div></article>
      <article className={styles.contactCard}><span className={styles.cardIcon}><HandHeart size={18}/></span><div><h3>Explore the product</h3><p>Try the guided demonstration. Its figures and financial actions are synthetic and stay within the prototype.</p><Link href="/demo">Open the guided demo <ArrowUpRight size={15}/></Link></div></article>
      <article className={styles.contactCard}><span className={styles.cardIcon}><LockKeyhole size={18}/></span><div><h3>Recover account access</h3><p>Use the password recovery flow for a Firebase account when authentication is configured.</p><Link href="/forgot-password">Password recovery <ArrowUpRight size={15}/></Link></div></article>
    </div>
    <div className={styles.notePanel}><CircleHelp size={18}/><p><b>Phone & WhatsApp:</b> Call <b>0782557168</b> (+250 782 557 168) Monday through Saturday 8:00 AM – 6:00 PM CAT.</p></div>
  </>;
}

function PrivacyContent({ isRw }: { isRw: boolean }) {
  if (isRw) {
    return <>
      <div className={styles.notice}><BadgeInfo size={18}/><p>Uru rupapuro rugamije gusobanura imikorere y’iri gerageza, ntabwo rwiswe amategeko arambye y’umutungo w’amakuru. Amategeko nyakuri azasuzumwa mbere yo gutangiza serivisi ku mugaragaro.</p></div>
      <div className={styles.detailSections}>
        <section className={styles.detailCard}><span className={styles.detailNumber}>01</span><div><h2>Kwinjira muri konti</h2><p>Kwinjira bikoresha Firebase Authentication hifashishijwe imeri n’ijambobanga. Porogaramu isaba kwemeza imeri mbere yo gufungura umwanya wemewe w’umukoresha.</p></div></section>
        <section className={styles.detailCard}><span className={styles.detailNumber}>02</span><div><h2>Inyandiko za konti n’imyanya</h2><p>Ububiko bwa porogaramu bubika indangamuntu ya konti (Firebase UID), amazina, imeri, n’amatsinda umuntu arimo. Konti nshya zitangirana n’umwanya bwite w’ubwizigame.</p></div></section>
        <section className={styles.detailCard}><span className={styles.detailNumber}>03</span><div><h2>Umutekano n’igihe cyo kwinjira</h2><p>Iyo umaze kwinjira, ububiko bwa HURIZA butanga kuki itekanye y’amasaha 8 (HttpOnly cookie). Gusohoka bikuraho iyo kuki muri brawuza ako kanya.</p></div></section>
        <section className={styles.detailCard}><span className={styles.detailNumber}>04</span><div><h2>Amakuru y’icyitegererezo</h2><p>Ibikorwa by’imari, USSD na MoMo byerekanwe hano ni iby’icyitegererezo gusa. Nta mafaranga nyakuri yimurwa cyangwa akurwa kuri konti iyo ari yo yose.</p></div></section>
      </div>
    </>;
  }

  return <>
    <div className={styles.notice}><BadgeInfo size={18}/><p>This page is an implementation overview for a prototype, not a finalized production privacy policy or legal advice. Operators, retention periods, hosting locations and production contact details still need review.</p></div>
    <div className={styles.detailSections}>
      <section className={styles.detailCard}><span className={styles.detailNumber}>01</span><div><h2>Authentication</h2><p>Account sign-in uses Firebase Authentication with email and password. The application requires email verification before establishing an authenticated HURIZA session. Passwords are managed by Firebase Authentication rather than stored as HURIZA application passwords.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>02</span><div><h2>Account and workspace records</h2><p>The application database stores an account identifier (the Firebase UID), name, email, account status and organization memberships. Organization onboarding requests also store the submitted purpose, organization name, location and stated needs, scoped to the requesting account. Membership records identify an organization and assigned role. Newly registered accounts start with an empty personal workspace; choosing a purpose does not grant organization permissions.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>03</span><div><h2>Application session</h2><p>After Firebase verifies a sign-in, HURIZA creates a server-managed session. The browser receives an HttpOnly cookie, while the application database stores a hash of the session token and its expiry. The current configured session lifetime is eight hours. Sign-out removes the session record and cookie.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>04</span><div><h2>Demonstration finance data</h2><p>Financial activity, USSD/MoMo operations and product preview records in the prototype are synthetic examples. They are not evidence of a person’s real financial activity. The public USSD simulator runs only in the browser and does not send a telecom request or move money.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>05</span><div><h2>Development and emulator use</h2><p>A local Firebase Authentication Emulator can be configured for development and should be clearly labeled wherever enabled. Emulator and test accounts are distinct from production authentication; test-account status is represented in application data. Do not treat a local emulator as a live service.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>06</span><div><h2>Items requiring production review</h2><p>This prototype does not publish a verified operator contact, retention schedule or hosting-location statement. Those details, along with production data handling and any applicable privacy obligations, must be reviewed and documented before launch.</p></div></section>
    </div>
    <div className={styles.notePanel}><LockKeyhole size={18}/><p><b>Access is checked on the server.</b> The prototype uses verified identity and server-managed membership for private workspace access. See the <Link href="/terms">prototype terms</Link> for demonstration limits.</p></div>
  </>;
}

function TermsContent({ isRw }: { isRw: boolean }) {
  if (isRw) {
    return <>
      <div className={styles.notice}><BadgeInfo size={18}/><p>Amakuru ajyanye n’imikoreshereze y’iri gerageza rya HURIZA. Ntabwo ari amasezerano y’ubucuruzi cyangwa serivisi ifunguye ku mugaragaro.</p></div>
      <div className={styles.detailSections}>
        <section className={styles.detailCard}><span className={styles.detailNumber}>01</span><div><h2>Imikoreshereze y’icyitegererezo</h2><p>HURIZA iracyari umushinga uri mu igerageza. Ingero zose zigaragaza uko porogaramu izakora kandi ibyerekanwe bishobora guhinduka uko imirimo ikomeza.</p></div></section>
        <section className={styles.detailCard}><span className={styles.detailNumber}>02</span><div><h2>Ibikorwa by’imari by’icyitegererezo</h2><p>Ubwizigame, imisanzu, inguzanyo, ubwishyu n’impano byerekanwe hano ni ibyo gusobanura gusa. Nta mafaranga nyakuri yimurwa cyangwa amadeni y’ukuri avukamo.</p></div></section>
        <section className={styles.detailCard}><span className={styles.detailNumber}>03</span><div><h2>Kode ya USSD (*700#)</h2><p><b>*700# igaragazwa ni iy’igerageza gusa, si kode ifunguye mu mirongo y’itumanaho mu Rwanda.</b> Menu ya telefone ikorera muri brawuza gusa.</p></div></section>
        <section className={styles.detailCard}><span className={styles.detailNumber}>04</span><div><h2>Guardian n’imyanzuro y’imari</h2><p>Guardian yerekana ibarura ridasanzwe ry’ikigega n’amafaranga asigara. Ni igikoresho cyo gusobanura imyanzuro, ntabwo ari umujyanama w’imari cyangwa ubutegetsi bwemeza inguzanyo.</p></div></section>
      </div>
    </>;
  }

  return <>
    <div className={styles.notice}><BadgeInfo size={18}/><p>Prototype-use information as of 25 October 2026. It is not a finalized contract for a live or commercial service; legal and operational review is still required.</p></div>
    <div className={styles.detailSections}>
      <section className={styles.detailCard}><span className={styles.detailNumber}>01</span><div><h2>Demonstration use</h2><p>HURIZA is presented here as an evolving product prototype. Examples may describe intended workflows or show synthetic records. Availability, completeness and behavior can change as implementation continues.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>02</span><div><h2>Synthetic financial activity</h2><p>Preview figures and simulated savings, contributions, loans, repayments, donations, USSD and MoMo actions are illustrative. They do not move real money, create a real financial obligation or establish the financial position of an actual person or organization.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>03</span><div><h2>Proposed shortcode</h2><p><b>*700# is proposed for demonstration and is not a live registered telecom shortcode.</b> The public USSD interface is an on-page interactive prototype; it does not connect to a mobile operator or payment provider.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>04</span><div><h2>Guardian and financial decisions</h2><p>Guardian demonstrates deterministic scenario calculations from stated inputs. It is an explanatory tool, not an autonomous lender, financial adviser, approval authority or guarantee of safety or outcome. People and authorized organizations remain responsible for their decisions.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>05</span><div><h2>Accounts and organization access</h2><p>Account sign-up purpose expresses user intent; it does not assign a role in an existing organization. Private workspaces rely on verified accounts and authorized memberships. Users must not attempt to access another person’s or organization’s records without authorization.</p></div></section>
      <section className={styles.detailCard}><span className={styles.detailNumber}>06</span><div><h2>Live service terms</h2><p>Pricing, service commitments, commercial terms, operator contacts, production privacy terms and live transaction policies are not finalized on this prototype site.</p></div></section>
    </div>
    <div className={styles.notePanel}><FileText size={18}/><p>For the related account and data overview, read <Link href="/privacy">Privacy overview</Link>. No verified public contact channel is currently published.</p></div>
  </>;
}

export default function PublicInformation({ kind }: { kind: PublicInformationKind }) {
  const { t, isKinyarwanda } = useLanguage();

  const titles: Record<PublicInformationKind, { title: string; eyebrow: string; summary: string; icon: typeof FileText; review?: string }> = {
    about: {
      title: isKinyarwanda ? 'Ishusho ifatika y’ubwizigame n’imari rusange.' : 'A clearer view of community finance.',
      eyebrow: isKinyarwanda ? 'ABO TURIBO' : 'ABOUT HURIZA',
      summary: isKinyarwanda ? 'HURIZA ni urubuga rw’icyitegererezo rugamije gufasha abantu ku giti cyabo, amatsinda yo kuzigama n’abafatanyabikorwa babo.' : 'HURIZA is a financial workspace prototype for individuals, savings groups and the organizations that work alongside them.',
      icon: Leaf,
    },
    contact: {
      title: isKinyarwanda ? 'Twandikire cyangwa uduhamagare.' : 'Get in touch with HURIZA.',
      eyebrow: isKinyarwanda ? 'UBWFASHA NO KUVUGANA NATWE' : 'CONTACT & SUPPORT',
      summary: isKinyarwanda ? 'Hamagara kuri 0782557168 cyangwa wohereze imeri kuri plaisirmuhoza7@gmail.com kugira ngo tuvugane.' : 'Connect directly with us by calling 0782557168 or emailing plaisirmuhoza7@gmail.com.',
      icon: CircleHelp,
    },
    privacy: {
      title: isKinyarwanda ? 'Uko amakuru akoreshwa muri iri gerageza.' : 'How this prototype handles information.',
      eyebrow: isKinyarwanda ? 'UMUTEKANO W’AMAKURU' : 'PRIVACY OVERVIEW',
      summary: isKinyarwanda ? 'Incamake y’uburyo amakuru ya konti n’ay’icyitegererezo akoreshwa muri iyi porogaramu.' : 'A plain-language overview of the authentication and demonstration data currently represented in this application.',
      icon: LockKeyhole,
      review: isKinyarwanda ? 'Incamake y’igerageza · amategeko arambye azasuzumwa' : 'Prototype overview · production privacy terms require review',
    },
    terms: {
      title: isKinyarwanda ? 'Gukoresha igerageza rya HURIZA.' : 'Using the HURIZA prototype.',
      eyebrow: isKinyarwanda ? 'AMATEGEKO N’AMABWIRIZA' : 'TERMS OF USE',
      summary: isKinyarwanda ? 'Izi nyandiko zisobanura imbibi z’iri gerageza. Ntabwo ari amasezerano arambye y’ubucuruzi.' : 'These notes explain the limits of the current demonstration. They are not finalized commercial service terms.',
      icon: FileText,
      review: isKinyarwanda ? 'Amabwiriza y’igerageza' : 'Prototype terms · commercial terms require review',
    },
  };

  const info = titles[kind];
  const Icon = info.icon;

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">{t.common.skipToContent}</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="HURIZA home">
          <span className={styles.brandMark}><Leaf size={19}/></span>
          <span>HURIZA<small>{isKinyarwanda ? 'UMUCYO MU MARI' : 'FINANCIAL CLARITY'}</small></span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <LanguageToggle />
          <nav className={styles.nav} aria-label="Main navigation">
            <Link href="/">{t.nav.home}</Link>
            <Link href="/demo">{t.nav.demo}</Link>
            <Link href="/signup" className={styles.navCta}>{t.common.signUp} <ArrowRight size={14}/></Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className={styles.main}>
        <div className={styles.breadcrumb}>
          <Link href="/"><ArrowLeft size={14}/> {isKinyarwanda ? 'Ahabanza' : 'HURIZA home'}</Link>
          <span>/</span>
          <span>{info.eyebrow}</span>
        </div>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{info.eyebrow}</span>
            <h1>{info.title}</h1>
            <p>{info.summary}</p>
            {info.review && <span className={styles.reviewTag}><BadgeInfo size={14}/>{info.review}</span>}
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <span className={styles.artRing}/>
            <span className={styles.artRingInner}/>
            <span className={styles.artIcon}><Icon size={28}/></span>
            <span className={styles.artDot}/>
          </div>
        </section>
        {kind === 'about' && <AboutContent isRw={isKinyarwanda}/>}
        {kind === 'contact' && <ContactContent isRw={isKinyarwanda}/>}
        {kind === 'privacy' && <PrivacyContent isRw={isKinyarwanda}/>}
        {kind === 'terms' && <TermsContent isRw={isKinyarwanda}/>}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div>
            <Link href="/" className={styles.footerBrand}><span className={styles.brandMark}><Leaf size={17}/></span> HURIZA</Link>
            <p>{t.common.brandTagline}</p>
          </div>
          <nav className={styles.footerLinks} aria-label="Information pages">
            <Link href="/about">{t.footer.about}</Link>
            <Link href="/contact">{t.footer.contact}</Link>
            <Link href="/privacy">{t.footer.privacy}</Link>
            <Link href="/terms">{t.footer.terms}</Link>
          </nav>
          <div className={styles.footerLinks}>
            <Link href="/demo">{t.footer.productDemo}</Link>
            <Link href="/signup">{t.common.createAccount}</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} HURIZA</span>
          <span>{t.common.demoDisclosure}</span>
          <Link href="/methodology">{t.footer.methodology} <ArrowUpRight size={13}/></Link>
        </div>
      </footer>
    </div>
  );
}
