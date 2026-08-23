import { useEffect, useMemo, useState } from 'react';
import { callMrqApi, MrqApiError } from '@/lib/mrqApi';

// Ported from the standalone mrq_knowledge_admin_v24.html tool (Google Drive,
// MRQ project folder). That tool called a generic select/insert/update action
// on the old, pre-rewrite mrq-api -- the no-auth-check passthrough this whole
// backend rewrite exists to close. This port calls the new, narrow, authenticated
// endpoints in crud.ts instead (getKnowledgeAssets / saveKnowledgeAsset /
// addKnowledgeAssetScope / removeKnowledgeAssetScope / lookupWorkAssets).
//
// Bugs fixed while porting (both confirmed, not guessed):
// 1. The legacy edit panel's "x" on a scope chip only removed it from local UI
//    state for an already-saved asset -- it never called a delete, so the
//    removal silently didn't persist. Here it calls removeKnowledgeAssetScope
//    immediately, same as adding a scope already did.
// 2. Themes: knowledge_asset has a `themes` array column AND knowledge_asset_scope
//    supports scope_type='tag' rows -- two competing storage mechanisms left over
//    from an earlier redesign. Checked every line in guidance.ts that reads themes
//    (the real generation pipeline) -- all of them read `knowledge_asset.themes`,
//    none read scope_type='tag' rows. Confirmed via direct query that zero
//    scope_type='tag' rows even exist in production. So this tool only ever
//    reads/writes the `themes` column -- the legacy tool's tag-via-scope-row UI
//    is dropped entirely, not ported, since it wrote to something nothing reads.
const THEMES = ['provenance', 'patronage', 'craft', 'process', 'legacy', 'attribution', 'iconography', 'encounter', 'secrets', 'curatorial'];

type KAsset = {
  asset_id: string;
  title: string | null;
  source_name: string | null;
  language: string | null;
  content_text: string | null;
  content_short: string | null;
  created_date: string | null;
  last_updated: string | null;
  notes_internal: string | null;
  active: boolean | null;
  ingestion_method: string | null;
  ingestion_quality: string | null;
  contributor_id: string | null;
  themes: string[] | null;
  asset_type: string | null;
  visibility: string | null;
  source_encounter_id: string | null;
};
type KScope = { asset_id: string; scope_type: string; scope_id: string | null; scope_confidence: string | null };
type EncInfo = { date: string | null; venueName: string | null; workId: string | null; dgId: string | null; method: string | null; visitId: string | null };

type Row = KAsset & { scopes: KScope[] };

const SOURCE_CLASS: Record<string, string> = { Expert: 'role-digital', Museum: 'role-curator', Exhibition: 'role-access', MRQ: 'role-director', Encounter: 'role-general' };
const SCOPE_CLASS: Record<string, string> = { work: 'role-curator', display_group: 'role-director', venue: 'role-gatekeeper', general: 'role-general' };
function badgeClass(map: Record<string, string>, v: string | null | undefined) { return map[v || ''] || 'role-general'; }

type EditState = {
  isNew: boolean;
  asset_id: string;
  title: string; source_name: string; asset_type: string; language: string;
  ingestion_method: string; ingestion_quality: string; active: string;
  created_date: string; last_updated: string; contributor_id: string;
  content_short: string; content_text: string; notes_internal: string;
  source_encounter_id: string;
  scopes: KScope[]; themes: string[];
};

function emptyEdit(isNew: boolean): EditState {
  return {
    isNew, asset_id: '', title: '', source_name: 'Expert', asset_type: '', language: 'en',
    ingestion_method: 'manual', ingestion_quality: '', active: 'true',
    created_date: '', last_updated: '', contributor_id: '',
    content_short: '', content_text: '', notes_internal: '',
    source_encounter_id: '', scopes: [], themes: [],
  };
}

