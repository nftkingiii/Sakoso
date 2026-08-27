import { z } from "zod";

export const AgentCategorySchema = z.enum([
  "rebalancing",
  "grid-trading",
  "yield-optimisation",
  "health-factor-monitoring",
]);

export type AgentCategory = z.infer<typeof AgentCategorySchema>;

export const categorySearchTerms: Record<AgentCategory, string> = {
  rebalancing: "liquidity position range rebalancing",
  "grid-trading": "automated grid trading",
  "yield-optimisation": "yield optimisation APR liquidity routing",
  "health-factor-monitoring": "health factor liquidation monitoring",
};
