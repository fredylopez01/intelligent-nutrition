import type Anthropic from "@anthropic-ai/sdk";

const PER_MILLION = 1_000_000;

export const HAIKU_PRICES_USD = {
  input: 0.1,
  cacheWrite: 0.125,
  cacheRead: 0.01,
  output: 0.5,
} as const;

export function usageCostUsd(usage: Anthropic.Usage): number {
  return (
    (usage.input_tokens * HAIKU_PRICES_USD.input +
      (usage.cache_creation_input_tokens ?? 0) * HAIKU_PRICES_USD.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * HAIKU_PRICES_USD.cacheRead +
      usage.output_tokens * HAIKU_PRICES_USD.output) /
    PER_MILLION
  );
}

export function chatBudget(now = new Date()) {
  const value = Number(process.env.CHAT_MONTHLY_BUDGET_USD);
  const monthlyUsd = Number.isFinite(value) && value > 0 ? value : 4.5;
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const daysInMonth = new Date(
    Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return {
    monthlyUsd,
    dailyUsd: Math.round((monthlyUsd / daysInMonth) * 1_000_000) / 1_000_000,
  };
}
