import { describe, it, expect } from 'vitest';
import { required, email, phone, minLength, uuid, validateForm } from '../validation';

describe('required', () => {
  it('fails on an empty string', () => {
    expect(required()('')).toBe('This field is required');
  });

  it('fails on a whitespace-only string', () => {
    expect(required()('   ')).toBe('This field is required');
  });

  it('passes on any non-blank value', () => {
    expect(required()('Ada')).toBeUndefined();
  });

  it('uses a custom message when given one', () => {
    expect(required('Name is required')('')).toBe('Name is required');
  });
});

describe('email', () => {
  it('passes on a blank value, composing with an optional field', () => {
    expect(email()('')).toBeUndefined();
  });

  it('passes on a well-formed address', () => {
    expect(email()('ada@example.com')).toBeUndefined();
  });

  it('fails on a value missing the @', () => {
    expect(email()('ada.example.com')).toBe('Enter a valid email address');
  });

  it('fails on a value missing a domain', () => {
    expect(email()('ada@')).toBe('Enter a valid email address');
  });
});

describe('phone', () => {
  it('passes on a blank value, composing with an optional field', () => {
    expect(phone()('')).toBeUndefined();
  });

  it('passes on a number with a country code', () => {
    expect(phone()('+2348012345678')).toBeUndefined();
  });

  it('passes on a number with parens and dashes', () => {
    expect(phone()('(02) 123-4567')).toBeUndefined();
  });

  it('fails on a value with letters in it', () => {
    expect(phone()('call me maybe')).toBe('Enter a valid phone number');
  });

  it('fails on a value too short to be a real number', () => {
    expect(phone()('123')).toBe('Enter a valid phone number');
  });
});

describe('minLength', () => {
  it('passes on a blank value, leaving that to required() instead', () => {
    expect(minLength(5)('')).toBeUndefined();
  });

  it('fails on a non-blank value shorter than the minimum', () => {
    expect(minLength(5)('ab')).toBe('Must be at least 5 characters');
  });

  it('passes once the value meets the minimum', () => {
    expect(minLength(5)('abcde')).toBeUndefined();
  });
});

describe('uuid', () => {
  it('passes on a blank value, composing with an optional field', () => {
    expect(uuid()('')).toBeUndefined();
  });

  it('passes on a well-formed UUID', () => {
    expect(uuid()('550e8400-e29b-41d4-a716-446655440000')).toBeUndefined();
  });

  it('passes on an uppercase UUID', () => {
    expect(uuid()('550E8400-E29B-41D4-A716-446655440000')).toBeUndefined();
  });

  it('fails on a value that is not UUID-shaped', () => {
    expect(uuid()('not-a-real-id')).toBe('Enter a valid ID (expected a UUID)');
  });

  it('fails on a UUID missing a segment', () => {
    expect(uuid()('550e8400-e29b-41d4-a716')).toBe('Enter a valid ID (expected a UUID)');
  });
});

describe('validateForm', () => {
  it('returns no errors when every field passes its own validators', () => {
    const errors = validateForm(
      { firstName: 'Ada', email: 'ada@example.com' },
      { firstName: [required()], email: [email()] },
    );
    expect(errors).toEqual({});
  });

  it('collects one error per failing field', () => {
    const errors = validateForm(
      { firstName: '', email: 'not-an-email' },
      { firstName: [required()], email: [email()] },
    );
    expect(errors).toEqual({
      firstName: 'This field is required',
      email: 'Enter a valid email address',
    });
  });

  it('reports only the first failing validator for a given field', () => {
    const errors = validateForm({ name: '' }, { name: [required('Required'), minLength(3)] });
    expect(errors).toEqual({ name: 'Required' });
  });

  it('ignores fields with no validators in the schema', () => {
    const errors = validateForm({ firstName: 'Ada', source: '' }, { firstName: [required()] });
    expect(errors).toEqual({});
  });
});
