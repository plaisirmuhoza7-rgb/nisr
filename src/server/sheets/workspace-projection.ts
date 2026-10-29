import type { FinanceState } from '../../lib/contracts';

export type SheetsWorkspace =
  | { readonly kind: 'cooperative' }
  | { readonly kind: 'fundraising' };

export type SimulatedWorkspaceSheetExport = {
  readonly workspace: SheetsWorkspace['kind'];
  readonly title: 'SIMULATED cooperative summary' | 'SIMULATED fundraising summary';
  /** Two-dimensional values for Sheets values API with valueInputOption=RAW. */
  readonly values: readonly (readonly (string | number)[])[];
};

const MAX_PROPOSALS = 100;
const MAX_ASSETS = 50;
const MAX_CAMPAIGNS = 100;

function safeRwf(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer RWF amount`);
  }
  return value;
}

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new RangeError(`${field} must be text of at most ${maxLength} characters`);
  }
  // Preserve text verbatim. The Sheets values API must be called with RAW input.
  return value;
}

function boundedLength(length: number, max: number, field: string): void {
  if (length > max) throw new RangeError(`${field} exceeds the export row limit (${max})`);
}

/**
 * Prepare a capped simulated export for one explicitly selected workspace.
 * This is a projection only: its caller must authorize the actor, load FinanceState
 * scoped to that exact tenant and organization, and write values using RAW mode.
 * It intentionally omits personal/member records, identifiers, payment references,
 * and all data belonging to other workspaces. It does not cover every typed record.
 */
export function projectWorkspaceForSheets(
  state: FinanceState,
  workspace: SheetsWorkspace,
): SimulatedWorkspaceSheetExport {
  if (workspace.kind === 'cooperative') {
    const coop = state.cooperative;
    boundedLength(coop.proposals.length, MAX_PROPOSALS, 'Cooperative proposals');
    boundedLength(coop.assets.length, MAX_ASSETS, 'Cooperative assets');
    const values: (string | number)[][] = [
      ['SIMULATED cooperative summary'],
      ['Aggregate', 'Value'],
      ['Cash (RWF)', safeRwf(coop.cash, 'cooperative.cash')],
      ['Reserve (RWF)', safeRwf(coop.reserve, 'cooperative.reserve')],
      ['Share capital (RWF)', safeRwf(coop.shareCapital, 'cooperative.shareCapital')],
      ['Revenue (RWF)', safeRwf(coop.revenue, 'cooperative.revenue')],
      ['Expenses (RWF)', safeRwf(coop.expenses, 'cooperative.expenses')],
      [],
      ['Cooperative assets', 'Value (RWF)'],
      ...coop.assets.map((asset, index) => [
        text(asset.name, `cooperative.assets[${index}].name`, 160),
        safeRwf(asset.value, `cooperative.assets[${index}].value`),
      ]),
      [],
      ['Investment proposals', 'Amount (RWF)', 'Status', 'Votes'],
      ...coop.proposals.map((proposal, index) => {
        const prefix = `cooperative.proposals[${index}]`;
        const votes = proposal.votes;
        if (!Number.isSafeInteger(votes) || votes < 0) throw new RangeError(`${prefix}.votes must be a non-negative safe integer`);
        return [
          text(proposal.title, `${prefix}.title`, 200),
          safeRwf(proposal.amount, `${prefix}.amount`),
          text(proposal.status, `${prefix}.status`, 80),
          votes,
        ];
      }),
    ];
    return { workspace: 'cooperative', title: 'SIMULATED cooperative summary', values };
  }

  if (workspace.kind === 'fundraising') {
    boundedLength(state.campaigns.length, MAX_CAMPAIGNS, 'Fundraising campaigns');
    const values: (string | number)[][] = [
      ['SIMULATED fundraising summary'],
      ['Campaign title', 'Category', 'Description', 'Target (RWF)', 'Raised (RWF)', 'Spent (RWF)', 'Status'],
      ...state.campaigns.map((campaign, index) => {
        const prefix = `campaigns[${index}]`;
        return [
          text(campaign.title, `${prefix}.title`, 200),
          text(campaign.category, `${prefix}.category`, 80),
          text(campaign.description, `${prefix}.description`, 2000),
          safeRwf(campaign.target, `${prefix}.target`),
          safeRwf(campaign.raised, `${prefix}.raised`),
          safeRwf(campaign.spent, `${prefix}.spent`),
          text(campaign.status, `${prefix}.status`, 80),
        ];
      }),
    ];
    return { workspace: 'fundraising', title: 'SIMULATED fundraising summary', values };
  }

  throw new Error('Unsupported Sheets workspace');
}
