import { fmtLabel, contactDisplayName } from '@/lib/format';
import type { CrmContact, CrmInteraction, CrmNote } from '@/types/database.types';

export function Timeline({ interactions, contacts, notes }: { interactions: CrmInteraction[]; contacts: CrmContact[]; notes: CrmNote[] }) {
  const sorted = [...interactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return (
    <div style={{ padding: '16px 4px' }}>
      <h3 style={{ fontFamily: 'Cambria, serif', color: 'var(--b)' }}>All Interactions — Chronological</h3>
      {sorted.map((i) => {
        const c = contacts.find((x) => x.contact_id === i.contact_id);
        const nc = notes.filter((n) => n.interaction_id === i.interaction_id).length;
        return (
          <div className="timeline-row" key={i.interaction_id}>
            <div className="timeline-date">{i.date || ''}</div>
            <div className="timeline-who">
              <div className="n">{c ? contactDisplayName(c) : i.contact_id}</div>
              <div className="o">{c?.organization_name || ''}</div>
            </div>
            <div style={{ flex: 1 }}>
              <span className="chip">{fmtLabel(i.channel)}</span>
              {nc > 0 && <span className="chip-note">{nc}N</span>}
              <span style={{ fontSize: 12 }}> {i.meeting_goal || ''}</span>
              {i.next_action && <div className="int-next">→ {i.next_action}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
