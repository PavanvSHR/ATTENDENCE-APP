import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types";

const riskMap: Record<RiskLevel, { label: string; variant: "success" | "warning" | "destructive" }> = {
  low: { label: "LOW", variant: "success" },
  suspicious: { label: "SUSPICIOUS", variant: "warning" },
  high: { label: "HIGH RISK", variant: "destructive" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, variant } = riskMap[level];
  return <Badge variant={variant}>{label}</Badge>;
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 20) return "low";
  if (score <= 50) return "suspicious";
  return "high";
}
