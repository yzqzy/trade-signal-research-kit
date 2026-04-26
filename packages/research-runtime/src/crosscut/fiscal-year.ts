export function resolveAnnualFiscalYear(value?: string, now = new Date()): string {
  if (value && /^\d{4}$/.test(value.trim())) return value.trim();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const annualReportsLikelyComplete = month > 4 || (month === 4 && day > 30);
  return String(currentYear - (annualReportsLikelyComplete ? 1 : 2));
}
