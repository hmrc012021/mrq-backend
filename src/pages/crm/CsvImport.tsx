import { useState } from 'react';
import { CONTACT_FIELDS } from '@/lib/crmFields';
import { supabase } from '@/lib/supabaseClient';
import type { CrmContact } from '@/types/database.types';

const CSV_HEADERS = CONTACT_FIELDS.map((f) => f.key);

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else { field += ch; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.length).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
    return obj;
  });
}

export function CsvImport({ contacts, filteredContacts, onClose, onImported }: { contacts: CrmContact[]; filteredContacts: CrmContact[]; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const lines = [CSV_HEADERS.join(',')];
    for (const c of filteredContacts) {
      lines.push(CSV_HEADERS.map((h) => csvEscape(c[h as keyof CrmContact])).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrq_crm_export_${filteredContacts.length}_contacts.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      const existingIds = new Set(contacts.map((c) => c.contact_id));
      const errs: string[] = [];
      parsed.forEach((r, i) => {
        if (!r.contact_id) errs.push(`Row ${i + 2}: missing contact_id`);
        else if (existingIds.has(r.contact_id)) errs.push(`Row ${i + 2}: contact_id ${r.contact_id} already exists — will overwrite`);
        if (!r.first_name && !r.last_name && !r.organization_name) errs.push(`Row ${i + 2}: no name or organization`);
      });
      setRows(parsed);
      setErrors(errs);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    const tagFields = new Set(CONTACT_FIELDS.filter((f) => f.tags).map((f) => f.key));
    const clean = rows.filter((r) => r.contact_id).map((r) => {
      const obj: Record<string, unknown> = {};
      CSV_HEADERS.forEach((k) => {
        if (r[k] === undefined || r[k] === '') return;
        obj[k] = tagFields.has(k) ? r[k].split(',').map((s) => s.trim()).filter(Boolean) : r[k];
      });
      return obj;
    });
    if (!clean.length) { alert('Nothing to import.'); return; }
    setImporting(true);
    try {
      await supabase.from('crm_contact').upsert(clean, { onConflict: 'contact_id' }).throwOnError();
      onImported();
      onClose();
    } catch (e) {
      alert('Import failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ padding: '16px 4px' }}>
      <h3 style={{ fontFamily: 'Cambria, serif', color: 'var(--b)' }}>Import contacts from CSV</h3>
      <p className="small">
        Use the exported template's column headers. <code>contact_id</code> is required for every row. Rows whose{' '}
        <code>contact_id</code> matches an existing contact will overwrite that record; new IDs are inserted as new contacts.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="btn ghost" style={{ cursor: 'pointer' }}>
          Choose CSV file
          <input type="file" accept=".csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn ghost" onClick={downloadTemplate}>Export current view as CSV</button>
        {rows.length > 0 && <button className="btn gold" disabled={importing} onClick={runImport}>Import {rows.length} rows</button>}
      </div>
      {errors.length > 0 && (
        <div className="small" style={{ color: '#a33', marginTop: 6 }}>
          {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}
      {rows.length > 0 && (
        <div className="csv-preview">
          <table className="preview">
            <thead><tr>{CSV_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{CSV_HEADERS.map((h) => <td key={h} title={r[h] || ''}>{r[h] || ''}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
