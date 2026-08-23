import { useEffect, useMemo, useState } from 'react';
import { callMrqApi, MrqApiError } from '@/lib/mrqApi';

// Ported from the standalone mrq_encounter_admin_v14.html tool. Legacy scoped
// every read to one visit at a time (a handful to a few dozen rows) rather than
// loading the whole encounter table -- kept that shape here, since it sidesteps
// the >1000-row cap issue other admin ports had to solve with fetchAll.
type Visit = { visit_id: string; venue_id: string | null; visit_date: string | null; visit_type: string | null; companions: string | null; notes: string | null };
type Venue = { venue_id: string; venue_name: string | null; city: string | null; country: string | null };
type Encounter = {
  encounter_id: string; user_id: string | null; encounter_work_id: string | null; encounter_visit_id: string | null;
  encounter_display_group_id: string | null; encounter_learning_path_id: string | null;
  confirmation_method: string | null; encounter_timestamp: string | null; notes: string | null;
  work_title: string | null; work_type: string | null; work_attribution: string | null; catalogue_reference: string | null;
};

const NO_VISIT = '__none__';
const METHODS = ['manual', 'voice', 'photo', 'scan', 'label'];

type EditState = {
  encounter_id: string; user_id: string;
  encounter_work_id: string; encounter_visit_id: string; encounter_display_group_id: string; encounter_learning_path_id: string;
  confirmation_method: string; encounter_timestamp: string; notes: string;
};

type VisitEditState = { visit_id: string; venue_id: string; visit_date: string; visit_type: string; companions: string; notes: string };

