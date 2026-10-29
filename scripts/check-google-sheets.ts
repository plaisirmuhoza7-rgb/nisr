import {loadEnvConfig} from '@next/env';
import {GoogleAuth} from 'google-auth-library';

loadEnvConfig(process.cwd());

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId || !/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId)) {
    throw new Error('Set GOOGLE_SHEETS_SPREADSHEET_ID to the ID from the spreadsheet URL.');
  }
  const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']});
  const client = await auth.getClient();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
  url.searchParams.set('fields', 'spreadsheetId,properties(title)');
  const response = await client.request<{spreadsheetId: string; properties: {title: string}}>({url: url.toString()});
  console.log(`Google Sheets connection succeeded: ${response.data.properties.title}`);
}

main().catch((error: unknown) => {
  const status = typeof error === 'object' && error !== null && 'response' in error
    ? (error as {response?: {status?: number}}).response?.status : undefined;
  if (status === 403) console.error('Google Sheets access denied. Enable the Sheets API and share the spreadsheet with the service account.');
  else if (status === 404) console.error('Spreadsheet not found. Check the spreadsheet ID and sharing permissions.');
  else if (error instanceof Error && error.message.startsWith('Set GOOGLE_SHEETS_SPREADSHEET_ID')) console.error(error.message);
  else console.error('Google Sheets connection failed. Check server credentials and network access.');
  process.exitCode = 1;
});
