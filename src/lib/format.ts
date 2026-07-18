export type BadgeTone = 'p0' | 'p1' | 'blocked' | 'done' | 'open';

export function badgeTone(v: string | null | undefined): BadgeTone {
  const x = String(v || '').toLowerCase();
  if (x === 'p0') return 'p0';
  if (x === 'p1') return 'p1';
  if (x.includes('block')) return 'blocked';
  if (x.includes('done') || x.includes('complete')) return 'done';
  return 'open';
}

export function fmtLabel(s: string | null | undefined): string {
  const clean = (s || '').toString().replace(/_/g, ' ');
  return clean.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function contactDisplayName(c: { first_name?: string | null; last_name?: string | null; organization_name?: string | null; contact_id: string }): string {
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.organization_name || c.contact_id;
}
