export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build' && process.env.HURIZA_SHEETS_AUTO_SYNC === 'true') {
    const {startGoogleSheetsRunner} = await import('./server/sheets/runner');
    startGoogleSheetsRunner();
  }
}