export function EncounterAdmin() {
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [currentVisit, setCurrentVisit] = useState<string | null>(null);
  const [rows, setRows] = useState<Encounter[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [pendingFilterKey, setPendingFilterKey] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortCol, setSortCol] = useState('encounter_id');
  const [sortDir, setSortDir] = useState(1);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const [visitEdit, setVisitEdit] = useState<VisitEditState | null>(null);
  const [visitSaving, setVisitSaving] = useState(false);

  const [showNewVisit, setShowNewVisit] = useState(false);
  const [nvVenue, setNvVenue] = useState('');
  const [nvDate, setNvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nvType, setNvType] = useState('in_person');
  const [nvCompanions, setNvCompanions] = useState('');
  const [nvNotes, setNvNotes] = useState('');
  const [nvSaving, setNvSaving] = useState(false);

  function say(type: 'ok' | 'err' | 'info', text: string) {
    setMsg({ type, text });
    if (type === 'ok') setTimeout(() => setMsg(null), 3500);
  }

  async function loadOverview() {
    setOverviewLoading(true);
    say('info', 'Loading visits…');
    try {
      const res = await callMrqApi('getEncounterAdminOverview');
      setVisitCounts(res.data.visitCounts);
      setVisits(res.data.visits);
      setVenues(res.data.venues);
      say('ok', `${Object.keys(res.data.visitCounts).length} visits found`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setOverviewLoading(false);
    }
  }

  useEffect(() => { loadOverview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const venueMap = useMemo(() => { const m: Record<string, Venue> = {}; for (const v of venues) m[v.venue_id] = v; return m; }, [venues]);
  const visitMap = useMemo(() => { const m: Record<string, Visit> = {}; for (const v of visits) m[v.visit_id] = v; return m; }, [visits]);

  const visitList = useMemo(() => {
    return Object.entries(visitCounts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visitCounts]);

  async function selectVisit(visitId: string) {
    setCurrentVisit(visitId);
    setActiveFilters({});
    setSearch('');
    setRowsLoading(true);
    say('info', `Loading visit ${visitId === NO_VISIT ? '(no visit)' : visitId}…`);
    try {
      const res = await callMrqApi('getVisitEncounters', { visit_id: visitId });
      setRows(res.data || []);
      say('ok', `Loaded ${(res.data || []).length} encounters`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setRowsLoading(false);
    }
  }

  function changeVisit() {
    setCurrentVisit(null);
    setRows([]);
    loadOverview();
  }

  const FILTER_DEFS = useMemo(() => [
    { key: 'displayGroup', label: 'Display Group', match: (r: Encounter, v: string) => v === '__none__' ? !r.encounter_display_group_id : r.encounter_display_group_id === v, optionLabel: (v: string) => v === '__none__' ? '⚠ No DG' : v, options: () => ['__none__', ...new Set(rows.map((r) => r.encounter_display_group_id).filter(Boolean) as string[])].sort() },
    { key: 'learningPath', label: 'Learning Path', match: (r: Encounter, v: string) => r.encounter_learning_path_id === v, options: () => [...new Set(rows.map((r) => r.encounter_learning_path_id).filter(Boolean) as string[])].sort() },
    { key: 'method', label: 'Method', match: (r: Encounter, v: string) => r.confirmation_method === v, options: () => METHODS },
    { key: 'workType', label: 'Work Type', match: (r: Encounter, v: string) => (r.work_type || '__none__') === v, optionLabel: (v: string) => v === '__none__' ? '⚠ No type' : v, options: () => ['__none__', ...new Set(rows.map((r) => r.work_type).filter(Boolean) as string[])].sort() },
    { key: 'attribution', label: 'Attribution', match: (r: Encounter, v: string) => (r.work_attribution || '__none__') === v, optionLabel: (v: string) => v === '__none__' ? '⚠ No attribution' : v, options: () => ['__none__', ...new Set(rows.map((r) => r.work_attribution).filter(Boolean) as string[])].sort() },
  ], [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let out = rows.filter((r) => {
      if (q) {
        const hay = [r.encounter_id, r.encounter_work_id, r.work_title, r.catalogue_reference].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const key in activeFilters) {
        const def = FILTER_DEFS.find((d) => d.key === key);
        if (def && !def.match(r, activeFilters[key])) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const va = String((a as any)[sortCol] ?? '').toLowerCase();
      const vb = String((b as any)[sortCol] ?? '').toLowerCase();
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
    return out;
  }, [rows, search, activeFilters, sortCol, sortDir, FILTER_DEFS]);

  const stats = useMemo(() => ({
    total: rows.length,
    shown: filtered.length,
    noDg: rows.filter((r) => !r.encounter_display_group_id).length,
  }), [rows, filtered]);

  function sortBy(c: string) { if (sortCol === c) setSortDir((d) => -d); else { setSortCol(c); setSortDir(1); } }
  const usedFilterKeys = new Set(Object.keys(activeFilters));

  function openEdit(encId: string) {
    const r = rows.find((x) => x.encounter_id === encId); if (!r) return;
    setEdit({
      encounter_id: r.encounter_id, user_id: r.user_id || '',
      encounter_work_id: r.encounter_work_id || '', encounter_visit_id: r.encounter_visit_id || '',
      encounter_display_group_id: r.encounter_display_group_id || '', encounter_learning_path_id: r.encounter_learning_path_id || '',
      confirmation_method: r.confirmation_method || '', encounter_timestamp: r.encounter_timestamp ? r.encounter_timestamp.slice(0, 10) : '',
      notes: r.notes || '',
    });
  }
  function closeEdit() { setEdit(null); }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const payload = {
      encounter_id: edit.encounter_id,
      encounter_work_id: edit.encounter_work_id.trim() || null,
      encounter_visit_id: edit.encounter_visit_id.trim() || null,
      encounter_display_group_id: edit.encounter_display_group_id.trim() || null,
      encounter_learning_path_id: edit.encounter_learning_path_id.trim() || null,
      confirmation_method: edit.confirmation_method || null,
      notes: edit.notes.trim() || null,
      encounter_timestamp: edit.encounter_timestamp || null,
    };
    try {
      await callMrqApi('saveEncounter', payload);
      say('ok', `✓ ${edit.encounter_id} saved`);
      closeEdit();
      if (currentVisit) await selectVisit(currentVisit);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEncounter() {
    if (!edit) return;
    if (!confirm(`Delete encounter ${edit.encounter_id}? This cannot be undone.`)) return;
    try {
      await callMrqApi('deleteEncounter', { encounter_id: edit.encounter_id });
      say('ok', `✓ ${edit.encounter_id} deleted`);
      closeEdit();
      if (currentVisit) await selectVisit(currentVisit);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    }
  }

  async function createVisit() {
    if (!nvVenue) { say('err', 'Pick a venue first'); return; }
    if (!nvDate) { say('err', 'Pick a date first'); return; }
    setNvSaving(true);
    try {
      const res = await callMrqApi('createVisit', { venue_id: nvVenue, visit_date: nvDate, visit_type: nvType, companions: nvCompanions.trim() || null, notes: nvNotes.trim() || null });
      say('ok', `✓ Created ${res.data.visit_id}`);
      setNvCompanions(''); setNvNotes(''); setShowNewVisit(false);
      await loadOverview();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setNvSaving(false);
    }
  }

  function openVisitEdit() {
    if (!currentVisit || currentVisit === NO_VISIT) return;
    const v = visitMap[currentVisit]; if (!v) return;
    setVisitEdit({
      visit_id: v.visit_id, venue_id: v.venue_id || '', visit_date: v.visit_date || '',
      visit_type: v.visit_type || 'in_person', companions: v.companions || '', notes: v.notes || '',
    });
  }
  function closeVisitEdit() { setVisitEdit(null); }

  async function saveVisitEdit() {
    if (!visitEdit) return;
    if (!visitEdit.venue_id) { say('err', 'Venue required'); return; }
    if (!visitEdit.visit_date) { say('err', 'Date required'); return; }
    setVisitSaving(true);
    try {
      await callMrqApi('saveVisit', {
        visit_id: visitEdit.visit_id, venue_id: visitEdit.venue_id, visit_date: visitEdit.visit_date,
        visit_type: visitEdit.visit_type, companions: visitEdit.companions.trim() || null, notes: visitEdit.notes.trim() || null,
      });
      say('ok', `✓ ${visitEdit.visit_id} saved`);
      closeVisitEdit();
      await loadOverview();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setVisitSaving(false);
    }
  }

  return (
    <div>
      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, background: msg.type === 'ok' ? '#ddeee3' : msg.type === 'err' ? '#f5dad7' : '#dceafb', color: msg.type === 'ok' ? '#2d6a4f' : msg.type === 'err' ? '#8b2e23' : '#0c4a8c', fontSize: 13 }}>{msg.text}</div>}

      {!currentVisit ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 8 }}>Select a visit to load</div>
          {overviewLoading ? (
            <div className="small">Loading visits…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
              {visitList.map(([vid, count]) => {
                const vi = vid !== NO_VISIT ? visitMap[vid] : null;
                const venue = vi?.venue_id ? venueMap[vi.venue_id] : null;
                const metaParts = [];
                if (venue) metaParts.push(`${venue.venue_name || venue.venue_id}${venue.city ? ', ' + venue.city : ''}${venue.country ? ', ' + venue.country : ''}`);
                if (vi?.visit_date) metaParts.push(vi.visit_date);
                if (vi?.visit_type) metaParts.push(vi.visit_type);
                return (
                  <div key={vid} className="clickable" onClick={() => selectVisit(vid)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', border: '1px solid var(--l)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{vid === NO_VISIT ? '(no visit)' : vid}</div>
                      <div className="small" style={{ marginTop: 2 }}>{metaParts.length ? metaParts.join(' · ') : (vid === NO_VISIT ? 'encounters not attached to any visit' : <span style={{ color: 'var(--r)' }}>no visit record found</span>)}</div>
                    </div>
                    <span className="small">{count} encounter{count !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--l)' }}>
            <button className="btn btn-sm btn-navy" onClick={() => setShowNewVisit((s) => !s)}>+ New Visit</button>
            {showNewVisit && (
              <div className="fgrid" style={{ marginTop: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="fitem"><label className="flabel">Venue</label>
                  <select value={nvVenue} onChange={(e) => setNvVenue(e.target.value)}>
                    <option value="">— select venue —</option>
                    {[...venues].sort((a, b) => (a.venue_name || a.venue_id).localeCompare(b.venue_name || b.venue_id)).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name}{v.city ? `, ${v.city}` : ''}</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">Date</label><input type="date" value={nvDate} onChange={(e) => setNvDate(e.target.value)} /></div>
                <div className="fitem"><label className="flabel">Visit type</label>
                  <select value={nvType} onChange={(e) => setNvType(e.target.value)}>
                    <option value="in_person">in_person</option><option value="virtual">virtual</option>
                  </select>
                </div>
                <div className="fitem"><label className="flabel">Companions</label><input value={nvCompanions} onChange={(e) => setNvCompanions(e.target.value)} placeholder="optional" /></div>
                <div className="fitem" style={{ gridColumn: '1 / -1' }}><label className="flabel">Notes</label><input value={nvNotes} onChange={(e) => setNvNotes(e.target.value)} placeholder="optional" /></div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-navy" onClick={createVisit} disabled={nvSaving}>{nvSaving ? 'Creating…' : 'Create visit'}</button>
                  <button className="btn ghost btn-sm" onClick={() => setShowNewVisit(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eeedfe', border: '1px solid #d8d4f5', borderRadius: 6, padding: '8px 14px', marginBottom: 12, fontSize: 13 }}>
            Viewing visit: <b style={{ fontFamily: 'monospace', color: '#3c3489' }}>{currentVisit === NO_VISIT ? '(no visit)' : currentVisit}</b>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {currentVisit !== NO_VISIT && <button className="btn ghost btn-sm" onClick={openVisitEdit}>✎ Edit visit details</button>}
              <button className="btn ghost btn-sm" onClick={changeVisit}>↺ Change visit</button>
            </div>
          </div>

          {visitEdit && (
            <div className="card" style={{ border: '2px solid var(--g)', marginBottom: 14 }}>
              <div className="detail-head">
                <h2 style={{ fontSize: 16 }}>Edit visit — {visitEdit.visit_id}</h2>
                <button className="btn ghost btn-sm" onClick={closeVisitEdit}>✕ Close</button>
              </div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="fitem"><label className="flabel">Venue</label>
                  <select value={visitEdit.venue_id} onChange={(e) => setVisitEdit({ ...visitEdit, venue_id: e.target.value })}>
                    {[...venues].sort((a, b) => (a.venue_name || a.venue_id).localeCompare(b.venue_name || b.venue_id)).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name}{v.city ? `, ${v.city}` : ''}</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">Date</label><input type="date" value={visitEdit.visit_date} onChange={(e) => setVisitEdit({ ...visitEdit, visit_date: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">Visit type</label>
                  <select value={visitEdit.visit_type} onChange={(e) => setVisitEdit({ ...visitEdit, visit_type: e.target.value })}>
                    <option value="in_person">in_person</option><option value="virtual">virtual</option>
                  </select>
                </div>
                <div className="fitem"><label className="flabel">Companions</label><input value={visitEdit.companions} onChange={(e) => setVisitEdit({ ...visitEdit, companions: e.target.value })} /></div>
                <div className="fitem" style={{ gridColumn: '1 / -1' }}><label className="flabel">Notes</label><input value={visitEdit.notes} onChange={(e) => setVisitEdit({ ...visitEdit, notes: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
                <button className="btn gold" onClick={saveVisitEdit} disabled={visitSaving}>{visitSaving ? 'Saving…' : 'Save changes'}</button>
                <button className="btn ghost" onClick={closeVisitEdit}>Cancel</button>
              </div>
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="card"><div className="metric">{stats.total}</div><div className="label">total</div></div>
            <div className="card"><div className="metric">{stats.shown}</div><div className="label">shown</div></div>
            <div className="card"><div className="metric" style={{ color: stats.noDg ? 'var(--r)' : undefined }}>{stats.noDg}</div><div className="label">missing DG</div></div>
          </div>

          <div className="crm-toolbar">
            <input placeholder="Encounter ID, Work ID, catalogue ref, title…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
            {Object.entries(activeFilters).map(([key, val]) => {
              const def = FILTER_DEFS.find((d) => d.key === key)!;
              return (
                <span key={key} className="filter-chip">
                  {def.label}: <b>{def.optionLabel ? def.optionLabel(val) : val}</b>
                  <button onClick={() => setActiveFilters((prev) => { const n = { ...prev }; delete n[key]; return n; })}>✕</button>
                </span>
              );
            })}
            <select value={pendingFilterKey} onChange={(e) => setPendingFilterKey(e.target.value)}>
              <option value="">+ Add filter</option>
              {FILTER_DEFS.filter((d) => !usedFilterKeys.has(d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            {pendingFilterKey && (() => {
              const def = FILTER_DEFS.find((d) => d.key === pendingFilterKey)!;
              return (
                <select value="" onChange={(e) => {
                  const val = e.target.value;
                  if (val) { setActiveFilters((prev) => ({ ...prev, [pendingFilterKey]: val })); setPendingFilterKey(''); }
                }}>
                  <option value="">— pick {def.label.toLowerCase()} —</option>
                  {def.options().map((v) => <option key={v} value={v}>{def.optionLabel ? def.optionLabel(v) : v}</option>)}
                </select>
              );
            })()}
            {(search || Object.keys(activeFilters).length > 0) && (
              <button className="clear-filters" onClick={() => { setSearch(''); setActiveFilters({}); }}>Clear filters</button>
            )}
          </div>

          {edit && (
            <div className="card" style={{ border: '2px solid var(--g)', marginBottom: 14 }}>
              <div className="detail-head">
                <h2 style={{ fontSize: 16 }}>Edit · {edit.encounter_id}</h2>
                <button className="btn ghost btn-sm" onClick={closeEdit}>✕ Close</button>
              </div>

              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Identity</div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">encounter_id</label><input value={edit.encounter_id} disabled /></div>
                <div className="fitem"><label className="flabel">user_id</label><input value={edit.user_id} disabled /></div>
              </div>

              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Work</div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">encounter_work_id</label><input value={edit.encounter_work_id} onChange={(e) => setEdit({ ...edit, encounter_work_id: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">Catalogue reference</label><input value={rows.find((r) => r.encounter_id === edit.encounter_id)?.catalogue_reference || '—'} disabled /></div>
              </div>

              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Context</div>
              <div className="fgrid">
                <div className="fitem"><label className="flabel">encounter_visit_id</label><input value={edit.encounter_visit_id} onChange={(e) => setEdit({ ...edit, encounter_visit_id: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">encounter_display_group_id</label><input value={edit.encounter_display_group_id} onChange={(e) => setEdit({ ...edit, encounter_display_group_id: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">encounter_learning_path_id</label><input value={edit.encounter_learning_path_id} onChange={(e) => setEdit({ ...edit, encounter_learning_path_id: e.target.value })} /></div>
              </div>

              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Details</div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">confirmation_method</label>
                  <select value={edit.confirmation_method} onChange={(e) => setEdit({ ...edit, confirmation_method: e.target.value })}>
                    <option value="">— not set —</option>
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">encounter_timestamp</label><input type="date" value={edit.encounter_timestamp} onChange={(e) => setEdit({ ...edit, encounter_timestamp: e.target.value })} /></div>
              </div>
              <div className="fgroup"><label className="flabel">notes</label><textarea rows={4} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} style={{ width: '100%' }} /></div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
                <button className="btn gold" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                <button className="btn ghost" onClick={closeEdit}>Cancel</button>
                <button className="btn btn-sm btn-danger-outline" style={{ marginLeft: 'auto' }} onClick={deleteEncounter}>Delete encounter</button>
              </div>
            </div>
          )}

          {rowsLoading ? (
            <div className="card small">Loading encounters…</div>
          ) : (
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => sortBy('encounter_id')}>Encounter ID ↕</th>
                    <th onClick={() => sortBy('encounter_work_id')}>Work ID ↕</th>
                    <th>Catalogue Ref</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Attribution</th>
                    <th onClick={() => sortBy('encounter_display_group_id')}>Display Group ↕</th>
                    <th onClick={() => sortBy('encounter_learning_path_id')}>LP ↕</th>
                    <th onClick={() => sortBy('confirmation_method')}>Method ↕</th>
                    <th onClick={() => sortBy('encounter_timestamp')}>Date ↕</th>
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isDGLevel = !r.encounter_work_id;
                    const ts = r.encounter_timestamp ? r.encounter_timestamp.split('T')[0] : '—';
                    const noDG = !r.encounter_display_group_id;
                    return (
                      <tr key={r.encounter_id} style={noDG ? { background: '#FFF8F0' } : undefined}>
                        <td className="small">{r.encounter_id}</td>
                        <td className="small">{r.encounter_work_id || <span style={{ color: 'var(--m)', fontStyle: 'italic' }}>room-level</span>}</td>
                        <td className="small" style={{ color: 'var(--m)' }}>{r.catalogue_reference || '—'}</td>
                        <td title={r.work_title || ''} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isDGLevel ? <span style={{ color: 'var(--m)', fontStyle: 'italic' }}>(no single work)</span> : (r.work_title || <span style={{ color: 'var(--r)', fontWeight: 600 }}>⚠ title not found</span>)}
                        </td>
                        <td className="small">{isDGLevel ? '—' : (r.work_type || '—')}</td>
                        <td className="small">{isDGLevel ? '—' : (r.work_attribution || '—')}</td>
                        <td>{r.encounter_display_group_id ? <span className="tag-chip-sm role-director">{r.encounter_display_group_id}</span> : <span style={{ color: 'var(--r)', fontSize: 10, fontWeight: 600 }}>⚠ none</span>}</td>
                        <td>{r.encounter_learning_path_id ? <span className="tag-chip-sm role-curator">{r.encounter_learning_path_id}</span> : '—'}</td>
                        <td className="small">{r.confirmation_method || '—'}</td>
                        <td className="small">{ts}</td>
                        <td><button className="btn ghost btn-sm" onClick={() => openEdit(r.encounter_id)}>✎</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
