import { fmtLabel, contactDisplayName } from '@/lib/format';
import type { CrmContact, CrmInteraction, CrmNote } from '@/types/database.types';

export function InteractionPopup({
  interaction, contact, notes, onClose, onEditInteraction, onDeleteInteraction, onNewNote, onEditNote, onDeleteNote,
}: {
  interaction: CrmInteraction;
  contact: CrmContact | undefined;
  notes: CrmNote[];
  onClose: () => void;
  onEditInteraction: () => void;
  onDeleteInteraction: () => void;
  onNewNote: () => void;
  onEditNote: (n: CrmNote) => void;
  onDeleteNote: (id: string) => void;
}) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box wide">
        <div className="modal-head">
          <div>
            <h3>{interaction.date || ''} · {fmtLabel(interaction.channel)}</h3>
            <div className="sub" style={{ fontSize: 12, color: 'var(--m)' }}>{contact ? contactDisplayName(contact) : interaction.contact_id}</div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 14 }}>
            {interaction.meeting_goal && (
              <div className="fitem full"><div className="flabel">Meeting Goal</div><div className="fval">{interaction.meeting_goal}</div></div>
            )}
            {interaction.next_action && (
              <div className="fitem full"><div className="flabel">Next Action</div><div className="fval">{interaction.next_action}</div></div>
            )}
            <div className="fitem"><div className="flabel">Owner</div><div className="fval">{interaction.owner || '—'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
            <button className="btn-sm" style={{ border: '1px solid #ddd', background: '#fff' }} onClick={onEditInteraction}>Edit Interaction</button>
            <button className="btn-sm btn-danger-outline" onClick={onDeleteInteraction}>Delete Interaction</button>
          </div>
          <div className="int-header" style={{ marginTop: 0 }}>
            <span className="lbl" style={{ color: 'var(--gr)' }}>Notes ({notes.length})</span>
            <button className="btn-sm" style={{ background: 'var(--gr)', color: '#fff' }} onClick={onNewNote}>+ Note</button>
          </div>
          {notes.length === 0 ? (
            <div style={{ color: '#999', fontStyle: 'italic', fontSize: 13 }}>No notes yet</div>
          ) : (
            notes.map((n) => (
              <div className="note-card" key={n.note_id}>
                <div style={{ marginBottom: 8 }}>
                  {n.source_url ? (
                    <a href={n.source_url} target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--n)', fontWeight: 600 }}>📁 Link to Meeting Materials</a>
                  ) : (
                    <a href="#" onClick={(e) => { e.preventDefault(); onEditNote(n); }} style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>📁 + Add link to meeting materials</a>
                  )}
                </div>
                <div className="note-grid">
                  {(['what_you_asked_or_said', 'what_they_said_or_did', 'what_still_needs_confirming', 'what_to_do_about_it'] as const).map((k) => (
                    <div key={k}>
                      <div className="note-flabel">{fmtLabel(k)}</div>
                      <div className="fval">{n[k] || '—'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                  <button className="btn-sm" style={{ border: '1px solid #ddd', background: '#fff' }} onClick={() => onEditNote(n)}>Edit</button>
                  <button className="btn-sm btn-danger-outline" onClick={() => onDeleteNote(n.note_id)}>Del</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
