import {loadEnvConfig} from '@next/env';
import {parseArgs} from 'node:util';
import {getDb} from '../src/server/db';
import {bindSpreadsheetForOrganization, SpreadsheetBindingError} from '../src/server/sheets/bindings';

loadEnvConfig(process.cwd());

async function main() {
  const {values} = parseArgs({options: {
    tenant: {type: 'string'},
    organization: {type: 'string'},
    spreadsheet: {type: 'string'},
  }, strict: true});
  const tenant = values.tenant?.trim();
  const organization = values.organization?.trim();
  const spreadsheet = values.spreadsheet?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!tenant || !organization || !spreadsheet) {
    throw new SpreadsheetBindingError('Provide --tenant and --organization, and configure GOOGLE_SHEETS_SPREADSHEET_ID or pass --spreadsheet.');
  }
  const db = await getDb();
  try {
    await bindSpreadsheetForOrganization(db, tenant, organization, spreadsheet);
    console.log('Spreadsheet bound to the specified organization. No account or financial data was sent.');
  } finally {
    await db.close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof SpreadsheetBindingError ? error.message : 'Could not bind the spreadsheet. Check the database and arguments.');
  process.exitCode = 1;
});
