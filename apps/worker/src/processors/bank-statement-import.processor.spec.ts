import { parseStatementCsv } from './bank-statement-import.processor';

describe('parseStatementCsv', () => {
  it('parses a well-formed CSV with all columns', () => {
    const csv = [
      'transactionDate,description,reference,amount',
      '2026-07-01,Wire transfer in,REF123,15000.50',
      '2026-07-02,Office supplies,REF124,-245.10',
    ].join('\n');

    const rows = parseStatementCsv(csv);

    expect(rows).toEqual([
      { transactionDate: '2026-07-01', description: 'Wire transfer in', reference: 'REF123', amount: 15000.5 },
      { transactionDate: '2026-07-02', description: 'Office supplies', reference: 'REF124', amount: -245.1 },
    ]);
  });

  it('returns an empty array for a header-only or empty file', () => {
    expect(parseStatementCsv('transactionDate,description,reference,amount')).toEqual([]);
    expect(parseStatementCsv('')).toEqual([]);
  });

  it('throws when required columns are missing', () => {
    expect(() => parseStatementCsv('foo,bar\n1,2')).toThrow(/missing required columns/i);
  });

  it('works without an optional reference column', () => {
    const csv = ['transactionDate,description,amount', '2026-07-01,ATM withdrawal,-100'].join('\n');
    const rows = parseStatementCsv(csv);
    expect(rows).toEqual([{ transactionDate: '2026-07-01', description: 'ATM withdrawal', reference: undefined, amount: -100 }]);
  });
});
