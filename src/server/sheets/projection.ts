import type { FinanceState } from '../../lib/contracts';

/** A deliberately small, aggregate-only payload suitable for writing to Sheets. */
export interface SimulatedSavingsGroupSheetExport {
  readonly title: 'SIMULATED savings group summary';
  readonly values: readonly (readonly (string | number)[])[];
}

function safeRwf(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer RWF amount`);
  }
  return value;
}

/**
 * Project a server-authorized finance state into a simulated, one-group summary.
 * This function does not authorize access or connect to / persist data in Sheets.
 */
export function projectSavingsGroupForSheets(
  state: FinanceState,
  expectedOrganizationId: string,
): SimulatedSavingsGroupSheetExport {
  const group = state.savingsGroup;
  if (!group || !expectedOrganizationId || group.id !== expectedOrganizationId) {
    throw new Error('Savings group scope mismatch');
  }

  const members = group.memberCount;
  if (!Number.isSafeInteger(members) || members < 0) {
    throw new RangeError('memberCount must be a non-negative safe integer');
  }

  const shareOut = group.shareOut;
  const rows: (string | number)[][] = [
    ['SIMULATED — fictional example; not evidence of real-world impact'],
    ['Savings group aggregate', 'Value'],
    ['Members', members],
    ['Contribution amount (RWF)', safeRwf(group.contributionAmount, 'contributionAmount')],
    ['Contributions (RWF)', safeRwf(shareOut.contributions, 'shareOut.contributions')],
    ['Cash (RWF)', safeRwf(shareOut.cash, 'shareOut.cash')],
    ['Reserve (RWF)', safeRwf(shareOut.reserve, 'shareOut.reserve')],
    ['Outstanding loans (RWF)', safeRwf(shareOut.outstandingLoans, 'shareOut.outstandingLoans')],
    ['Pending (RWF)', safeRwf(shareOut.pending, 'shareOut.pending')],
    ['Distributable (RWF)', safeRwf(shareOut.distributable, 'shareOut.distributable')],
  ];

  return { title: 'SIMULATED savings group summary', values: rows };
}
