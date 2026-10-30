import 'server-only';

import {createSheetsGoogleAuth} from './google-auth';
import {validateSheetUpdates, type SheetCell, type SheetRangeUpdate} from './validation';
import {MANAGED_SNAPSHOT_MARKER, MANAGED_SNAPSHOT_VERSION} from './snapshot';

export type {SheetCell, SheetRangeUpdate} from './validation';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SPREADSHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

export type SpreadsheetMetadata = {
  spreadsheetId: string;
  title: string;
  sheets: Array<{title: string; sheetId: number; index: number}>;
};

function validateSpreadsheetId(id: string): string {
  if (typeof id !== 'string' || !SPREADSHEET_ID_PATTERN.test(id)) {
    throw new Error('Invalid Google Sheets spreadsheet ID.');
  }
  return id;
}

async function request<T>(spreadsheetId: string, path: string, init?: {method?: string; body?: unknown}): Promise<T> {
  const id = validateSpreadsheetId(spreadsheetId);
  try {
    const auth = createSheetsGoogleAuth([SHEETS_SCOPE]);
    const client = await auth.getClient();
    const url = `${SPREADSHEETS_API}/${encodeURIComponent(id)}${path}`;
    const response = await client.request<T>({
      url,
      method: init?.method ?? 'GET',
      timeout: 10000,
      retry: false,
      ...(init?.body === undefined ? {} : {data: init.body}),
      headers: init?.body === undefined ? undefined : {'content-type': 'application/json'},
    });
    return response.data;
  } catch {
    // Google client errors may contain credential or request details; don't forward them.
    throw new Error('Google Sheets request failed. Check server access and spreadsheet sharing.');
  }
}

/** Read metadata using ADC. Caller must authorize access to this server-supplied ID first. */
export async function readSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  const query = new URLSearchParams({fields: 'spreadsheetId,properties(title),sheets(properties(sheetId,title,index))'});
  const raw = await request<{
    spreadsheetId?: string;
    properties?: {title?: string};
    sheets?: Array<{properties?: {sheetId?: number; title?: string; index?: number}}>;
  }>(spreadsheetId, `?${query}`);
  if (!raw.spreadsheetId || !raw.properties?.title) throw new Error('Google Sheets returned incomplete metadata.');
  return {
    spreadsheetId: raw.spreadsheetId,
    title: raw.properties.title,
    sheets: (raw.sheets ?? []).flatMap(({properties}) => properties?.title !== undefined && properties.sheetId !== undefined && properties.index !== undefined
      ? [{title: properties.title, sheetId: properties.sheetId, index: properties.index}]
      : []),
  };
}

/** Refuse to write unless a trusted administrator prepared the dedicated app tab. */
export async function requireManagedSetupTab(spreadsheetId: string): Promise<void> {
  const range = encodeURIComponent("'HURIZA setup'!A1");
  const raw = await request<{values?: unknown[][]}>(spreadsheetId, `/values/${range}`);
  if (raw.values?.[0]?.[0] !== 'HURIZA connection setup') {
    throw new Error('Google Sheets setup tab is missing or has been changed.');
  }
}

/** Verify the dedicated data tab before any automatic export. */
export async function requireManagedDataTab(spreadsheetId: string): Promise<void> {
  const range = encodeURIComponent("'HURIZA data'!A1:B1");
  const raw = await request<{values?: unknown[][]}>(spreadsheetId, `/values/${range}?valueRenderOption=UNFORMATTED_VALUE`);
  if (raw.values?.[0]?.[0] !== MANAGED_SNAPSHOT_MARKER || raw.values?.[0]?.[1] !== MANAGED_SNAPSHOT_VERSION) {
    throw new Error('Google Sheets data tab is missing or has been changed.');
  }
}

/**
 * Apply one atomic RAW values batch. Caller must authorize the spreadsheet ID first.
 * `allowedRanges` and every update range must be generated and fixed by server code;
 * never pass ranges or IDs supplied by a route, browser, or other untrusted caller.
 */
export async function batchUpdateKnownTabRanges(
  spreadsheetId: string,
  updates: readonly SheetRangeUpdate[],
  allowedRanges: readonly string[],
): Promise<{updatedRanges: number}> {
  const allowlist = new Set(allowedRanges);
  validateSheetUpdates(updates, allowlist);
  const result = await request<{totalUpdatedRanges?: number}>(spreadsheetId, '/values:batchUpdate', {
    method: 'POST',
    body: {valueInputOption: 'RAW', data: updates.map(({range, values}) => ({range, values}))},
  });
  return {updatedRanges: result.totalUpdatedRanges ?? updates.length};
}
