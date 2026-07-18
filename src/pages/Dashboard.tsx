import { Badge } from '@/components/Badge';
import type { MrqAction, CrmInteraction, CrmContact } from '@/types/database.types';

export function Dashboard({ actions, interactions, contacts }: { actions: MrqAction[]; interactions: CrmInteraction[]; contacts: CrmContact[] }) {
  const p0 = actions.filter((a) => a.priority === 'P0' && a.status === 'Open');
  const blocked = actions.filter((a) => String(a.status || '').toLowerCase().includes('block'));
  const wk = [...actions].filter((a) => a.selected_for_week).sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
  const focus = wk.find((a) => a.priority === 'P0' && a.status === 'Open') ?? p0[0];
  const cut = new Date(Date.now() - 7 * 864e5);
  const recentInteractions = interactions.filter((i) => i.date && new Date(i.date) >= cut);
  const reached = new Set(recentInteractions.map((i) => i.contact_id)).size;

  const metrics: [string, number | string][] = [
    ['Open P0', p0.length],
    ['Blocked', blocked.length],
    ['Weekly load', `${wk.length}/7`],
    ['Stakeholders', contacts.length],
    ['Reached · 7d', reached],
    ['Interactions · 7d', recentInteractions.length],
  ];

  return (
    <>
      <div className="hero">
        <div className="label">One concrete next action</div>
        <div className="focus">{focus?.action || 'No open P0 action'}</div>
        <div className="small">{focus?.bucket || ''} · {focus?.next_step || ''}</div>
      </div>
      <div className="grid">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="label">{label}</div>
            <div className="metric">{value}</div>
          </div>
        ))}
      </div>
      <h2>CEO alerts</h2>
      <div className="alerts">
        <div className="alert">{wk.length > 7 ? 'Weekly plan overloaded' : `${wk.length}/7 weekly actions selected`}</div>
        <div className="alert">{recentInteractions.length ? 'Stakeholder activity recorded' : 'No CRM interaction in last 7 days'}</div>
        <div className="alert">{blocked.length} blocked action(s)</div>
      </div>
      <h2>This week</h2>
      <div className="week">
        {wk.map((a) => (
          <div className="card" key={a.id}>
            <Badge value={a.priority} /> <Badge value={a.status} />
            <h3>{a.action}</h3>
            <div className="small">{a.next_step || ''}</div>
          </div>
        ))}
      </div>
    </>
  );
}
