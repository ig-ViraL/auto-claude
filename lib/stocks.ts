/**
 * Canonical list of 20 stocks tracked by the screener.
 * Chosen to represent a mix of sectors, market caps, and volatility profiles
 * that give analysts a meaningful cross-section to filter against.
 */
export const TICKERS = [
  "AAPL", // Apple — mega-cap tech, low volatility benchmark
  "MSFT", // Microsoft — cloud + AI growth story
  "GOOGL", // Alphabet — ad revenue + cloud
  "AMZN", // Amazon — e-commerce + AWS
  "META", // Meta — social media + AI bets
  "NVDA", // Nvidia — AI chip supercycle
  "TSLA", // Tesla — high-beta EV/energy
  "JPM", // JPMorgan — large-cap financials
  "JNJ", // Johnson & Johnson — defensive healthcare
  "V", // Visa — payments network
  "WMT", // Walmart — defensive retail
  "PG", // Procter & Gamble — consumer staples
  "HD", // Home Depot — cyclical retail
  "BAC", // Bank of America — rate-sensitive bank
  "MA", // Mastercard — payments, pairs with Visa
  "DIS", // Disney — media/streaming turnaround
  "NFLX", // Netflix — streaming profitability story
  "ADBE", // Adobe — creative software + AI tools
  "CRM", // Salesforce — enterprise SaaS
  "AMD", // AMD — semiconductor, competes with Nvidia
] as const;

export type Ticker = (typeof TICKERS)[number];
