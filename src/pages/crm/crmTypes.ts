import type { CrmContact, CrmInteraction, CrmNote } from '@/types/database.types';

export type EditingItem =
  | { type: 'contact'; item: Partial<CrmContact>; isNew: boolean }
  | { type: 'interaction'; item: Partial<CrmInteraction>; isNew: boolean }
  | { type: 'note'; item: Partial<CrmNote>; isNew: boolean };

export function nextId<T>(prefix: string, list: T[], idKey: keyof T): string {
  const nums = list
    .map((x) => parseInt((String(x[idKey] ?? '').match(/\d+/) || ['0'])[0], 10))
    .filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
