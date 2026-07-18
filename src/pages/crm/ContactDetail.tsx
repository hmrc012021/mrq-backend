import { useState } from 'react';
import { CONTACT_FIELDS, GROUPS, GROUP_COLOR, roleClass } from '@/lib/crmFields';
import { fmtLabel, contactDisplayName } from '@/lib/format';
import type { CrmContact, CrmInteraction, CrmNote, Venue } from '@/types/database.types';

export function ContactDetail({
  contact, interactions, notes, venues, onClose, onEdit, onDelete, onNewInteraction, onOpenInteraction,
}: {
  contact: CrmContact;
  interactions: CrmInteraction[];
  notes: CrmNote[];
  venues: Venue[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewInteraction: () => void;
  onOpenInteraction: (id: string) => void;
}) {
  const [detailTab, setDetailTab] = useState<'master' | 'interactions'>('master');
  const ints = interactions.filter((i) => i.contact_id === contact.contact_id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  function venueLabel(venueId: string | null) {
    if (!venueId) return '';
    const v = venues.find((v) => v.venue_id === venueId);
    if (!v) return venueId;
    return `${v.venue_name}${v.city ? `, ${v.city}` : ''} (${v.venue_id})`;
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box wide">
        <div className="modal-body">
          <div className="detail-inner">
            <div className="detail-head">
              <div>
                <h2>{contactDisplayName(contact)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--g)' }}>{contact.contact_id}</span></h2>
                <div className="sub">{contact.title || ''}{contact.title && contact.organization_name ? ' · ' : ''}{contact.organization_name || ''}</div>
              </div>
              <div className="head-actions">
                <button className="btn-sm btn-navy" onClick={onEdit}>Edit</button>
                <button className="btn-sm btn-danger-outline" onClick={onDelete}>Delete</button>
                <button className="modal-close" onClick={onClose} style={{ marginLeft: 6 }}>&times;</button>
              </div>
            </div>
            <div className="detail-tabs">
              <button className={`dtab-btn${detailTab === 'master' ? ' active' : ''}`} onClick={() => setDetailTab('master')}>Master Data</button>
              <button className={`dtab-btn${detailTab === 'interactions' ? ' active' : ''}`} onClick={() => setDetailTab('interactions')}>
                Interactions <span className="n">{ints.length}</span>
              </button>
            </div>

            {detailTab === 'master' ? (
              Object.entries(GROUPS).map(([gk, gl]) => {
                const flds = CONTACT_FIELDS.filter((f) => f.group === gk && f.key !== 'contact_id').filter((f) => {
                  const v = contact[f.key as keyof CrmContact];
                  return Array.isArray(v) ? v.length > 0 : Boolean(v);
                });
                if (!flds.length) return null;
                return (
                  <div className="fgroup" key={gk}>
                    <div className="fgroup-title" style={{ color: GROUP_COLOR[gk], borderColor: GROUP_COLOR[gk] + '33' }}>{gl}</div>
                    <div className="fgrid">
                      {flds.map((f) => {
                        const raw = contact[f.key as keyof CrmContact];
                        let display: React.ReactNode;
                        if (f.key === 'institution_role' && Array.isArray(raw)) {
                          display = raw.map((t) => <span key={t} className={`tag-chip-sm ${roleClass(t)}`} style={{ fontSize: 14, padding: '4px 12px', marginRight: 4 }}>{fmtLabel(t)}</span>);
                        } else if (f.tags && Array.isArray(raw)) {
                          display = raw.map((t) => <span key={t} className="tag-chip">{fmtLabel(t)}</span>);
                        } else if (f.key === 'venue_id') {
                          display = venueLabel(raw as string);
                        } else {
                          display = fmtLabel(String(raw ?? ''));
                        }
                        return (
                          <div className={`fitem${f.multi ? ' full' : ''}`} key={f.key}>
                            <div className="flabel">{f.label}</div>
                            <div className="fval">{display}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="int-header">
                  <span className="lbl">Interactions ({ints.length})</span>
                  <button className="btn-sm btn-navy" onClick={onNewInteraction}>+ Interaction</button>
                </div>
                {ints.length === 0 ? (
                  <div style={{ color: '#999', fontStyle: 'italic', fontSize: 13 }}>No interactions yet</div>
                ) : (
                  ints.map((i) => {
                    const n = notes.filter((n) => n.interaction_id === i.interaction_id);
                    return (
                      <div className="int-card" key={i.interaction_id} onClick={() => onOpenInteraction(i.interaction_id)}>
                        <div className="int-top">
                          <div>
                            <div>
                              <span className="int-date">{i.date || ''}</span>
                              <span className="chip">{fmtLabel(i.channel)}</span>
                              {n.length > 0 && <span className="chip-note">{n.length} note{n.length > 1 ? 's' : ''}</span>}
                            </div>
                            {i.meeting_goal && <div className="int-goal">{i.meeting_goal}</div>}
                            {i.next_action && <div className="int-next">→ {i.next_action}</div>}
                          </div>
                          <span className="int-chevron">›</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
