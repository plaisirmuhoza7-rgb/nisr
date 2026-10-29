import 'server-only';
import {getDb} from '../db';
import {authorizeOrganizationDelivery} from './authorization';
import {batchUpdateKnownTabRanges, requireManagedDataTab} from './client';
import {loadOrganizationSnapshot} from './data-snapshot';
import {processPendingSheetDeliveries} from './pending';
import {MANAGED_SNAPSHOT_RANGE} from './snapshot';
import {deliverOrganizationSheet} from './worker';
import {syncSharedMasterView} from './master-visible-worker';
import {captureDemoLogicalSnapshot} from './demo-logical-snapshot';
import {createHash} from 'node:crypto';
import type {Database} from '../db';

type RunnerState = {running:boolean; timer:ReturnType<typeof setInterval>;mode:'shared'|'organization';digest:string|null;failed:boolean};
const globalRunner = globalThis as typeof globalThis & {hurizaSheetsRunner?: RunnerState};

/** Start only in a long-lived Node app process. Database outbox survives restarts. */
export function startGoogleSheetsRunner(): void {
  const mode=process.env.HURIZA_SHEETS_PRIMARY==='true'?'shared':'organization';
  if (globalRunner.hurizaSheetsRunner?.mode===mode) return;
  if (globalRunner.hurizaSheetsRunner) clearInterval(globalRunner.hurizaSheetsRunner.timer);
  const state:RunnerState = {running: false, timer: undefined as unknown as ReturnType<typeof setInterval>,mode,digest:null,failed:false};
  async function tick() {
    if (state.running) return;
    state.running = true;
    try {
      const db = await getDb();
      if (state.mode==='shared') {
        const spreadsheetId=process.env.GOOGLE_SHEETS_SPREADSHEET_ID??'';
        state.digest=await syncSharedMasterView(db,spreadsheetId,state.digest,{
          verifyManagedTab:requireManagedDataTab,
          write:(id,update)=>batchUpdateKnownTabRanges(id,[update],[MANAGED_SNAPSHOT_RANGE]),
        });
        state.failed=false;
        return;
      }
      await processPendingSheetDeliveries(db, (tenantId, orgId) => deliverOrganizationSheet(db, tenantId, orgId, {
        authorizeDestination: authorizeOrganizationDelivery,
        loadSnapshot: loadOrganizationSnapshot,
        writeSnapshot: async (spreadsheetId, update) => {
          await requireManagedDataTab(spreadsheetId);
          await batchUpdateKnownTabRanges(spreadsheetId, [update], [MANAGED_SNAPSHOT_RANGE]);
        },
      }));
    } catch {
      state.failed=true;
      console.error('HURIZA Google Sheets sync could not run. Check server configuration.');
    } finally { state.running = false; }
  }
  state.timer = setInterval(() => { void tick(); }, 30000);
  state.timer.unref?.();
  globalRunner.hurizaSheetsRunner = state;
  void tick();
}

/** The status is shared-file-wide; caller must authorize its organization first. */
export async function sharedMasterViewStatus(db:Database):Promise<'synced'|'pending'|'needs_attention'> {
  const state=globalRunner.hurizaSheetsRunner;
  if(!state || state.mode!=='shared')return 'pending';
  if(state.failed)return 'needs_attention';
  if(!state.digest)return 'pending';
  const payload=await db.transaction(tx=>captureDemoLogicalSnapshot(tx));
  return createHash('sha256').update(payload,'utf8').digest('hex')===state.digest?'synced':'pending';
}
