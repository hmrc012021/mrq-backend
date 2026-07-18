import type { MrqData } from '@/lib/useMrqData';

export function System({ data, authed }: { data: MrqData; authed: boolean }) {
  const rows: [string, number, number][] = [
    ['Actions', data.actions.length, 30],
    ['Deliverables', data.deliverables.length, 20],
    ['Decisions', data.decisions.length, 10],
    ['Milestones', data.milestones.length, 12],
    ['Reconciliation', data.reconciliation.length, 25],
    ['Raw extracts', data.raw.length, 14],
  ];
  return (
    <>
      <h2>System Health</h2>
      <div className="grid">
        {rows.map(([label, count, expected]) => (
          <div className="card" key={label}>
            <div className="label">{label}</div>
            <div className="metric">{count}</div>
            <div className="small">Expected {expected}</div>
          </div>
        ))}
      </div>
      <h2>Connection</h2>
      <div className="card">
        Supabase project: fbqftcueccachcdkivln<br />
        Architecture: Supabase-only.<br />
        Mode: {authed ? 'Authenticated' : 'Read only'}
      </div>
    </>
  );
}
