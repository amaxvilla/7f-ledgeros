/** Formats a number as Naira-style currency with thousands separators. */
export function formatCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** True if the two amounts are equal within accounting rounding tolerance. */
export function isBalanced(totalDebit: number, totalCredit: number, tolerance = 0.005): boolean {
  return Math.abs(totalDebit - totalCredit) <= tolerance;
}

/** Sums an array of journal-line-like objects into { debit, credit } totals. */
export function sumLines<T extends { debit: number; credit: number }>(lines: T[]) {
  return lines.reduce(
    (acc, l) => ({ debit: acc.debit + Number(l.debit), credit: acc.credit + Number(l.credit) }),
    { debit: 0, credit: 0 },
  );
}

/** Formats a fiscal-period key (YYYY-MM) from a date. */
export function toFiscalPeriodName(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
