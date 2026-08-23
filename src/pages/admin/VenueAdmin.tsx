import { useEffect, useMemo, useState } from 'react';
import { callMrqApi, MrqApiError } from '@/lib/mrqApi';

// Ported from the standalone mrq_venue_admin_v2.html tool. Legacy talked to
// PostgREST directly with the anon key (client-side) -- same "no ownership
// check" shape as the old passthrough every other tool used. Calls the new
// narrow, authenticated getVenuesAdminData/saveVenue/deleteVenue instead.
type Venue = {
  venue_id: string; venue_name: string | null; parent_venue_id: string | null; venue_kind: string | null;
  institution_type: string | null; city: string | null; country: string | null; catalog_access_type: string | null;
  website_url: string | null; collection_url: string | null; inventory_lookup_supported: string | null; notes: string | null;
};

const INSTITUTION_TYPES = ['museum', 'church_or_chapel', 'academy', 'library', 'institution', 'gallery', 'archive', 'university', 'private_collection', 'other'];
const INST_CLASS: Record<string, string> = { museum: 'role-director', church_or_chapel: 'role-digital', academy: 'role-access', library: 'role-curator' };

const FILTERABLE_FIELDS: { key: keyof Venue; label: string }[] = [
  { key: 'institution_type', label: 'Institution Type' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'venue_kind', label: 'Venue Kind' },
  { key: 'catalog_access_type', label: 'Catalog Access' },
  { key: 'inventory_lookup_supported', label: 'Inventory Lookup' },
];

type EditState = {
  isNew: boolean;
  venue_id: string; venue_name: string; parent_venue_id: string; venue_kind: string; institution_type: string;
  city: string; country: string; catalog_access_type: string; website_url: string; collection_url: string;
  inventory_lookup_supported: string; notes: string;
};

function emptyEdit(): EditState {
  return { isNew: true, venue_id: '', venue_name: '', parent_venue_id: '', venue_kind: 'site', institution_type: '', city: '', country: '', catalog_access_type: '', website_url: '', collection_url: '', inventory_lookup_supported: '', notes: '' };
}

