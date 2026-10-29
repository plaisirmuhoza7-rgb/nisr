'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, BatteryFull, Check, ChevronLeft, CircleHelp, CornerDownLeft, RotateCcw, Signal, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import styles from './ussd-demo.module.css';

type Screen = 'welcome' | 'savings' | 'groups' | 'loan' | 'loan-confirmed' | 'contributions' | 'repay' | 'repay-confirmed' | 'help' | 'exit' | 'invalid';

export default function UssdDemo({ compact = false }: { compact?: boolean }) {
  const { t, isKinyarwanda } = useLanguage();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [reply, setReply] = useState('');
  const [loanSimulated, setLoanSimulated] = useState(false);
  const [repaymentSimulated, setRepaymentSimulated] = useState(false);
  const [notice, setNotice] = useState('');
  const replyForm = useRef<HTMLFormElement>(null);

  function returnToMenu() {
    setScreen('welcome');
    setReply('');
    setNotice('');
  }

  function goBack() {
    setNotice('');
    if (screen === 'loan-confirmed') { setScreen('loan'); return; }
    if (screen === 'repay-confirmed') { setScreen('repay'); return; }
    returnToMenu();
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const choice = reply.trim();
    setNotice('');
    if (screen === 'welcome') {
      if (choice === '0') { setScreen('exit'); setReply(''); return; }
      const destinations: Record<string, Screen> = { '1': 'savings', '2': 'groups', '3': 'loan', '4': 'contributions', '5': 'repay', '6': 'help' };
      if (destinations[choice]) { setScreen(destinations[choice]); setReply(''); return; }
      setScreen('invalid'); setReply(''); return;
    }
    if (choice === '9') { goBack(); setReply(''); return; }
    if (choice === '0') { setScreen('exit'); setReply(''); return; }
    if (screen === 'loan') {
      if (choice === '1') { setScreen('loan-confirmed'); setLoanSimulated(true); setReply(''); return; }
      if (choice === '9') { returnToMenu(); return; }
      setScreen('invalid'); setReply(''); return;
    }
    if (screen === 'repay') {
      if (choice === '1') { setScreen('repay-confirmed'); setRepaymentSimulated(true); setReply(''); return; }
      if (choice === '9') { returnToMenu(); return; }
      setScreen('invalid'); setReply(''); return;
    }
    setScreen('invalid'); setReply('');
  }

  function cancel() {
    setNotice(isKinyarwanda ? 'Gukoresha USSD byarangiye. Kanda Ongera utangire.' : 'Session ended. Select Restart to begin again.');
    setScreen('exit');
    setReply('');
  }

  function restart() {
    setLoanSimulated(false);
    setRepaymentSimulated(false);
    setNotice(isKinyarwanda ? 'Igerageza rishya ritangijwe.' : 'Fresh local demo session started.');
    setScreen('welcome');
    setReply('');
  }

  return (
    <section className={`${styles.demo} ${compact ? styles.compactDemo : ''}`} aria-label="Interactive HURIZA USSD prototype">
      {!compact && <div className={styles.intro}>
        <span className={styles.kicker}>{isKinyarwanda ? 'GERAGEZA UBURYO BWA USSD' : 'TRY THE INTERACTIVE PROTOTYPE'}</span>
        <h2>{isKinyarwanda ? 'Menu yoroshye. Intambwe isobanutse.' : 'Simple menus. A clear next step.'}</h2>
        <p>{isKinyarwanda ? 'Gerageza kureba uko telefone isanzwe yakoreshwa mu kureba ubwizigame no gukurikirana amatsinda.' : 'Explore a sample feature-phone flow for checking savings and understanding group services. All interactions stay in this page.'}</p>
        <div className={styles.status}><span className={styles.statusDot} /> {isKinyarwanda ? 'Icyitegererezo gikorera hano' : 'Local interactive prototype'} <span className={styles.statusDivider} /> {isKinyarwanda ? 'Nta serivisi ifunguye' : 'No service connection'}</div>
        <div className={styles.disclosure}><CircleHelp size={16} /><span><b>{isKinyarwanda ? 'Kode *700# ni iy’igerageza.' : '*700# is proposed for demonstration.'}</b> {isKinyarwanda ? 'Ntabwo ari serivisi ifunguye mu itumanaho. Nta mafaranga cyangwa konti byimurwa.' : 'It is not a live registered telecom shortcode. No real account or money is connected.'}</span></div>
        <p className={styles.language}><b>{t.common.language}:</b> {isKinyarwanda ? 'Ikinyarwanda cyatunganyijwe hamwe n’Icyongereza.' : 'Bilingual prototype: English and authentic Kinyarwanda.'}</p>
      </div>}

      <div className={styles.deviceWrap}>
        <div className={styles.phone}>
          <div className={styles.phoneInset}>
            <div className={styles.speaker}><span /></div>
            <div className={styles.phoneScreen}>
              <div className={styles.statusBar}><span>HURIZA <b>·</b> USSD</span><span className={styles.signal}><Signal size={13} /><span>4G</span><BatteryFull size={15} /></span></div>
              <div className={styles.sessionHeader}><span><i className={styles.liveDot} /> {isKinyarwanda ? 'Igerageza' : 'Local demo'}</span><b>*700# <span>{isKinyarwanda ? 'igerageza' : 'proposed'}</span></b></div>
              <div className={styles.screenContent} aria-live="polite" aria-atomic="true">
                <ScreenContent screen={screen} loanSimulated={loanSimulated} repaymentSimulated={repaymentSimulated} onRestart={restart} isRw={isKinyarwanda} rwfCurrency={t.common.rwf} />
              </div>
              {notice && <div className={styles.notice} role="status">{notice}</div>}
              {screen !== 'exit' && <form ref={replyForm} className={styles.replyForm} onSubmit={submitReply}>
                <label htmlFor="ussd-reply">{screen === 'welcome' ? (isKinyarwanda ? 'Injiza umubare wa menu' : 'Enter a menu number') : screen === 'loan' || screen === 'repay' ? (isKinyarwanda ? 'Kanda 1 kugerageza · 9 kuri menu' : 'Enter 1 to simulate · 9 for menu') : (isKinyarwanda ? 'Kanda 9 kuri menu · 0 gusohoka' : 'Enter 9 for menu · 0 to exit')}</label>
                <div className={styles.inputRow}>
                  <input id="ussd-reply" type="text" inputMode="numeric" autoComplete="off" maxLength={2} value={reply} onChange={event => setReply(event.target.value.replace(/\D/g, ''))} aria-describedby="ussd-help" placeholder={isKinyarwanda ? 'Andika umubare' : 'Type a number'} />
                  <button type="submit" className={styles.sendButton} aria-label="Send USSD reply"><CornerDownLeft size={17} /><span>{isKinyarwanda ? 'Ohereza' : 'Reply'}</span></button>
                </div>
                <span id="ussd-help" className={styles.keyboardHint}>{isKinyarwanda ? 'Kanda Enter cyangwa Kanda Ohereza' : 'Press Enter or tap Reply'}</span>
              </form>}
              {screen === 'exit' && <button className={styles.reopenButton} type="button" onClick={restart}><RotateCcw size={14} /> {isKinyarwanda ? 'Ongera utangire igerageza' : 'Restart the demo'}</button>}
              <div className={styles.screenFoot}><span>{isKinyarwanda ? 'Amakuru y’icyitegererezo' : 'Illustrative synthetic records'}</span><span>{t.common.prototypeOnly}</span></div>
            </div>
            <div className={styles.deviceControls}>
              <div className={styles.controlLabels}>
                <button type="button" onClick={goBack} aria-label={t.common.back}><ChevronLeft size={15} /> {t.common.back}</button>
                <button type="button" onClick={cancel} aria-label={t.common.cancel}><X size={14} /> {t.common.cancel}</button>
              </div>
              <div className={styles.navPad}><button type="button" onClick={goBack} aria-label="Return to previous menu"><ArrowLeft size={17} /></button><span className={styles.navCenter} /><button type="button" onClick={restart} aria-label="Restart session"><RotateCcw size={15} /></button></div>
              <div className={styles.keypad} aria-label="Numeric keypad">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map(key => <button type="button" key={key} onClick={() => key === '*' ? setReply(current => current.slice(0, -1)) : key === '#' ? replyForm.current?.requestSubmit() : setReply(current => `${current}${key}`)} aria-label={key === '*' ? 'Delete last digit' : key === '#' ? 'Submit reply' : `Key ${key}`}>{key}<small>{key === '2' ? 'ABC' : key === '3' ? 'DEF' : key === '4' ? 'GHI' : key === '5' ? 'JKL' : key === '6' ? 'MNO' : key === '7' ? 'PQRS' : key === '8' ? 'TUV' : key === '9' ? 'WXYZ' : ''}</small></button>)}
              </div>
              <button className={styles.restartLink} type="button" onClick={restart}><RotateCcw size={13} /> {isKinyarwanda ? 'Ongera utangire bushya' : 'Restart with a fresh local session'}</button>
            </div>
            <div className={styles.chin}><span /></div>
          </div>
        </div>
        <span className={styles.deviceCaption}><span className={styles.captionLine} /> HURIZA USSD DEMO <span className={styles.captionLine} /></span>
      </div>
      {compact && <div className={styles.compactDisclosure}><span><b>*700# {isKinyarwanda ? 'ni iy’igerageza.' : 'is proposed, not live.'}</b> {t.common.demoDisclosure}</span></div>}
    </section>
  );
}

