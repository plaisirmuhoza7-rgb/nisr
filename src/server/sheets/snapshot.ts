import type {SheetCell, SheetRangeUpdate} from './validation';

export const MANAGED_SNAPSHOT_RANGE = "'HURIZA data'!A1:J2000";
export const MANAGED_SNAPSHOT_VERSION = 1;
export const MANAGED_SNAPSHOT_MARKER = 'HURIZA_MANAGED_SNAPSHOT';
export const MANAGED_SNAPSHOT_PROVENANCE = 'Financial transactions are SIMULATED. User-submitted account and organization records are shown as entered; no impact is inferred.';

const ROWS = 2000;
const COLUMNS = 10;
const DATA_START_ROW = 3;
const MAX_DATA_ROWS = ROWS - DATA_START_ROW + 1;
const MAX_SERIALIZED_VALUES_BYTES = 1_800_000;

/**
 * Render a complete bounded snapshot for the dedicated HURIZA data tab.
 * Callers supply values only: the destination and provenance are server-fixed.
 * The RAW writer preserves strings literally, including strings beginning with `=`.
 */
export function renderManagedSnapshot(rows: readonly (readonly SheetCell[])[]): SheetRangeUpdate {
  if (!Array.isArray(rows) || rows.length > MAX_DATA_ROWS) {
    throw new RangeError(`Managed snapshot supports at most ${MAX_DATA_ROWS} data rows.`);
  }

  const values: SheetCell[][] = Array.from({length: ROWS}, () => Array<SheetCell>(COLUMNS).fill(''));
  values[0][0] = MANAGED_SNAPSHOT_MARKER;
  values[0][1] = MANAGED_SNAPSHOT_VERSION;
  values[1][0] = MANAGED_SNAPSHOT_PROVENANCE;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || row.length > COLUMNS) {
      throw new TypeError(`Managed snapshot row ${rowIndex + 1} must contain at most ${COLUMNS} cells.`);
    }
    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const value = row[columnIndex];
      if (typeof value === 'string') {
        if (value.length > 50000) throw new RangeError('Managed snapshot text cell is too large.');
      } else if (typeof value === 'number') {
        if (!Number.isSafeInteger(value)) throw new TypeError('Managed snapshot numbers must be safe integers.');
      } else if (typeof value !== 'boolean') {
        throw new TypeError('Managed snapshot cells must be strings, booleans, or safe integers.');
      }
      values[DATA_START_ROW - 1 + rowIndex][columnIndex] = value;
    }
  }

  if (new TextEncoder().encode(JSON.stringify(values)).byteLength > MAX_SERIALIZED_VALUES_BYTES) {
    throw new RangeError(`Managed snapshot values must not exceed ${MAX_SERIALIZED_VALUES_BYTES} serialized bytes.`);
  }
  return {range: MANAGED_SNAPSHOT_RANGE, values};
}
