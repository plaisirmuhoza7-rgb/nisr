export type SheetCell = string | number | boolean;
export type SheetRangeUpdate = {range: string; values: SheetCell[][]};

type A1Extent = {rows: number; columns: number};

function columnNumber(column: string): number {
  let value = 0;
  for (const char of column) value = value * 26 + char.charCodeAt(0) - 64;
  return value;
}

function parseCell(cell: string): {row: number; column: number} {
  const match = /^\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/.exec(cell);
  if (!match) throw new Error('Invalid Google Sheets range.');
  const row = Number(match[2]);
  if (!Number.isSafeInteger(row)) throw new Error('Invalid Google Sheets range.');
  return {column: columnNumber(match[1]), row};
}

function parseA1Range(range: string): A1Extent {
  if (typeof range !== 'string' || range.length > 200) throw new Error('Invalid Google Sheets range.');
  const bang = range.lastIndexOf('!');
  const tab = range.slice(0, bang);
  const cells = range.slice(bang + 1).split(':');
  if (bang < 1 || cells.length > 2 || !tab || tab.startsWith("'") !== tab.endsWith("'")) {
    throw new Error('Invalid Google Sheets range.');
  }
  if (tab.startsWith("'") ? !/^'(?:[^'\r\n]|'')+'$/.test(tab) : !/^[A-Za-z0-9_ -]+$/.test(tab)) {
    throw new Error('Invalid Google Sheets range.');
  }
  const start = parseCell(cells[0]);
  const end = cells.length === 2 ? parseCell(cells[1]) : start;
  if (end.row < start.row || end.column < start.column) throw new Error('Google Sheets range end must be after its start.');
  const rows = end.row - start.row + 1, columns = end.column - start.column + 1;
  if (rows > 10000 || columns > 1000) throw new Error('Google Sheets range is too large.');
  return {rows, columns};
}

/** Validate and enforce exact matrix dimensions for server-owned allowlisted A1 ranges. */
export function validateSheetUpdates(updates: readonly SheetRangeUpdate[], allowedRanges: ReadonlySet<string>): void {
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 100) {
    throw new Error('Provide between 1 and 100 Google Sheets range updates.');
  }
  const seen = new Set<string>();
  for (const update of updates) {
    if (!update || typeof update !== 'object' || typeof update.range !== 'string') {
      throw new Error('Invalid Google Sheets update.');
    }
    const extent = parseA1Range(update.range);
    if (!allowedRanges.has(update.range) || seen.has(update.range)) {
      throw new Error('Google Sheets update range is not allowed.');
    }
    seen.add(update.range);
    if (!Array.isArray(update.values) || update.values.length !== extent.rows) {
      throw new Error('Google Sheets values must exactly fit the allowed range.');
    }
    for (const row of update.values) {
      if (!Array.isArray(row) || row.length !== extent.columns) throw new Error('Google Sheets values must exactly fit the allowed range.');
      for (const value of row) {
        if (value === null || !['string', 'number', 'boolean'].includes(typeof value)) {
          throw new Error('Google Sheets values must be strings, numbers, or booleans.');
        }
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid Google Sheets number.');
        if (typeof value === 'string' && value.length > 50000) throw new Error('Google Sheets cell is too large.');
      }
    }
  }
}

