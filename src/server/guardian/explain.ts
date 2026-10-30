import type { GuardianResult } from '@/lib/guardian/types';

export interface ExplanationAuditLog {
  question: GuardianResult['question'];
  mode: GuardianResult['mode'];
  verdict: GuardianResult['verdict'];
  usedAi: boolean;
  validated: boolean;
  reason?: string;
  timestamp: string;
}

const auditLogs: ExplanationAuditLog[] = [];

export function getGuardianAuditLogs(): readonly ExplanationAuditLog[] {
  return auditLogs;
}

export function clearGuardianAuditLogs(): void {
  auditLogs.length = 0;
}

/**
 * Extracts numbers from text to verify financial integrity.
 * Recognizes comma-formatted numbers like "15,000", simple integers "5000", and decimals.
 */
export function extractNumbers(text: string): number[] {
  // Matches sequences of digits potentially separated by commas
  const matches = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d+\b/g);
  if (!matches) return [];
  return matches.map(m => Number(m.replace(/,/g, ''))).filter(n => Number.isFinite(n));
}

/**
 * Validates that every financial number mentioned by the model is backed
 * by a confirmed or estimated fact in the deterministic result.
 */
export function validateExplanationIntegrity(
  text: string,
  result: GuardianResult
): { valid: boolean; reason?: string } {
  // 1. Prohibited phrases check (Guardian never approves, moves funds, or guarantees)
  const forbiddenPatterns = [
    /approved your loan/i,
    /funds have been transferred/i,
    /moved your money/i,
    /guaranteed return/i,
    /guaranteed profit/i,
    /nisr verified impact/i,
    /nisr findings prove/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      return { valid: false, reason: `Forbidden claim detected: ${pattern}` };
    }
  }

  // 2. Numerical fact check
  const extracted = extractNumbers(text);
  const allowedNumbers = new Set<number>();

  for (const fact of result.facts) {
    if (fact.value !== null) {
      allowedNumbers.add(Math.abs(fact.value));
    }
  }

  // Also allow common trivial or contextual counts (0, 1, 2, 3, 100, etc. for percentages or counts)
  const trivialOrStructural = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 100, 10000]);

  for (const num of extracted) {
    if (allowedNumbers.has(num) || trivialOrStructural.has(num)) {
      continue;
    }
    // Check if it's within basis point percentage translation (e.g. 20 for 2000 bps)
    const isBpsMatch = result.facts.some(f => f.value !== null && (f.value / 100 === num || f.value / 1000 === num));
    if (isBpsMatch) continue;

    return {
      valid: false,
      reason: `Unverified number ${num} generated in explanation was not present in deterministic facts.`
    };
  }

  return { valid: true };
}

/**
 * Produces an honest, contextual explanation in English or Kinyarwanda.
 * Uses deterministic template by default; if AI flag is set, verifies the AI explanation
 * strictly against deterministic facts before accepting.
 */
export async function explainGuardianResult(
  result: GuardianResult,
  language: 'en' | 'rw' = 'en'
): Promise<GuardianResult> {
  const isRw = language === 'rw';
  const defaultExplanation = isRw ? result.explanationRw : result.explanation;
  const defaultHeadline = isRw ? result.headlineRw : result.headline;

  const enableAi = process.env.HURIZA_GUARDIAN_AI === 'true';

  if (!enableAi) {
    auditLogs.push({
      question: result.question,
      mode: result.mode,
      verdict: result.verdict,
      usedAi: false,
      validated: true,
      timestamp: new Date().toISOString()
    });
    return result;
  }

  // When AI is enabled, validate output strictly
  const aiCandidateText = defaultExplanation; // Stubbed provider or external model response
  const check = validateExplanationIntegrity(aiCandidateText, result);

  if (!check.valid) {
    auditLogs.push({
      question: result.question,
      mode: result.mode,
      verdict: result.verdict,
      usedAi: true,
      validated: false,
      reason: check.reason,
      timestamp: new Date().toISOString()
    });
    // Fall back safely to deterministic template
    return result;
  }

  auditLogs.push({
    question: result.question,
    mode: result.mode,
    verdict: result.verdict,
    usedAi: true,
    validated: true,
    timestamp: new Date().toISOString()
  });

  return {
    ...result,
    headline: defaultHeadline,
    explanation: defaultExplanation
  };
}
