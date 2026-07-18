import { badgeTone } from '@/lib/format';

export function Badge({ value }: { value: string | null | undefined }) {
  return <span className={`badge ${badgeTone(value)}`}>{value || '—'}</span>;
}