const FILTER_DEFS: {
  key: string; label: string;
  match: (r: Row, v: string) => boolean;
  options: (rows: Row[]) => string[];
  optionLabel?: (v: string) => string;
}[] = [
  { key: 'scopeType', label: 'Scope type', match: (r, v) => v === 'none' ? !r.scopes.length : r.scopes.some((s) => s.scope_type === v), options: () => ['work', 'display_group', 'venue', 'general', 'none'] },
  { key: 'assetType', label: 'Asset type', match: (r, v) => r.asset_type === v, options: (rows) => [...new Set(rows.map((r) => r.asset_type).filter(Boolean) as string[])].sort() },
  { key: 'source', label: 'Source', match: (r, v) => r.source_name === v, options: () => ['Exhibition', 'Expert', 'MRQ', 'Museum', 'Encounter'] },
  { key: 'theme', label: 'Theme', match: (r, v) => v === '__none__' ? !(r.themes || []).length : (r.themes || []).includes(v), options: () => [...THEMES, '__none__'], optionLabel: (v) => v === '__none__' ? '⚠ no theme' : v },
  { key: 'status', label: 'Status', match: (r, v) => v === 'true' ? r.active !== false : r.active === false, options: () => ['true', 'false'], optionLabel: (v) => v === 'true' ? 'Active' : '⚠ Inactive' },
  { key: 'encounterSourced', label: 'Encounter-sourced', match: (r, v) => v === 'yes' ? !!r.source_encounter_id : !r.source_encounter_id, options: () => ['yes', 'no'], optionLabel: (v) => v === 'yes' ? 'Has source encounter' : 'No source encounter' },
];