function ScreenContent({ screen, loanSimulated, repaymentSimulated, onRestart, isRw, rwfCurrency }: { screen: Screen; loanSimulated: boolean; repaymentSimulated: boolean; onRestart: () => void; isRw: boolean; rwfCurrency: string }) {
  if (screen === 'welcome') return <>
    <p className={styles.welcomeLine}>{isRw ? 'Murakaza neza kuri HURIZA' : 'Welcome to HURIZA'}</p>
    <p className={styles.menuTitle}>{isRw ? 'Hitamo umubare:' : 'Choose an option:'}</p>
    <ol className={styles.menuList}>
      <li><b>1</b> {isRw ? 'Ubwizigame bwanjye' : 'My savings'}</li>
      <li><b>2</b> {isRw ? 'Amatsinda yo kuzigama' : 'Savings groups'}</li>
      <li><b>3</b> {isRw ? 'Inguzanyo y’ingoboka' : 'Emergency loan'}</li>
      <li><b>4</b> {isRw ? 'Imisanzu yanjye' : 'My contributions'}</li>
      <li><b>5</b> {isRw ? 'Kwishyura inguzanyo' : 'Repay loan'}</li>
      <li><b>6</b> {isRw ? 'Ubufasha' : 'Help'}</li>
    </ol>
    <p className={styles.exitLine}><b>0</b> {isRw ? 'Sohoka' : 'Exit'}</p>
  </>;
  if (screen === 'savings') return <>
    <h3>{isRw ? 'Ubwizigame bwanjye' : 'My savings'} <span className={styles.syntheticPill}>{isRw ? 'ICYITEGEREREZO' : 'SYNTHETIC'}</span></h3>
    <p className={styles.bigAmount}>248,500 {rwfCurrency}</p>
    <p className={styles.screenCopy}>{isRw ? 'Ubwizigame buhari mu ntego bwite zose.' : 'Illustrative available savings across personal goals.'}</p>
    <div className={styles.screenDivider} />
    <p className={styles.screenCopy}><b>{isRw ? 'Intego y’amafaranga y’ishuri' : 'School fees goal'}</b><br />165,000 kuri 250,000 {rwfCurrency}<br /><span className={styles.progressTrack}><i /></span></p>
    <p className={styles.hintLine}>{isRw ? '9 Subira inyuma · 0 Sohoka' : '9 Back to menu · 0 Exit'}</p>
  </>;
  if (screen === 'groups') return <>
    <h3>{isRw ? 'Amatsinda yo kuzigama' : 'Savings groups'}</h3>
    <div className={styles.groupCard}><b>Itsinda Ubumwe</b><span>{isRw ? 'Itsinda ry’ubwizigame' : 'Itsinda · illustrative cycle'}</span></div>
    <p className={styles.screenCopy}>{isRw ? 'Icyiciro cya 7 kuri 12 · buri kwezi' : 'Round 7 of 12 · monthly'}<br />{isRw ? 'Abanyamuryango 24' : '24 example members'}</p>
    <div className={styles.balanceLine}><span>{isRw ? 'Amafaranga y’itsinda' : 'Group cash'}</span><b>3,250,000 {rwfCurrency}</b></div>
    <div className={styles.balanceLine}><span>{isRw ? 'Ikigega kirinzwe' : 'Reserve held'}</span><b>1,000,000 {rwfCurrency}</b></div>
    <p className={styles.hintLine}>{isRw ? '9 Subira inyuma · 0 Sohoka' : '9 Back to menu · 0 Exit'}</p>
  </>;
  if (screen === 'loan') return <>
    <h3>{isRw ? 'Inguzanyo y’ingoboka' : 'Emergency loan'}</h3>
    <p className={styles.screenCopy}>{isRw ? 'Ubusabe bw’icyitegererezo. Inguzanyo nyakuri isuzumwa n’itsinda.' : 'Example request only. A real loan needs group review and authorization.'}</p>
    <div className={styles.amountPanel}><span>{isRw ? 'Ingero y’amafaranga' : 'Example amount'}</span><b>50,000 {rwfCurrency}</b><small>{isRw ? 'Icyitegererezo · nta mafaranga yoherejwe' : 'Illustrative · no funds are sent'}</small></div>
    <p className={styles.menuChoice}><b>1</b> {isRw ? 'Gerageza gusaba' : 'Simulate a request'}</p>
    <p className={styles.menuChoice}><b>9</b> {isRw ? 'Subira inyuma' : 'Back to menu'}</p>
    {loanSimulated && <p className={styles.inlineSuccess}><Check size={13} /> {isRw ? 'Ubusabe bw’icyitegererezo bwanditswe.' : 'Request simulation recorded on this screen.'}</p>}
  </>;
  if (screen === 'loan-confirmed') return <>
    <div className={styles.successIcon}><Check size={20} /></div>
    <h3>{isRw ? 'Igerageza ryarangiye' : 'Simulation complete'}</h3>
    <p className={styles.screenCopy}>{isRw ? `Ubusabe bwa 50,000 ${rwfCurrency} bwanditswe nka bitegereje gusuzumwa.` : 'A sample request for RWF 50,000 is marked pending review in this local prototype.'}</p>
    <p className={styles.noticeBox}>{isRw ? 'Iyi si inguzanyo nyakuri. Nta kintu cyatanzwe.' : 'This is not a real loan application. Nothing was submitted or disbursed.'}</p>
    <p className={styles.hintLine}>{isRw ? '9 Subira inyuma · 0 Sohoka' : '9 Back to loan menu · 0 Exit'}</p>
  </>;
  if (screen === 'contributions') return <>
    <h3>{isRw ? 'Imisanzu yanjye' : 'My contributions'} <span className={styles.syntheticPill}>{isRw ? 'ICYITEGEREREZO' : 'SYNTHETIC'}</span></h3>
    <p className={styles.screenCopy}>{isRw ? 'Imisanzu iheruka y’icyitegererezo:' : 'Recent illustrative entries:'}</p>
    <div className={styles.contribution}><span>24 Ukw · Umusanzu w’itsinda</span><b>5,000 {rwfCurrency}</b></div>
    <div className={styles.contribution}><span>17 Ukw · Umusanzu w’itsinda</span><b>5,000 {rwfCurrency}</b></div>
    <div className={styles.contribution}><span>10 Ukw · Umusanzu w’itsinda</span><b>5,000 {rwfCurrency}</b></div>
    <p className={styles.screenCopy}>{isRw ? 'Inyandiko zose ni iz’icyitegererezo.' : 'These records are examples only.'}</p>
    <p className={styles.hintLine}>{isRw ? '9 Subira inyuma · 0 Sohoka' : '9 Back to menu · 0 Exit'}</p>
  </>;
  if (screen === 'repay') return <>
    <h3>{isRw ? 'Kwishyura inguzanyo' : 'Repay loan'}</h3>
    <div className={styles.amountPanel}><span>{isRw ? 'Ayo ugomba kwishyura' : 'Example outstanding balance'}</span><b>30,000 {rwfCurrency}</b><small>{isRw ? 'Ku itariki 30 Ukw · icyitegererezo' : 'Due 30 Oct · illustrative schedule'}</small></div>
    <p className={styles.menuChoice}><b>1</b> {isRw ? 'Gerageza kwishyura' : 'Simulate a repayment'}</p>
    <p className={styles.menuChoice}><b>9</b> {isRw ? 'Subira inyuma' : 'Back to menu'}</p>
    {repaymentSimulated && <p className={styles.inlineSuccess}><Check size={13} /> {isRw ? 'Kwishyura kw’icyitegererezo kwanditswe.' : 'Repayment simulation recorded on this screen.'}</p>}
    <p className={styles.noticeBox}>{isRw ? 'Nta sosiyete yo kwishyura ihuje. Nta mafaranga yimurwa.' : 'No payment provider is connected. No money moves.'}</p>
  </>;
  if (screen === 'repay-confirmed') return <>
    <div className={styles.successIcon}><Check size={20} /></div>
    <h3>{isRw ? 'Ubwishyu bw’icyitegererezo' : 'Repayment simulated'}</h3>
    <p className={styles.screenCopy}>{isRw ? `Kwishyura 5,000 ${rwfCurrency} byerekanwe hano gusa. Nta mafaranga yakuweho.` : 'A sample RWF 5,000 repayment is shown as a local preview only. The example balance remains illustrative.'}</p>
    <p className={styles.noticeBox}>{isRw ? 'Nta kigo cy’imari cyahamagawe kandi nta deni nyakuri ryahindutse.' : 'No provider was called and no real loan record changed.'}</p>
    <p className={styles.hintLine}>{isRw ? '9 Subira inyuma · 0 Sohoka' : '9 Back to repayment · 0 Exit'}</p>
  </>;
  if (screen === 'help') return <>
    <h3>{isRw ? 'Ubufasha bwa USSD' : 'USSD help'}</h3>
    <p className={styles.screenCopy}>{isRw ? 'Andika umubare uri iruhande rw’amahitamo, maze ukande Ohereza. Kanda 9 gusubira kuri menu, cyangwa 0 gusohoka.' : 'Type the number beside an option, then tap Reply. Press 9 to return to the menu, or 0 to exit.'}</p>
    <div className={styles.helpTip}><b>{isRw ? 'Icyitegererezo cyo kuri brawuza' : 'Local prototype'}</b><span>{isRw ? 'Amahitamo yawe ahinduka kuri iyi telefone gusa.' : 'Your choices only change this screen. There is no account connection.'}</span></div>
    <p className={styles.hintLine}>{isRw ? '9 Subira inyuma · 0 Sohoka' : '9 Back to menu · 0 Exit'}</p>
  </>;
  if (screen === 'invalid') return <>
    <div className={styles.errorBadge}>?</div>
    <h3>{isRw ? 'Ibyo wahisemo ntibibonetse' : 'That option isn’t available'}</h3>
    <p className={styles.screenCopy}>{isRw ? 'Injiza umwe mu mibare igaragara kuri menu, cyangwa ukande 9 gusubira inyuma.' : 'Enter one of the menu numbers shown on screen, or press 9 to return.'}</p>
    <p className={styles.hintLine}>{isRw ? 'Nta cyemejwe cyoherejwe.' : 'Nothing was submitted.'}</p>
  </>;
  return <>
    <div className={styles.exitIcon}><Check size={18} /></div>
    <h3>{isRw ? 'Gukoresha USSD byarangiye' : 'Session ended'}</h3>
    <p className={styles.screenCopy}>{isRw ? 'Urakoze kugerageza uburyo bwa USSD bwa HURIZA. Nta konti nyakuri cyangwa amafaranga byakozweho.' : 'Thank you for trying the HURIZA USSD prototype. No real account or transaction was involved.'}</p>
    <button type="button" className={styles.inlineRestart} onClick={onRestart}><RotateCcw size={13} /> {isRw ? 'Ongera utangirire kuri menu' : 'Restart from the welcome menu'}</button>
  </>;
}
