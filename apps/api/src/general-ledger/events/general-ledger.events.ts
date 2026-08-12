export class JournalPostedEvent {
  constructor(
    public readonly journalEntryId: string,
    public readonly journalNumber: string,
    public readonly entityId: string,
  ) {}

  static readonly eventName = 'journal.posted';
}

export class JournalReversedEvent {
  constructor(
    public readonly originalJournalEntryId: string,
    public readonly reversalJournalEntryId: string,
    public readonly entityId: string,
  ) {}

  static readonly eventName = 'journal.reversed';
}

export class PeriodLockedEvent {
  constructor(
    public readonly fiscalPeriodId: string,
    public readonly entityId: string,
  ) {}

  static readonly eventName = 'period.locked';
}