export function VenueAdmin() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState('');
  const [pendingFilterKey, setPendingFilterKey] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  function say(type: 'ok' | 'err' | 'info', text: string) {
    setMsg({ type, text });
    if (type === 'ok') setTimeout(() => setMsg(null), 3000);
  }

  async function load() {
    setLoading(true);
    say('info', 'Loading venues…');
    try {
      const res = await callMrqApi('getVenuesAdminData');
      setVenues(res.data || []);
      say('ok', `Loaded ${(res.data || []).length} venues`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const byId = useMemo(() => { const m: Record<string, Venue> = {}; for (const v of venues) m[v.venue_id] = v; return m; }, [venues]);

  const topTypes = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const v of venues) byType[v.institution_type || ''] = (byType[v.institution_type || ''] || 0) + 1;
    return Object.entries(byType).filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [venues]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return venues.filter((v) => {
      if (q) {
        const hay = [v.venue_name, v.city, v.country, v.notes].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const key in activeFilters) {
        if ((v as any)[key] !== activeFilters[key]) return false;
      }
      return true;
    });
  }, [venues, search, activeFilters]);

  const ordered = useMemo(() => {
    const filteredIds = new Set(filtered.map((v) => v.venue_id));
    const parents = filtered.filter((v) => !v.parent_venue_id).sort((a, b) => (a.venue_name || '').localeCompare(b.venue_name || ''));
    const out: { v: Venue; child: boolean }[] = [];
    const seen = new Set<string>();
    for (const p of parents) {
      out.push({ v: p, child: false }); seen.add(p.venue_id);
      const children = venues.filter((c) => c.parent_venue_id === p.venue_id && filteredIds.has(c.venue_id)).sort((a, b) => (a.venue_name || '').localeCompare(b.venue_name || ''));
      for (const c of children) { out.push({ v: c, child: true }); seen.add(c.venue_id); }
    }
    for (const v of filtered) if (!seen.has(v.venue_id)) { out.push({ v, child: !!v.parent_venue_id }); seen.add(v.venue_id); }
    return out;
  }, [filtered, venues]);

  const usedFilterKeys = new Set(Object.keys(activeFilters));

  function openNew() { setEdit(emptyEdit()); }
  function openEdit(id: string) {
    const v = byId[id]; if (!v) return;
    setEdit({
      isNew: false, venue_id: v.venue_id, venue_name: v.venue_name || '', parent_venue_id: v.parent_venue_id || '',
      venue_kind: v.venue_kind || '', institution_type: v.institution_type || '', city: v.city || '', country: v.country || '',
      catalog_access_type: v.catalog_access_type || '', website_url: v.website_url || '', collection_url: v.collection_url || '',
      inventory_lookup_supported: v.inventory_lookup_supported || '', notes: v.notes || '',
    });
  }
  function closeEdit() { setEdit(null); }

  async function save() {
    if (!edit) return;
    if (!edit.venue_id.trim()) { say('err', 'Venue ID is required'); return; }
    setSaving(true);
    const payload = {
      venue_id: edit.venue_id.trim(), is_new: edit.isNew,
      venue_name: edit.venue_name || null, parent_venue_id: edit.parent_venue_id || null, venue_kind: edit.venue_kind || null,
      institution_type: edit.institution_type || null, city: edit.city || null, country: edit.country || null,
      catalog_access_type: edit.catalog_access_type || null, website_url: edit.website_url || null, collection_url: edit.collection_url || null,
      inventory_lookup_supported: edit.inventory_lookup_supported || null, notes: edit.notes || null,
    };
    try {
      await callMrqApi('saveVenue', payload);
      say('ok', `Saved ${payload.venue_id}`);
      closeEdit();
      await load();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!edit) return;
    if (!confirm(`Delete ${edit.venue_id}? This cannot be undone.`)) return;
    try {
      await callMrqApi('deleteVenue', { venue_id: edit.venue_id });
      say('ok', `Deleted ${edit.venue_id}`);
      closeEdit();
      await load();
    } catch (e) {
      say('err', `Delete failed: ${e instanceof MrqApiError ? e.message : String(e)} — if other records reference this venue, you may need to reassign them first.`);
    }
  }

  return (
    <div>
      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, background: msg.type === 'ok' ? '#ddeee3' : msg.type === 'err' ? '#f5dad7' : '#dceafb', color: msg.type === 'ok' ? '#2d6a4f' : msg.type === 'err' ? '#8b2e23' : '#0c4a8c', fontSize: 13 }}>{msg.text}</div>}

      <div className="toolbar">
        <h2>Venue Admin</h2>
        <button className="btn gold" onClick={openNew}>+ New Venue</button>
        <button className="btn ghost" onClick={load}>↺ Reload</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${1 + topTypes.length},1fr)`, marginBottom: 14 }}>
        <div className="card" style={{ cursor: 'pointer', border: !Object.keys(activeFilters).length ? '1px solid var(--g)' : undefined }} onClick={() => setActiveFilters({})}><div className="metric">{venues.length}</div><div className="label">all venues</div></div>
        {topTypes.map(([t, n]) => (
          <div key={t} className="card" style={{ cursor: 'pointer', border: activeFilters.institution_type === t ? '1px solid var(--g)' : undefined }} onClick={() => setActiveFilters({ institution_type: t })}><div className="metric">{n}</div><div className="label">{t.replace(/_/g, ' ')}</div></div>
        ))}
      </div>

      <div className="crm-toolbar">
        <input placeholder="Search name, city, country, notes…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        {Object.entries(activeFilters).map(([key, val]) => {
          const def = FILTERABLE_FIELDS.find((d) => d.key === key)!;
          return (
            <span key={key} className="filter-chip">
              {def.label}: <b>{val.replace(/_/g, ' ')}</b>
              <button onClick={() => setActiveFilters((prev) => { const n = { ...prev }; delete n[key]; return n; })}>✕</button>
            </span>
          );
        })}
        <select value={pendingFilterKey} onChange={(e) => setPendingFilterKey(e.target.value)}>
          <option value="">+ Add filter</option>
          {FILTERABLE_FIELDS.filter((d) => !usedFilterKeys.has(d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        {pendingFilterKey && (() => {
          const def = FILTERABLE_FIELDS.find((d) => d.key === pendingFilterKey)!;
          const opts = [...new Set(venues.map((v) => (v as any)[def.key]).filter(Boolean))].sort();
          return (
            <select value="" onChange={(e) => {
              const val = e.target.value;
              if (val) { setActiveFilters((prev) => ({ ...prev, [pendingFilterKey]: val })); setPendingFilterKey(''); }
            }}>
              <option value="">— pick {def.label.toLowerCase()} —</option>
              {opts.map((v) => <option key={v} value={v}>{String(v).replace(/_/g, ' ')}</option>)}
            </select>
          );
        })()}
        {(search || Object.keys(activeFilters).length > 0) && (
          <button className="clear-filters" onClick={() => { setSearch(''); setActiveFilters({}); }}>Clear filters</button>
        )}
        <span className="small" style={{ marginLeft: 'auto' }}>{filtered.length} of {venues.length}</span>
      </div>

      {edit && (
        <div className="card" style={{ border: '2px solid var(--g)', marginBottom: 14 }}>
          <div className="detail-head">
            <h2 style={{ fontSize: 16 }}>{edit.isNew ? 'New Venue' : `Edit Venue — ${edit.venue_id}`}</h2>
            <button className="btn ghost btn-sm" onClick={closeEdit}>✕ Close</button>
          </div>
          <div className="fgrid">
            <div className="fitem"><label className="flabel">venue_id</label><input value={edit.venue_id} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, venue_id: e.target.value })} placeholder="e.g. LOC-999" /></div>
            <div className="fitem full" style={{ gridColumn: '1 / -1' }}><label className="flabel">venue_name</label><input value={edit.venue_name} onChange={(e) => setEdit({ ...edit, venue_name: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">parent_venue_id</label>
              <select value={edit.parent_venue_id} onChange={(e) => setEdit({ ...edit, parent_venue_id: e.target.value })}>
                <option value="">— No parent —</option>
                {venues.filter((v) => v.venue_id !== edit.venue_id).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name} ({v.venue_id})</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">venue_kind</label><input value={edit.venue_kind} onChange={(e) => setEdit({ ...edit, venue_kind: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">institution_type</label>
              <select value={edit.institution_type} onChange={(e) => setEdit({ ...edit, institution_type: e.target.value })}>
                <option value="">—</option>
                {INSTITUTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">city</label><input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">country</label><input value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">catalog_access_type</label>
              <select value={edit.catalog_access_type} onChange={(e) => setEdit({ ...edit, catalog_access_type: e.target.value })}>
                <option value="">—</option><option value="WEB">WEB</option><option value="API">API</option><option value="NONE">NONE</option>
              </select>
            </div>
            <div className="fitem"><label className="flabel">inventory_lookup_supported</label>
              <select value={edit.inventory_lookup_supported} onChange={(e) => setEdit({ ...edit, inventory_lookup_supported: e.target.value })}>
                <option value="">—</option><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option>
              </select>
            </div>
            <div className="fitem" style={{ gridColumn: '1 / -1' }}><label className="flabel">website_url</label><input value={edit.website_url} onChange={(e) => setEdit({ ...edit, website_url: e.target.value })} /></div>
            <div className="fitem" style={{ gridColumn: '1 / -1' }}><label className="flabel">collection_url</label><input value={edit.collection_url} onChange={(e) => setEdit({ ...edit, collection_url: e.target.value })} /></div>
            <div className="fitem" style={{ gridColumn: '1 / -1' }}><label className="flabel">notes</label><textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
            <button className="btn gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn ghost" onClick={closeEdit}>Cancel</button>
            {!edit.isNew && <button className="btn btn-sm btn-danger-outline" style={{ marginLeft: 'auto' }} onClick={doDelete}>Delete</button>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card small">Loading venues…</div>
      ) : (
        <div className="wrap">
          <table>
            <thead><tr><th>Venue</th><th>Type</th><th>City</th><th>Country</th><th>Access</th><th>Lookup</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {!ordered.length ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--m)', padding: 30 }}>No venues match</td></tr>
              ) : ordered.map(({ v, child }) => (
                <tr key={v.venue_id}>
                  <td>
                    {child && <span style={{ color: 'var(--m)', marginRight: 4 }}>↳</span>}
                    <strong>{v.venue_name || v.venue_id}</strong><br /><span className="small" style={{ fontFamily: 'monospace' }}>{v.venue_id}</span>
                  </td>
                  <td>{v.institution_type && <span className={`tag-chip-sm ${INST_CLASS[v.institution_type] || 'role-general'}`}>{v.institution_type.replace(/_/g, ' ')}</span>}</td>
                  <td className="small">{v.city || ''}</td>
                  <td className="small">{v.country || ''}</td>
                  <td className="small">{v.catalog_access_type || ''}</td>
                  <td className="small">
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 4, background: v.inventory_lookup_supported === 'TRUE' ? '#27500A' : '#E0D9D0' }} />
                    {v.inventory_lookup_supported || ''}
                  </td>
                  <td className="small" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || ''}</td>
                  <td><button className="btn ghost btn-sm" onClick={() => openEdit(v.venue_id)}>✎</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