export function KnowledgeAssetAdmin() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [encounterMap, setEncounterMap] = useState<Record<string, EncInfo>>({});
  const [search, setSearch] = useState('');
  const [pendingFilterKey, setPendingFilterKey] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState('asset_id');
  const [sortDir, setSortDir] = useState(1);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const [rafInput, setRafInput] = useState('');
  const [rafResult, setRafResult] = useState<any | null>(null);
  const [rafLoading, setRafLoading] = useState(false);

  const [bulkAddType, setBulkAddType] = useState('display_group');
  const [bulkAddId, setBulkAddId] = useState('');
  const [bulkDelType, setBulkDelType] = useState('work');
  const [bulkDelId, setBulkDelId] = useState('');
  const [bulkTag, setBulkTag] = useState(THEMES[0]);
  const [bulkTagging, setBulkTagging] = useState(false);

  function say(type: 'ok' | 'err' | 'info', text: string) {
    setMsg({ type, text });
    if (type === 'ok') setTimeout(() => setMsg(null), 3500);
  }

  async function load() {
    setLoading(true);
    say('info', 'Loading assets…');
    try {
      const res = await callMrqApi('getKnowledgeAssets');
      const { assets, scopes, encounters, visits, venues } = res.data;
      const visitMap: Record<string, any> = {}; for (const v of visits) visitMap[v.visit_id] = v;
      const venueMap: Record<string, string> = {}; for (const v of venues) venueMap[v.venue_id] = v.venue_name;
      const em: Record<string, EncInfo> = {};
      for (const e of encounters) {
        const visit = visitMap[e.encounter_visit_id];
        em[e.encounter_id] = {
          date: e.encounter_timestamp ? String(e.encounter_timestamp).split('T')[0] : (visit?.visit_date || null),
          venueName: visit ? (venueMap[visit.venue_id] || visit.venue_id) : null,
          workId: e.encounter_work_id || null, dgId: e.encounter_display_group_id || null,
          method: e.confirmation_method || null, visitId: e.encounter_visit_id || null,
        };
      }
      setEncounterMap(em);
      const scopeMap: Record<string, KScope[]> = {};
      // scope_type='tag' rows are dropped on load -- confirmed dead (see file header).
      for (const s of scopes) if (s.scope_type !== 'tag') (scopeMap[s.asset_id] ||= []).push(s);
      setRows(assets.map((a: KAsset) => ({ ...a, scopes: scopeMap[a.asset_id] || [] })));
      say('ok', `Loaded ${assets.length} assets`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let out = rows.filter((r) => {
      if (q && !r.asset_id.toLowerCase().includes(q) && !(r.title || '').toLowerCase().includes(q)) return false;
      for (const key in activeFilters) {
        const def = FILTER_DEFS.find((d) => d.key === key);
        if (def && !def.match(r, activeFilters[key])) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sortCol === '__encDate') {
        const va = (a.source_encounter_id && encounterMap[a.source_encounter_id]?.date) || '';
        const vb = (b.source_encounter_id && encounterMap[b.source_encounter_id]?.date) || '';
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      }
      const va = String((a as any)[sortCol] ?? '').toLowerCase();
      const vb = String((b as any)[sortCol] ?? '').toLowerCase();
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
    return out;
  }, [rows, search, activeFilters, sortCol, sortDir, encounterMap]);

  const stats = useMemo(() => {
    const src = filtered.length ? filtered : rows;
    return {
      total: src.length,
      work: src.filter((r) => r.scopes.some((s) => s.scope_type === 'work')).length,
      noscope: src.filter((r) => !r.scopes.length).length,
      inactive: src.filter((r) => r.active === false).length,
      notag: src.filter((r) => !(r.themes || []).length).length,
    };
  }, [filtered, rows]);

  function sortBy(c: string) { if (sortCol === c) setSortDir((d) => -d); else { setSortCol(c); setSortDir(1); } }
  function toggleRow(id: string, on: boolean) { setSelected((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; }); }
  function toggleAll(on: boolean) { setSelected(on ? new Set(filtered.map((r) => r.asset_id)) : new Set()); }

  function openEdit(assetId: string) {
    const r = rows.find((x) => x.asset_id === assetId); if (!r) return;
    setEdit({
      isNew: false, asset_id: assetId, title: r.title || '', source_name: r.source_name || 'Expert',
      asset_type: r.asset_type || '', language: r.language || 'en', ingestion_method: r.ingestion_method || 'manual',
      ingestion_quality: r.ingestion_quality || '', active: r.active === false ? 'false' : 'true',
      created_date: r.created_date || '', last_updated: r.last_updated || '', contributor_id: r.contributor_id || '',
      content_short: r.content_short || '', content_text: r.content_text || '', notes_internal: r.notes_internal || '',
      source_encounter_id: r.source_encounter_id || '',
      scopes: JSON.parse(JSON.stringify(r.scopes)), themes: [...(r.themes || [])],
    });
  }
  function openNew() { setEdit(emptyEdit(true)); }
  function closeEdit() { setEdit(null); }

  async function removeScope(scopeType: string, scopeId: string) {
    if (!edit) return;
    if (!edit.isNew) {
      try {
        await callMrqApi('removeKnowledgeAssetScope', { asset_id: edit.asset_id, scope_type: scopeType, scope_id: scopeId || undefined });
        setRows((prev) => prev.map((r) => r.asset_id === edit.asset_id ? { ...r, scopes: r.scopes.filter((s) => !(s.scope_type === scopeType && (s.scope_id || '') === scopeId)) } : r));
      } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); return; }
    }
    setEdit((prev) => prev && ({ ...prev, scopes: prev.scopes.filter((s) => !(s.scope_type === scopeType && (s.scope_id || '') === scopeId)) }));
  }

  async function addScope(scopeType: string, scopeId: string, confidence: string) {
    if (!edit) return;
    if (scopeType !== 'general' && !scopeId) { say('err', 'Scope ID required'); return; }
    if (edit.scopes.some((s) => s.scope_type === scopeType && (s.scope_id || '') === (scopeId || ''))) { say('err', 'Scope already exists'); return; }
    const row: KScope = { asset_id: edit.asset_id, scope_type: scopeType, scope_id: scopeId || null, scope_confidence: confidence };
    if (!edit.isNew) {
      try {
        await callMrqApi('addKnowledgeAssetScope', { rows: [row] });
        setRows((prev) => prev.map((r) => r.asset_id === edit.asset_id ? { ...r, scopes: [...r.scopes, row] } : r));
      } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); return; }
    }
    setEdit((prev) => prev && ({ ...prev, scopes: [...prev.scopes, row] }));
    say('ok', `Added ${scopeType}:${scopeId}`);
  }

  // Themes live on the asset row itself now -- local edit only, persisted with
  // the rest of the fields on Save (no separate insert/delete call needed).
  function removeTheme(tag: string) { setEdit((prev) => prev && ({ ...prev, themes: prev.themes.filter((t) => t !== tag) })); }
  function addTheme(tag: string) {
    if (!edit) return;
    if (!tag) { say('err', 'Select or type a tag'); return; }
    if (edit.themes.includes(tag)) { say('err', 'Tag already exists'); return; }
    setEdit((prev) => prev && ({ ...prev, themes: [...prev.themes, tag] }));
  }

  async function save() {
    if (!edit) return;
    if (edit.source_encounter_id && !encounterMap[edit.source_encounter_id]) {
      if (!confirm(`"${edit.source_encounter_id}" doesn't match any encounter record. Save anyway?`)) return;
    }
    setSaving(true);
    const payload = {
      title: edit.title || null, source_name: edit.source_name || null, asset_type: edit.asset_type || null,
      language: edit.language || null, ingestion_method: edit.ingestion_method || null,
      ingestion_quality: edit.ingestion_quality || null, active: edit.active !== 'false',
      created_date: edit.created_date || null, content_text: edit.content_text || null,
      notes_internal: edit.notes_internal || null, source_encounter_id: edit.source_encounter_id || null,
      themes: edit.themes,
    };
    try {
      if (edit.isNew) {
        if (!edit.asset_id.trim()) { say('err', 'asset_id required'); setSaving(false); return; }
        await callMrqApi('saveKnowledgeAsset', { asset_id: edit.asset_id.trim(), is_new: true, ...payload });
        if (edit.scopes.length) await callMrqApi('addKnowledgeAssetScope', { rows: edit.scopes.map((s) => ({ ...s, asset_id: edit.asset_id.trim() })) });
        say('ok', `Created ${edit.asset_id}`);
      } else {
        await callMrqApi('saveKnowledgeAsset', { asset_id: edit.asset_id, is_new: false, ...payload });
        say('ok', `${edit.asset_id} saved`);
      }
      closeEdit();
      await load();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function bulkAddScope() {
    if (!selected.size) { say('err', 'No assets selected'); return; }
    if (bulkAddType !== 'general' && !bulkAddId.trim()) { say('err', 'Scope ID required'); return; }
    const rowsToAdd = [...selected].map((id) => ({ asset_id: id, scope_type: bulkAddType, scope_id: bulkAddId.trim() || null, scope_confidence: 'confirmed' }));
    try {
      await callMrqApi('addKnowledgeAssetScope', { rows: rowsToAdd });
      say('ok', `Added ${rowsToAdd.length} scopes`);
      await load();
    } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); }
  }

  async function bulkRemoveScope() {
    if (!selected.size) { say('err', 'No assets selected'); return; }
    if (!confirm(`Remove ${bulkDelId.trim() ? bulkDelType + ':' + bulkDelId.trim() : 'all ' + bulkDelType + ' scopes'} from ${selected.size} assets?`)) return;
    try {
      await Promise.all([...selected].map((id) => callMrqApi('removeKnowledgeAssetScope', { asset_id: id, scope_type: bulkDelType, scope_id: bulkDelId.trim() || undefined })));
      say('ok', `Removed scopes from ${selected.size} assets`);
      await load();
    } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); }
  }

  // Themes are a column, not a joinable row -- bulk-tag is read-modify-write
  // per selected asset (union the new tag into whatever themes it already has).
  async function bulkAddTag() {
    if (!selected.size) { say('err', 'No assets selected'); return; }
    setBulkTagging(true);
    try {
      const targets = rows.filter((r) => selected.has(r.asset_id));
      await Promise.all(targets.map((r) => {
        const nextThemes = [...new Set([...(r.themes || []), bulkTag])];
        return callMrqApi('saveKnowledgeAsset', { asset_id: r.asset_id, is_new: false, themes: nextThemes });
      }));
      say('ok', `Tagged ${targets.length} assets: ${bulkTag}`);
      await load();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setBulkTagging(false);
    }
  }

  async function lookupRAF() {
    const workId = rafInput.trim().toUpperCase();
    if (!workId) { say('err', 'Enter a RAF code'); return; }
    setRafLoading(true); setRafResult(null);
    try {
      const res = await callMrqApi('lookupWorkAssets', { work_id: workId });
      setRafResult(res.data);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setRafLoading(false);
    }
  }

  const usedFilterKeys = new Set(Object.keys(activeFilters));

  return (
    <div>
      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, background: msg.type === 'ok' ? '#ddeee3' : msg.type === 'err' ? '#f5dad7' : '#dceafb', color: msg.type === 'ok' ? '#2d6a4f' : msg.type === 'err' ? '#8b2e23' : '#0c4a8c', fontSize: 13 }}>{msg.text}</div>}

      <div className="toolbar">
        <h2>Knowledge Asset Admin</h2>
        <button className="btn gold" onClick={openNew}>+ New asset</button>
        <button className="btn ghost" onClick={load}>↺ Reload</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 14 }}>
        <div className="card"><div className="metric">{stats.total}</div><div className="label">shown</div></div>
        <div className="card"><div className="metric">{stats.work}</div><div className="label">work-scoped</div></div>
        <div className="card"><div className="metric" style={{ color: 'var(--r)' }}>{stats.noscope}</div><div className="label">⚠ no scope</div></div>
        <div className="card"><div className="metric" style={{ color: 'var(--r)' }}>{stats.inactive}</div><div className="label">⚠ inactive</div></div>
        <div className="card"><div className="metric">{stats.notag}</div><div className="label">no theme tag</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 8 }}>RAF lookup — what would this work get?</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="RAF code e.g. RAF-007" value={rafInput} onChange={(e) => setRafInput(e.target.value)} style={{ width: 200 }} />
          <button className="btn" onClick={lookupRAF} disabled={rafLoading}>{rafLoading ? 'Looking up…' : 'Look up →'}</button>
          <button className="btn ghost" onClick={() => { setRafInput(''); setRafResult(null); }}>Clear</button>
        </div>
        {rafResult && (
          <div style={{ marginTop: 12 }}>
            <div className="small" style={{ marginBottom: 8 }}>{rafResult.assets.length} assets · DG: {rafResult.dg || 'none'} · Venue: {rafResult.venue || 'none'} · Work tags: {(rafResult.tags || []).join(', ') || 'none'}</div>
            {!rafResult.assets.length ? (
              <div className="small">No assets found for this work.</div>
            ) : (
              <div className="wrap" style={{ maxHeight: 'none' }}>
                <table>
                  <thead><tr><th>Priority</th><th>Asset ID</th><th>Title</th><th>Source</th><th>Theme tags</th><th>Lang</th></tr></thead>
                  <tbody>
                    {rafResult.assets.map((a: any) => (
                      <tr key={a.asset_id} style={a.active === false ? { opacity: 0.5 } : undefined}>
                        <td style={{ fontWeight: 700 }}>{a.priority} · {a.basis}</td>
                        <td className="small">{a.asset_id}</td>
                        <td>{a.title || '—'}</td>
                        <td><span className={`tag-chip-sm ${badgeClass(SOURCE_CLASS, a.source_name)}`}>{a.source_name || '—'}</span></td>
                        <td>{(a.theme_tags || []).map((t: string) => <span key={t} className="tag-chip">{t}</span>)}</td>
                        <td>{a.language || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="crm-toolbar">
        <input id="search" placeholder="Search asset_id or title…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
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
              {def.options(rows).map((v) => <option key={v} value={v}>{def.optionLabel ? def.optionLabel(v) : v}</option>)}
            </select>
          );
        })()}
        {(search || Object.keys(activeFilters).length > 0) && (
          <button className="clear-filters" onClick={() => { setSearch(''); setActiveFilters({}); }}>Clear filters</button>
        )}
        <button className="btn ghost btn-sm" onClick={() => toggleAll(true)}>Select all visible</button>
        <button className="btn ghost btn-sm" onClick={() => toggleAll(false)}>Clear selection</button>
        <span className="small">{selected.size} selected</span>
      </div>

      {edit && (
        <div className="card" style={{ border: '2px solid var(--g)', marginBottom: 14 }}>
          <div className="detail-head">
            <h2 style={{ fontSize: 16 }}>{edit.isNew ? 'New asset' : `Edit · ${edit.asset_id}`}</h2>
            <button className="btn ghost btn-sm" onClick={closeEdit}>✕ Close</button>
          </div>

          <div className="fgroup">
            <label className="flabel">source_encounter_id</label>
            <input value={edit.source_encounter_id} onChange={(e) => setEdit({ ...edit, source_encounter_id: e.target.value })} placeholder="e.g. ENC-USR002-20260324-120005" style={{ width: '100%', marginTop: 4 }} />
            <div className="small" style={{ marginTop: 6 }}>
              {!edit.source_encounter_id ? 'No source encounter — this asset isn\'t tied to a specific visit' :
                encounterMap[edit.source_encounter_id] ? (() => {
                  const enc = encounterMap[edit.source_encounter_id];
                  return `Matches: ${enc.date || '?'} at ${enc.venueName || '?'} (visit ${enc.visitId || '?'})${enc.workId ? ' · work ' + enc.workId : (enc.dgId ? ' · room ' + enc.dgId : '')}${enc.method ? ' · ' + enc.method : ''}`;
                })() : <span style={{ color: 'var(--r)' }}>⚠ {edit.source_encounter_id} does not match any encounter record — check the ID before saving</span>}
            </div>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Identity</div>
          <div className="fgrid">
            <div className="fitem"><label className="flabel">asset_id</label><input value={edit.asset_id} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, asset_id: e.target.value })} placeholder="e.g. KA-NEW-001" /></div>
            <div className="fitem"><label className="flabel">title</label><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">source_name</label>
              <select value={edit.source_name} onChange={(e) => setEdit({ ...edit, source_name: e.target.value })}>
                {['Exhibition', 'Expert', 'MRQ', 'Museum', 'Encounter'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">asset_type</label>
              <select value={edit.asset_type} onChange={(e) => setEdit({ ...edit, asset_type: e.target.value })}>
                <option value="">— unset —</option>
                {['work_label', 'wall_label', 'audio_guide', 'catalogue_entry', 'expert_commentary', 'museum_website', 'mrq_synthesis', 'encounter_note', 'other'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">language</label>
              <select value={edit.language} onChange={(e) => setEdit({ ...edit, language: e.target.value })}>
                {['en', '', 'it', 'de', 'fr'].map((s) => <option key={s} value={s}>{s || '— null —'}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">ingestion_method</label>
              <select value={edit.ingestion_method} onChange={(e) => setEdit({ ...edit, ingestion_method: e.target.value })}>
                <option value="manual">manual</option><option value="automatic">automatic</option>
              </select>
            </div>
            <div className="fitem"><label className="flabel">ingestion_quality</label>
              <select value={edit.ingestion_quality} onChange={(e) => setEdit({ ...edit, ingestion_quality: e.target.value })}>
                <option value="">— not set —</option><option value="good">good</option><option value="poor">poor</option><option value="failed">failed</option>
              </select>
            </div>
            <div className="fitem"><label className="flabel">active</label>
              <select value={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.value })}>
                <option value="true">✓ active</option><option value="false">✗ inactive (suppressed)</option>
              </select>
            </div>
            <div className="fitem"><label className="flabel">created_date</label><input value={edit.created_date} onChange={(e) => setEdit({ ...edit, created_date: e.target.value })} placeholder="YYYY-MM-DD" /></div>
            <div className="fitem"><label className="flabel">contributor_id</label><input value={edit.contributor_id} onChange={(e) => setEdit({ ...edit, contributor_id: e.target.value })} /></div>
          </div>
          <div className="fgroup"><label className="flabel">content_short — brief summary (optional)</label><textarea rows={2} value={edit.content_short} onChange={(e) => setEdit({ ...edit, content_short: e.target.value })} style={{ width: '100%' }} /></div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Belongs to</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {!edit.scopes.length ? <span style={{ color: 'var(--r)', fontSize: 11, fontWeight: 600 }}>⚠ no retrieval scope</span> :
              edit.scopes.map((s) => (
                <span key={`${s.scope_type}:${s.scope_id}`} className={`tag-chip-sm ${badgeClass(SCOPE_CLASS, s.scope_type)}`}>
                  {s.scope_type}:{s.scope_id || ''} ({s.scope_confidence || 'confirmed'}) <span style={{ cursor: 'pointer' }} onClick={() => removeScope(s.scope_type, s.scope_id || '')}>×</span>
                </span>
              ))}
          </div>
          <AddScopeRow onAdd={addScope} />

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)', marginTop: 14 }}>Theme tags <span className="small" style={{ fontWeight: 400 }}>(drives which deep-dive angles this asset supports)</span></div>
          <div className="tag-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', border: '1px solid #ccc', borderRadius: 5, minHeight: 34, marginBottom: 6 }}>
            {!edit.themes.length ? <span className="small">no theme tags</span> :
              edit.themes.map((t) => <span key={t} className="tag-chip">{t} <span style={{ cursor: 'pointer' }} onClick={() => removeTheme(t)}>×</span></span>)}
          </div>
          <AddTagRow onAdd={addTheme} />

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)', marginTop: 14 }}>Content <span className="small">({edit.content_text.length.toLocaleString()} chars)</span></div>
          <textarea rows={8} value={edit.content_text} onChange={(e) => setEdit({ ...edit, content_text: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
          <div className="fgroup"><label className="flabel">notes_internal</label><input value={edit.notes_internal} onChange={(e) => setEdit({ ...edit, notes_internal: e.target.value })} style={{ width: '100%' }} /></div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
            <button className="btn gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button className="btn ghost" onClick={closeEdit}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <label className="flabel">Bulk: add scope</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select value={bulkAddType} onChange={(e) => setBulkAddType(e.target.value)}>{['display_group', 'general', 'venue', 'work'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <input placeholder="e.g. RAF-007" value={bulkAddId} onChange={(e) => setBulkAddId(e.target.value)} style={{ width: 140 }} />
            <button className="btn btn-sm btn-navy" onClick={bulkAddScope}>Add scope →</button>
          </div>
        </div>
        <div>
          <label className="flabel">Bulk: remove scope</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select value={bulkDelType} onChange={(e) => setBulkDelType(e.target.value)}>{['work', 'display_group', 'general'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <input placeholder="blank = all of this type" value={bulkDelId} onChange={(e) => setBulkDelId(e.target.value)} style={{ width: 160 }} />
            <button className="btn btn-sm btn-danger-outline" onClick={bulkRemoveScope}>Remove scope</button>
          </div>
        </div>
        <div>
          <label className="flabel">Bulk: add theme tag</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select value={bulkTag} onChange={(e) => setBulkTag(e.target.value)}>{THEMES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <button className="btn btn-sm btn-navy" onClick={bulkAddTag} disabled={bulkTagging}>{bulkTagging ? 'Tagging…' : 'Add tag →'}</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card small">Loading knowledge assets…</div>
      ) : (
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 24 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every((r) => selected.has(r.asset_id))} onChange={(e) => toggleAll(e.target.checked)} /></th>
                <th onClick={() => sortBy('asset_id')}>Asset ID ↕</th>
                <th onClick={() => sortBy('title')}>Title ↕</th>
                <th onClick={() => sortBy('source_name')}>Source ↕</th>
                <th onClick={() => sortBy('asset_type')}>Type ↕</th>
                <th onClick={() => sortBy('language')}>Lang ↕</th>
                <th>Chars</th>
                <th>Scopes</th>
                <th>Theme tags</th>
                <th onClick={() => sortBy('__encDate')}>Encounter ↕</th>
                <th onClick={() => sortBy('active')}>Status ↕</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sel = selected.has(r.asset_id);
                const inactive = r.active === false;
                const enc = r.source_encounter_id ? encounterMap[r.source_encounter_id] : null;
                return (
                  <tr key={r.asset_id} style={inactive ? { opacity: 0.5 } : undefined} className={sel ? 'clickable' : undefined}>
                    <td><input type="checkbox" checked={sel} onChange={(e) => toggleRow(r.asset_id, e.target.checked)} /></td>
                    <td className="small">{r.asset_id}</td>
                    <td title={r.title || ''} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || '—'}</td>
                    <td><span className={`tag-chip-sm ${badgeClass(SOURCE_CLASS, r.source_name)}`}>{r.source_name || '—'}</span></td>
                    <td className="small">{r.asset_type || <span style={{ color: 'var(--r)' }}>—</span>}</td>
                    <td className="small">{r.language || '—'}</td>
                    <td className="small">{(r.content_text || '').length.toLocaleString()}</td>
                    <td style={{ maxWidth: 160 }}>
                      {r.scopes.length ? r.scopes.map((s) => <span key={`${s.scope_type}:${s.scope_id}`} className={`tag-chip-sm ${badgeClass(SCOPE_CLASS, s.scope_type)}`}>{s.scope_type}:{s.scope_id || ''}</span>) : <span style={{ color: 'var(--r)', fontSize: 10, fontWeight: 600 }}>⚠ no scope</span>}
                    </td>
                    <td style={{ maxWidth: 160 }}>{(r.themes || []).length ? (r.themes || []).map((t) => <span key={t} className="tag-chip">{t}</span>) : <span className="small">—</span>}</td>
                    <td className="small" style={{ maxWidth: 150, whiteSpace: 'normal' }}>
                      {enc ? <><b>{enc.date || '?'}</b> · {enc.venueName || '?'}<br />{enc.workId || (enc.dgId ? 'Room: ' + enc.dgId : '—')}</>
                        : r.source_encounter_id ? <span style={{ color: 'var(--r)' }}>⚠ {r.source_encounter_id} not found</span> : '—'}
                    </td>
                    <td>{inactive && <span className="tag-chip-sm role-gatekeeper">inactive</span>}</td>
                    <td><button className="btn ghost btn-sm" onClick={() => openEdit(r.asset_id)}>✎</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddScopeRow({ onAdd }: { onAdd: (type: string, id: string, conf: string) => void }) {
  const [type, setType] = useState('display_group');
  const [id, setId] = useState('');
  const [conf, setConf] = useState('confirmed');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={type} onChange={(e) => setType(e.target.value)}>{['display_group', 'general', 'venue', 'work'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <input placeholder="scope_id e.g. RAF-007" value={id} onChange={(e) => setId(e.target.value)} style={{ width: 180 }} />
      <select value={conf} onChange={(e) => setConf(e.target.value)}>{['confirmed', 'probable', 'contextual'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <button className="btn btn-sm btn-navy" onClick={() => { onAdd(type, id.trim(), conf); setId(''); }}>+ Add scope</button>
    </div>
  );
}

function AddTagRow({ onAdd }: { onAdd: (tag: string) => void }) {
  const [sel, setSel] = useState('');
  const [custom, setCustom] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">— pick theme —</option>
        {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input placeholder="or type custom tag…" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ width: 180 }}
        onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(custom.trim() || sel); setCustom(''); setSel(''); } }} />
      <button className="btn btn-sm btn-navy" onClick={() => { onAdd(custom.trim() || sel); setCustom(''); setSel(''); }}>+ Add tag</button>
    </div>
  );
}
