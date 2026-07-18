import { useState } from 'react';
import { CONTACT_FIELDS, INTERACTION_FIELDS, NOTE_FIELDS, GROUPS, GROUP_COLOR, type CrmFieldDef } from '@/lib/crmFields';
import { fmtLabel } from '@/lib/format';
import type { Venue } from '@/types/database.types';
import type { EditingItem } from './crmTypes';

function fieldsFor(type: EditingItem['type']): CrmFieldDef[] {
  if (type === 'contact') return CONTACT_FIELDS;
  if (type === 'interaction') return INTERACTION_FIELDS;
  return NOTE_FIELDS;
}
function skipFor(type: EditingItem['type']): string[] {
  if (type === 'contact') return ['contact_id'];
  if (type === 'interaction') return ['interaction_id', 'contact_id'];
  return ['note_id', 'interaction_id'];
}
function idKeyFor(type: EditingItem['type']): string {
  if (type === 'contact') return 'contact_id';
  if (type === 'interaction') return 'interaction_id';
  return 'note_id';
}
function labelFor(type: EditingItem['type']): string {
  if (type === 'contact') return 'Contact';
  if (type === 'interaction') return 'Interaction';
  return 'Note';
}

export function CrmEditModal({
  editing, venues, saving, onCancel, onSave,
}: {
  editing: EditingItem;
  venues: Venue[];
  saving: boolean;
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const fields = fieldsFor(editing.type);
  const skip = skipFor(editing.type);
  const visible = fields.filter((f) => !skip.includes(f.key));
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...editing.item }));

  function setField(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function fieldInput(f: CrmFieldDef) {
    const raw = values[f.key];
    if (f.key === 'venue_id') {
      return (
        <select className="f-in" value={(raw as string) ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
          <option value="">— No venue —</option>
          {venues.map((v) => (
            <option key={v.venue_id} value={v.venue_id}>
              {v.venue_name}{v.city ? `, ${v.city}` : ''} ({v.venue_id})
            </option>
          ))}
        </select>
      );
    }
    if (f.opts) {
      return (
        <select className="f-in" value={(raw as string) ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
          <option value="">—</option>
          {f.opts.map((o) => (
            <option key={o} value={o}>{fmtLabel(o) || '—'}</option>
          ))}
        </select>
      );
    }
    if (f.multi) {
      return (
        <textarea
          className="f-in"
          rows={5}
          value={(raw as string) ?? ''}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      );
    }
    if (f.tags) {
      const display = Array.isArray(raw) ? raw.join(', ') : (raw as string) ?? '';
      return (
        <input
          className="f-in"
          value={display}
          placeholder={f.key === 'institution_role' ? 'general, director, curator, digital, access, gatekeeper' : 'comma-separated'}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      );
    }
    return <input className="f-in" value={(raw as string) ?? ''} onChange={(e) => setField(f.key, e.target.value)} />;
  }

  function submit() {
    const out: Record<string, unknown> = {};
    for (const f of visible) {
      const v = values[f.key];
      if (f.tags) {
        const str = Array.isArray(v) ? v.join(', ') : String(v ?? '');
        const arr = str.split(',').map((s) => s.trim()).filter(Boolean);
        out[f.key] = arr.length ? arr : null;
      } else {
        out[f.key] = v === '' || v == null ? null : v;
      }
    }
    onSave(out);
  }

  const body =
    editing.type === 'contact' ? (
      Object.entries(GROUPS).map(([gk, gl]) => (
        <div className="fgroup" key={gk}>
          <div className="fgroup-title" style={{ color: GROUP_COLOR[gk], borderColor: GROUP_COLOR[gk] + '33' }}>{gl}</div>
          <div className="fgrid">
            {visible.filter((f) => f.group === gk).map((f) => (
              <div className={`fitem${f.multi ? ' full' : ''}`} key={f.key}>
                <label className="flabel">{f.label}</label>
                {fieldInput(f)}
              </div>
            ))}
          </div>
        </div>
      ))
    ) : (
      <div className="fgrid" style={{ gridTemplateColumns: editing.type === 'note' ? '1fr' : '1fr 1fr' }}>
        {visible.map((f) => (
          <div className={`fitem${f.multi ? ' full' : ''}`} key={f.key}>
            <label className="flabel">{f.label}</label>
            {fieldInput(f)}
          </div>
        ))}
      </div>
    );

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>{editing.isNew ? 'New ' : 'Edit '}{labelFor(editing.type)}</h3>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <div className="modal-body">{body}</div>
        <div className="modal-foot">
          <button className="btn-sm btn-navy" disabled={saving} onClick={submit}>Save</button>
          <button className="btn-sm" style={{ border: '1px solid #ccc', background: '#fff' }} disabled={saving} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export { idKeyFor };
