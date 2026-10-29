'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';

type Destination = { orgId: string; name: string; selected: boolean; syncStatus: 'pending'|'synced'|'needs_attention' };

async function responseError(response: Response, isKinyarwanda: boolean): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error;
  } catch { /* Use the status fallback when the endpoint has no JSON body. */ }
  return isKinyarwanda ? `Ubusabe bwanze (${response.status}).` : `Request failed (${response.status}).`;
}

export default function PersonalSheetDestination() {
  const { isKinyarwanda } = useLanguage();
  const [organizations, setOrganizations] = useState<Destination[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadDestinations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sheets/personal-destination', { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response, isKinyarwanda));
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('organizations' in body) || !Array.isArray(body.organizations)) {
        throw new Error(isKinyarwanda ? 'Aho imbonerahamwe ibikwa ntihashoboye gusomwa.' : 'The saved spreadsheet destinations could not be read.');
      }
      const options = body.organizations.filter((item): item is Destination =>
        !!item && typeof item === 'object' &&
        'orgId' in item && typeof item.orgId === 'string' &&
        'name' in item && typeof item.name === 'string' &&
        'selected' in item && typeof item.selected === 'boolean' &&
        'syncStatus' in item && ['pending','synced','needs_attention'].includes(String(item.syncStatus))
      );
      setOrganizations(options);
      setOrganizationId(options.find(item => item.selected)?.orgId ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isKinyarwanda ? 'Ntibyakunze kwinjiza imbonerahamwe zihari.' : 'Could not load spreadsheet destinations.'));
    } finally {
      setLoading(false);
    }
  }, [isKinyarwanda]);

  useEffect(() => { void loadDestinations(); }, [loadDestinations]);

  async function saveDestination() {
    if (!organizationId) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/sheets/personal-destination', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) throw new Error(await responseError(response, isKinyarwanda));
      setStatus(isKinyarwanda ? 'Aho imbonerahamwe yoherezwa habitswe neza.' : 'Personal spreadsheet destination saved.');
      await loadDestinations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isKinyarwanda ? 'Ntibyakunze kubika aho imbonerahamwe yoherezwa.' : 'Could not save the spreadsheet destination.'));
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/sheets/personal-destination', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(await responseError(response, isKinyarwanda));
      setOrganizationId('');
      setStatus(isKinyarwanda ? 'Aho imbonerahamwe yoherezwa hakuweho. Kopi zagejejweho zishobora kugumaho.' : 'Personal spreadsheet destination removed. Copies already made in the spreadsheet may remain.');
      await loadDestinations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isKinyarwanda ? 'Ntibyakunze gukuraho aho imbonerahamwe yoherezwa.' : 'Could not remove the spreadsheet destination.'));
    } finally {
      setBusy(false);
    }
  }

  const selectedDestination = organizations.find(item => item.selected);
  const hasSelected = Boolean(selectedDestination);
  return <section className="card" aria-labelledby="personal-sheet-title">
    <div className="card-head"><div><h2 id="personal-sheet-title">{isKinyarwanda ? 'Aho imbonerahamwe bwite yoherezwa' : 'Personal spreadsheet destination'}</h2><p>{isKinyarwanda ? 'Hitamo imbonerahamwe y’umuryango yo kwakira incamake yawe.' : 'Choose an organization spreadsheet for your personal summary.'}</p></div></div>
    <p className="subtle-note">{isKinyarwanda ? 'Intego zawe zabitswe, izina na imeli byawe, n’ubusabe by’umuryango bishobora kubonwa na buri wese ufite uburenganzira ku mbonerahamwe yahiswemo. Gukuraho iyi ntego ntibishobora guhita bihanagura kopi zamaze gukorwa.' : 'Your saved goals, account name and email, and organization requests may be visible to everyone with access to the chosen spreadsheet. Removing this destination cannot immediately erase copies already made.'}</p>
    {selectedDestination && <p className="subtle-note" role="status">{selectedDestination.syncStatus === 'synced' ? (isKinyarwanda ? 'Imbonerahamwe y’umuryango iravuguruwe neza.' : 'Your organization spreadsheet is up to date.') : selectedDestination.syncStatus === 'needs_attention' ? (isKinyarwanda ? 'Guhuza n’imbonerahamwe bikeneye kwitabwaho. Baza umuyobozi w’umuryango.' : 'Spreadsheet sync needs attention. Contact your organization administrator.') : (isKinyarwanda ? 'Impinduka zitegereje guhuzwa n’imbonerahamwe y’umuryango.' : 'Changes are waiting to sync to the organization spreadsheet.')} <button type="button" disabled={busy || loading} onClick={() => void loadDestinations()}>{isKinyarwanda ? 'Vugurura imiterere' : 'Refresh status'}</button></p>}
    {loading ? <p className="subtle-note" role="status">{isKinyarwanda ? 'Gushakisha imiryango ifitanye isano…' : 'Loading connected organizations…'}</p> : organizations.length === 0 ?
      <p className="subtle-note" role="status">{isKinyarwanda ? 'Guhuza n’imbonerahamwe ntibishoboka. Nta muryango uhari.' : 'Spreadsheet connection is unavailable. No organization destinations are connected.'}</p> : <>
        <label className="standalone-field" htmlFor="personal-sheet-organization">{isKinyarwanda ? 'Umuryango wahuwe' : 'Connected organization'}</label>
        <select id="personal-sheet-organization" value={organizationId} disabled={busy} onChange={event => setOrganizationId(event.target.value)}>
          <option value="">{isKinyarwanda ? 'Hitamo umuryango' : 'Choose an organization'}</option>
          {organizations.map(item => <option key={item.orgId} value={item.orgId}>{item.name}</option>)}
        </select>
        <div className="form-actions">
          <button className="button button-primary" type="button" disabled={busy || !organizationId} onClick={() => void saveDestination()}>{busy ? (isKinyarwanda ? 'Birabikwa…' : 'Saving…') : (isKinyarwanda ? 'Bika aho yoherezwa' : 'Save destination')}</button>
          {hasSelected && <button className="button button-quiet" type="button" disabled={busy} onClick={() => void stopSharing()}>{busy ? (isKinyarwanda ? 'Biratunganywa…' : 'Saving…') : (isKinyarwanda ? 'Hagarika gusangiza' : 'Stop sharing')}</button>}
        </div>
      </>}
    {error && <p role="alert" className="subtle-note">{error}</p>}
    {status && <p role="status" aria-live="polite" className="subtle-note">{status}</p>}
  </section>;
}
