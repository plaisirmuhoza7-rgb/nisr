'use client';

import {useEffect, useState} from 'react';
import {useLanguage} from '@/lib/i18n/context';

type Status = 'not_connected'|'pending'|'synced'|'needs_attention';
export default function OrganizationSheetStatus({organizationId}:{organizationId:string}) {
  const {isKinyarwanda} = useLanguage();
  const [status,setStatus] = useState<Status|null>(null);
  useEffect(() => {
    let stopped = false;
    let controller:AbortController|undefined;
    async function refresh() {
      controller?.abort(); controller = new AbortController();
      try {
        const response = await fetch(`/api/sheets/status?organizationId=${encodeURIComponent(organizationId)}`, {cache:'no-store',signal:controller.signal});
        const data:unknown = await response.json();
        if (!response.ok || !data || typeof data !== 'object' || !('status' in data) || !['not_connected','pending','synced','needs_attention'].includes(String(data.status))) throw new Error('Status unavailable');
        if (!stopped) setStatus(data.status as Status);
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === 'AbortError')) setStatus(null);
      }
    }
    void refresh(); const timer = setInterval(() => void refresh(),30000);
    return () => {stopped=true;clearInterval(timer);controller?.abort();};
  }, [organizationId]);
  const message = status==='synced'
    ? (isKinyarwanda ? 'Imbonerahamwe y’umuryango (Google Sheets) iravuguruwe neza.' : 'The organization spreadsheet is up to date.')
    : status==='pending'
    ? (isKinyarwanda ? 'Impinduka zategereje guhuzwa n’imbonerahamwe ya Google Sheets.' : 'Saved changes are waiting to sync to Google Sheets.')
    : status==='needs_attention'
    ? (isKinyarwanda ? 'Guhuza na Google Sheets bikeneye kwitabwaho. Baza umuyobozi w’umuryango.' : 'Google Sheets sync needs attention. Ask your organization administrator.')
    : status==='not_connected'
    ? (isKinyarwanda ? 'Google Sheets ntirahuza n’uyu muryango.' : 'Google Sheets is not connected for this organization.')
    : (isKinyarwanda ? 'Imiterere ya Google Sheets ntibonetse ubu.' : 'Google Sheets status is unavailable.');
  return (
    <div className="notice" role="status" aria-live="polite">
      <span>{message} {isKinyarwanda ? 'Inyandiko z’umuryango mu mbonerahamwe zibonwa na buri wese ufite uruhushya kuri iyo dosiye.' : 'Organization records in a spreadsheet are visible to everyone with access to that file.'}</span>
    </div>
  );
}
