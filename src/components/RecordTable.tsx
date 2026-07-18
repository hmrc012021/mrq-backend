import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface FieldDef { key: string; label: string; }
export interface ColumnDef<T> { key: keyof T & string; label: string; render?: (v: unknown, row: T) => React.ReactNode; }

interface Props<T extends { id: string }> {
  title: string;
  table: string;
  rows: T[];
  columns: ColumnDef<T>[];
  formFields: FieldDef[];
  isAuthed: boolean;
  onRequireAuth: () => void;
  onReload: () => void;
}

export function RecordTable<T extends { id: string }>({ title, table, rows, columns, formFields, isAuthed, onRequireAuth, onReload }: Props<T>) {
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    if (!isAuthed) return onRequireAuth();
    setEditing('new');
  }
  function openEdit(row: T) {
    if (!isAuthed) return onRequireAuth();
    setEditing(row);
  }
  function close() {
    setEditing(null);
  }

  async function save(values: Record<string, string | null>) {
    setSaving(true);
    try {
      if (editing === 'new') {
        await supabase.from(table).insert([values]).throwOnError();
      } else if (editing) {
        await supabase.from(table).update(values).eq('id', editing.id).throwOnError();
      }
      close();
      onReload();
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (editing === 'new' || !editing) return;
    if (!confirm('Delete this record permanently?')) return;
    setSaving(true);
    try {
      await supabase.from(table).delete().eq('id', editing.id).throwOnError();
      close();
      onReload();
    } catch (e) {
      alert('Delete failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <h2>{title}</h2>
        <button className="btn gold" onClick={openAdd}>Add</button>
      </div>
      {rows.length === 0 ? (
        <div className="card small">No records.</div>
      ) : (
        <div className="wrap">
          <table>
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => openEdit(r)}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(r[c.key], r) : String(r[c.key] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecordModal
          title={editing === 'new' ? `Add ${title}` : `Edit ${title}`}
          fields={editing === 'new' ? formFields : formFields.filter((f) => f.key !== 'id')}
          initial={editing === 'new' ? {} : (editing as unknown as Record<string, string | null>)}
          canDelete={editing !== 'new'}
          saving={saving}
          onCancel={close}
          onDelete={del}
          onSave={save}
        />
      )}
    </>
  );
}

function RecordModal({
  title, fields, initial, canDelete, saving, onCancel, onDelete, onSave,
}: {
  title: string;
  fields: FieldDef[];
  initial: Record<string, string | null>;
  canDelete: boolean;
  saving: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (values: Record<string, string | null>) => void;
}) {
  const [values, setValues] = useState<Record<string, string | null>>(() => {
    const v: Record<string, string | null> = {};
    for (const f of fields) v[f.key] = initial[f.key] != null ? String(initial[f.key]) : '';
    return v;
  });

  return (
    <dialog open>
      <h2>{title}</h2>
      <div className="form">
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <p>
        <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>{' '}
        {canDelete && <button className="btn danger" onClick={onDelete} disabled={saving}>Delete</button>}{' '}
        <button
          className="btn gold"
          disabled={saving}
          onClick={() => {
            const cleaned: Record<string, string | null> = {};
            for (const [k, v] of Object.entries(values)) cleaned[k] = v === '' ? null : v;
            onSave(cleaned);
          }}
        >
          Save
        </button>
      </p>
    </dialog>
  );
}
