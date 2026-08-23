import { describe, it, expect } from 'vitest';
import { badgeTone, fmtLabel, contactDisplayName } from './format';

describe('badgeTone', () => {
  it('recognizes exact p0/p1 priority strings', () => {
    expect(badgeTone('P0')).toBe('p0');
    expect(badgeTone('p1')).toBe('p1');
  });
  it('matches "blocked" case-insensitively as a substring', () => {
    expect(badgeTone('Blocked - waiting on vendor')).toBe('blocked');
  });
  it('matches "done" or "complete" as a substring', () => {
    expect(badgeTone('done')).toBe('done');
    expect(badgeTone('Completed')).toBe('done');
  });
  it('defaults to open for anything unrecognized, null, or undefined', () => {
    expect(badgeTone('in progress')).toBe('open');
    expect(badgeTone(null)).toBe('open');
    expect(badgeTone(undefined)).toBe('open');
  });
});

describe('fmtLabel', () => {
  it('replaces underscores with spaces and title-cases each word', () => {
    expect(fmtLabel('waiting_for_them')).toBe('Waiting For Them');
  });
  it('returns empty string for null/undefined', () => {
    expect(fmtLabel(null)).toBe('');
    expect(fmtLabel(undefined)).toBe('');
  });
});

describe('contactDisplayName', () => {
  it('joins first and last name when both are present', () => {
    expect(contactDisplayName({ first_name: 'Ada', last_name: 'Lovelace', contact_id: 'C1' })).toBe('Ada Lovelace');
  });
  it('falls back to organization_name when no name is set', () => {
    expect(contactDisplayName({ organization_name: 'The Met', contact_id: 'C1' })).toBe('The Met');
  });
  it('falls back to contact_id as the last resort', () => {
    expect(contactDisplayName({ contact_id: 'C1' })).toBe('C1');
  });
});
