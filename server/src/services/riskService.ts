import { RiskLevel } from "../types";

/**
 * Inputs to the risk-scoring heuristic. Kept as small booleans/counts so the
 * function stays pure and unit-testable — no Firestore/network access here.
 */
export interface RiskFactors {
  /** Device geolocation API reported mock/fake location. */
  mockLocationSuspected?: boolean;
  /** location.accuracy was present and > 50m (coarse/low-confidence fix). */
  lowGpsAccuracy?: boolean;
  /** The device used was not previously registered/recognized for this student. */
  newOrUnrecognizedDevice?: boolean;
  /**
   * Count of *_failed verification results that were NOT already hard-rejected
   * upstream (in the normal flow, failures short-circuit the request before
   * reaching risk scoring, so this is usually 0 — kept generic/extensible in
   * case future verification methods are "soft fail" rather than blocking).
   */
  softFailedVerificationCount?: number;
  /**
   * Heuristic: another attendance attempt from the same IP/device landed
   * within the last 30 seconds for a DIFFERENT student. Best-effort signal
   * of one device being used to mark attendance for multiple people
   * (proxy/buddy-punching pattern). Computed by the caller from recent
   * attendanceRecords, since that requires a Firestore query.
   */
  rapidMultiStudentSameSource?: boolean;
}

export interface RiskScoreResult {
  score: number;
  level: RiskLevel;
}

const WEIGHTS = {
  mockLocationSuspected: 15,
  lowGpsAccuracy: 10,
  newOrUnrecognizedDevice: 20,
  perSoftFailedVerification: 10,
  rapidMultiStudentSameSource: 15,
};

/**
 * Pure risk-scoring function: 0 (no signals) to 100 (many signals), clamped.
 * riskLevel thresholds: <=20 low, <=50 suspicious, else high.
 *
 * IMPORTANT (per spec): a high risk score alone must NEVER auto-reject an
 * attendance attempt — callers should still record the attendance and just
 * set flaggedForReview=true / notify the teacher. Scoring and rejection are
 * deliberately kept as separate concerns.
 */
export function computeRiskScore(factors: RiskFactors): RiskScoreResult {
  let score = 0;

  if (factors.mockLocationSuspected) score += WEIGHTS.mockLocationSuspected;
  if (factors.lowGpsAccuracy) score += WEIGHTS.lowGpsAccuracy;
  if (factors.newOrUnrecognizedDevice) score += WEIGHTS.newOrUnrecognizedDevice;
  if (factors.softFailedVerificationCount && factors.softFailedVerificationCount > 0) {
    score += factors.softFailedVerificationCount * WEIGHTS.perSoftFailedVerification;
  }
  if (factors.rapidMultiStudentSameSource) score += WEIGHTS.rapidMultiStudentSameSource;

  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel;
  if (score <= 20) level = "low";
  else if (score <= 50) level = "suspicious";
  else level = "high";

  return { score, level };
}
