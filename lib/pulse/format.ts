/**
 * Pure text formatting utility for distilling raw conversational user inputs into clean, professional blueprint specifications.
 */
export function cleanUserMappedValue(text: string): string {
  let clean = text.trim();
  if (!clean) return "";

  // Remove common conversational preamble filler
  clean = clean.replace(/^(yeah|yes|actually|basically|well|so|i think|i want|we want|we need|i would say|my answer is|our goal is|i plan|we plan|i'm looking|we're looking)\s+(the|a|an|to|for|in|about|that|with)?\s*/i, "");
  clean = clean.replace(/^(i want the website in|i want the app in|i want it in|we want to launch in|building this in)\s+/i, "");

  // Capitalize first character cleanly
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Strip trailing sentence punctuation
  clean = clean.replace(/[!.;]+$/, "");

  return clean;
}

/**
 * Distill timeline statements into concise duration / target window specifications.
 * Example: "I want the website in 3 or 4 weeks" -> "3–4 Weeks"
 */
export function distillTimelineText(text: string): string {
  if (!text) return "To be aligned upon technical discovery review";
  const clean = text.trim();

  // Match 3 or 4 weeks / 3-4 weeks / 2 months
  const weekMatch = clean.match(/(\d+)\s*(?:to|-|or)\s*(\d+)\s*weeks?/i);
  if (weekMatch) return `${weekMatch[1]}–${weekMatch[2]} Weeks`;

  const singleWeekMatch = clean.match(/(\d+)\s*weeks?/i);
  if (singleWeekMatch) return `${singleWeekMatch[1]} Weeks`;

  const monthMatch = clean.match(/(\d+)\s*(?:to|-|or)\s*(\d+)\s*months?/i);
  if (monthMatch) return `${monthMatch[1]}–${monthMatch[2]} Months`;

  const singleMonthMatch = clean.match(/(\d+)\s*months?/i);
  if (singleMonthMatch) return `${singleMonthMatch[1]} Months`;

  if (/q[1-4]/i.test(clean)) {
    const qMatch = clean.match(/q[1-4](\s*\d{4})?/i);
    return `Target Launch ${qMatch ? qMatch[0].toUpperCase() : "Q3"}`;
  }

  if (/asap|immediate|urgent|soon/i.test(clean)) {
    return "ASAP / Immediate Launch";
  }

  if (/flexible|tbd|not sure/i.test(clean)) {
    return "Flexible Launch Timeline";
  }

  return cleanUserMappedValue(clean);
}

/**
 * Distill budget statements into clean, professional financial allocation specs.
 * Example: "I will discuss that with ACEVA's team directly" -> "To be aligned directly with ACEVA team"
 */
export function distillBudgetText(text: string): string {
  if (!text) return "To be discussed directly with the ACEVA engineering team";
  const clean = text.trim();

  if (/discuss|team|aceva|directly|deal/i.test(clean)) {
    return "To be aligned directly with ACEVA team";
  }

  const rangeMatch = clean.match(/(\$?\d+k?)\s*(?:to|-|or)\s*(\$?\d+k?)/i);
  if (rangeMatch) return `${rangeMatch[1]} – ${rangeMatch[2]}`;

  const numMatch = clean.match(/\$?\d+[\d,]*k?/i);
  if (numMatch) return numMatch[0];

  if (/flexible|no limit|open/i.test(clean)) {
    return "Flexible Budget Allocation";
  }

  return cleanUserMappedValue(clean);
}
