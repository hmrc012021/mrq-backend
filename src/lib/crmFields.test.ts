import { describe, it, expect } from 'vitest';
import { roleClass, CONTACT_FIELDS, INTERACTION_FIELDS, NOTE_FIELDS } from './crmFields';

describe('roleClass', () => {
  it('maps a known role to its CSS class', () => {
    expect(roleClass('curator')).toBe('role-curator');
  });
  it('falls back to role-general for an unknown role', () => {
    expect(roleClass('nonexistent_role')).toBe('role-general');
  });
});

describe('field definitions', () => {
  it('every CONTACT_FIELDS key is unique (a duplicate would silently shadow a form field)', () => {
    const keys = CONTACT_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('every INTERACTION_FIELDS key is unique', () => {
    const keys = INTERACTION_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('every NOTE_FIELDS key is unique', () => {
    const keys = NOTE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
