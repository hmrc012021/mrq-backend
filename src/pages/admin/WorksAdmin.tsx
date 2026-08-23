import { useEffect, useMemo, useState } from 'react';
import { callMrqApi, MrqApiError } from '@/lib/mrqApi';

// Ported from the standalone mrq_works_admin_v32.html tool (Google Drive, MRQ
// project folder). That tool called the old no-auth-check generic select/insert/
// update passthrough; this port calls the new narrow, authenticated endpoints
// (getWorksAdminData / saveWork / getWorkRelationships / addWorkRelationship /
// deleteWorkRelationship / getWorkEncounterHistory).
//
// Dropped vs. legacy: the attribution-checkbox loader that fetched works in
// batches per attribution category. getWorksAdminData uses the shared fetchAll
// pagination helper to load the whole table in one call, so the checkbox UI
// (a workaround for the old per-request row cap) is obsolete.
type Work = {
  work_id: string; title: string | null; alternative_title: string | null; passavant_no: string | null;
  creator_name: string | null; work_kind: string | null; attribution_category: string | null;
  year_from: number | null; year_to: number | null; medium: string | null; medium_category: string | null;
  size_text: string | null; object_type: string | null; period: string | null; work_group: string | null;
  commissioner: string | null; description_short: string | null; canonical_venue_id: string | null;
  canonical_display_group_id: string | null; inventory_number: string | null; status: string | null;
  visit_count: string | null; first_seen_date: string | null; last_checked: string | null;
  relationship_summary: string | null; magnet: number | null; notes_internal: string | null;
  source: string | null; source_reference: string | null; program_cycle: string | null;
  quest_image_url: string | null; venue_image_url: string | null; external_image_url: string | null;
  artwork_url: string | null; tags: string[] | null;
};
type Venue = { venue_id: string; venue_name: string | null };
type DisplayGroup = { display_group_id: string; group_name: string | null };
type WorkRelationship = {
  relationship_id: string; relationship_type: string; from_work_id: string; to_work_id: string;
  sequence: number | null; role: string | null; notes: string | null; other_title: string | null;
};
type EncHistoryRow = {
  encounter_id: string; encounter_visit_id: string | null; encounter_learning_path_id: string | null;
  encounter_timestamp: string | null; confirmation_method: string | null; notes: string | null;
  venue_name: string | null; visit_date: string | null;
};

const REL_LABELS: Record<string, string> = {
  part_of_altarpiece: 'is part of',
  preparatory_drawing_for: 'is a preparatory drawing for',
  cartoon_for: 'is the cartoon for',
  copy_after: 'is a copy after',
  engraving_after: 'is an engraving after',
};

function relationshipSentence(type: string, isFrom: boolean, otherHtml: string) {
  const lbl = REL_LABELS[type] || type.replace(/_/g, ' ');
  return isFrom ? `This work ${lbl} ${otherHtml}` : `${otherHtml} ${lbl} this work`;
}

const ATTRIB_CLASS: Record<string, string> = {
  Raphael: 'role-director', 'After Raphael': 'role-gatekeeper', 'Attributed to': 'role-curator',
  'School of Raphael': 'role-digital', 'Circle of Perugino': 'role-digital', 'Leonardo da Vinci': 'role-access',
};
function attribClass(a: string | null | undefined) { return ATTRIB_CLASS[a || ''] || 'role-general'; }

function manualVisitCount(r: Work) {
  const m = String(r.visit_count || '').match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}
function dateStr(r: Work) {
  if (!r.year_from && !r.year_to) return '—';
  if (!r.year_to || r.year_from === r.year_to) return String(r.year_from ?? '');
  return `${r.year_from ?? '?'}–${r.year_to}`;
}

type EditState = {
  isNew: boolean;
  work_id: string;
  title: string; alternative_title: string; passavant_no: string; inventory_number: string;
  creator_name: string; attribution_category: string; object_type: string; medium_category: string; period: string;
  year_from: string; year_to: string; medium: string; size_text: string; commissioner: string; work_group: string;
  canonical_venue_id: string; canonical_display_group_id: string; status: string; magnet: string; work_kind: string;
  program_cycle: string; visit_count: string; first_seen_date: string; last_checked: string; relationship_summary: string;
  description_short: string; notes_internal: string; source: string; source_reference: string;
  artwork_url: string; venue_image_url: string; quest_image_url: string; external_image_url: string;
  tags: string[];
};

function emptyEditState(): EditState {
  return {
    isNew: true, work_id: '', title: '', alternative_title: '', passavant_no: '', inventory_number: '', creator_name: '',
    attribution_category: '', object_type: '', medium_category: '', period: '', year_from: '', year_to: '', medium: '',
    size_text: '', commissioner: '', work_group: '', canonical_venue_id: '', canonical_display_group_id: '', status: '',
    magnet: '0', work_kind: 'physical', program_cycle: '', visit_count: '', first_seen_date: '', last_checked: '',
    relationship_summary: '', description_short: '', notes_internal: '', source: '', source_reference: '',
    artwork_url: '', venue_image_url: '', quest_image_url: '', external_image_url: '', tags: [],
  };
}

function openEditState(r: Work): EditState {
  return {
    isNew: false, work_id: r.work_id, title: r.title || '', alternative_title: r.alternative_title || '',
    passavant_no: r.passavant_no || '', inventory_number: r.inventory_number || '', creator_name: r.creator_name || '',
    attribution_category: r.attribution_category || '', object_type: r.object_type || '', medium_category: r.medium_category || '',
    period: r.period || '', year_from: r.year_from == null ? '' : String(r.year_from), year_to: r.year_to == null ? '' : String(r.year_to),
    medium: r.medium || '', size_text: r.size_text || '', commissioner: r.commissioner || '', work_group: r.work_group || '',
    canonical_venue_id: r.canonical_venue_id || '', canonical_display_group_id: r.canonical_display_group_id || '',
    status: r.status || '', magnet: String(r.magnet ?? 0), work_kind: r.work_kind || 'physical',
    program_cycle: r.program_cycle || '', visit_count: r.visit_count || '', first_seen_date: r.first_seen_date || '',
    last_checked: r.last_checked || '', relationship_summary: r.relationship_summary || '',
    description_short: r.description_short || '', notes_internal: r.notes_internal || '', source: r.source || '',
    source_reference: r.source_reference || '', artwork_url: r.artwork_url || '', venue_image_url: r.venue_image_url || '',
    quest_image_url: r.quest_image_url || '', external_image_url: r.external_image_url || '', tags: [...(r.tags || [])],
  };
}

export function WorksAdmin() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [rows, setRows] = useState<Work[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [displayGroups, setDisplayGroups] = useState<DisplayGroup[]>([]);
  const [encounterCounts, setEncounterCounts] = useState<Record<string, number>>({});

  const [search, setSearch] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [pendingFilterKey, setPendingFilterKey] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortCol, setSortCol] = useState('work_id');
  const [sortDir, setSortDir] = useState(1);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [relationships, setRelationships] = useState<WorkRelationship[]>([]);
  const [encHistory, setEncHistory] = useState<EncHistoryRow[]>([]);
  const [newTag, setNewTag] = useState('');

  const [relType, setRelType] = useState('part_of_altarpiece');
  const [relDirection, setRelDirection] = useState<'from' | 'to'>('from');
  const [relOtherId, setRelOtherId] = useState('');
  const [relSequence, setRelSequence] = useState('');
  const [relRole, setRelRole] = useState('');
  const [relNotes, setRelNotes] = useState('');

  function say(type: 'ok' | 'err' | 'info', text: string) {
    setMsg({ type, text });
    if (type === 'ok') setTimeout(() => setMsg(null), 3500);
  }

  async function load() {
    setLoading(true);
    say('info', 'Loading works…');
    try {
      const res = await callMrqApi('getWorksAdminData');
      const { works, venues: v, displayGroups: dg, encounterCounts: ec } = res.data;
      setRows(works);
      setVenues(v);
      setDisplayGroups(dg);
      setEncounterCounts(ec);
      say('ok', `Loaded ${works.length} works`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const venueMap = useMemo(() => { const m: Record<string, string> = {}; for (const v of venues) m[v.venue_id] = v.venue_name || v.venue_id; return m; }, [venues]);
  const dgMap = useMemo(() => { const m: Record<string, string> = {}; for (const d of displayGroups) m[d.display_group_id] = d.group_name || d.display_group_id; return m; }, [displayGroups]);

  const FILTER_DEFS = useMemo(() => [
    { key: 'attribution', label: 'Attribution', match: (r: Work, v: string) => r.attribution_category === v, options: () => ['Raphael', 'After Raphael', 'School of Raphael', 'Attributed to', 'Other'] },
    { key: 'type', label: 'Type', match: (r: Work, v: string) => r.object_type === v, options: () => ['painting', 'drawing', 'tapestry', 'engraving', 'other'] },
    { key: 'status', label: 'Status', match: (r: Work, v: string) => r.status === v, options: () => ['LOST', 'MISSING', 'NOT ACCESIBLE', 'NOT IN DISPLAY'] },
    { key: 'kind', label: 'Kind', match: (r: Work, v: string) => (r.work_kind || 'physical') === v, options: () => ['physical', 'virtual'] },
    {
      key: 'urls', label: 'URLs',
      optionLabel: (v: string) => ({ no_artwork: 'No artwork URL', no_image: 'No venue image', no_quest: 'No quest photo', has_artwork: 'Has artwork URL' } as Record<string, string>)[v],
      match: (r: Work, v: string) => v === 'no_artwork' ? !r.artwork_url : v === 'no_image' ? !r.venue_image_url : v === 'no_quest' ? !r.quest_image_url : v === 'has_artwork' ? !!r.artwork_url : true,
      options: () => ['no_artwork', 'no_image', 'no_quest', 'has_artwork'],
    },
    { key: 'creator', label: 'Creator', match: (r: Work, v: string) => r.creator_name === v, options: () => [...new Set(rows.map((r) => r.creator_name).filter(Boolean) as string[])].sort() },
    { key: 'venue', label: 'Venue', optionLabel: (id: string) => venueMap[id] || id, match: (r: Work, v: string) => r.canonical_venue_id === v, options: () => [...new Set(rows.map((r) => r.canonical_venue_id).filter(Boolean) as string[])].sort((a, b) => (venueMap[a] || a).localeCompare(venueMap[b] || b)) },
    { key: 'displayGroup', label: 'Display group', optionLabel: (id: string) => dgMap[id] || id, match: (r: Work, v: string) => r.canonical_display_group_id === v, options: () => [...new Set(rows.map((r) => r.canonical_display_group_id).filter(Boolean) as string[])].sort((a, b) => (dgMap[a] || a).localeCompare(dgMap[b] || b)) },
    { key: 'period', label: 'Period', match: (r: Work, v: string) => r.period === v, options: () => [...new Set(rows.map((r) => r.period).filter(Boolean) as string[])].sort() },
    { key: 'magnet', label: 'Magnet', optionLabel: (v: string) => ({ '0': '0 — regular', '1': '1 — magnet', '2': '2 — high magnet', '3': '3 — anchor' } as Record<string, string>)[v], match: (r: Work, v: string) => String(r.magnet ?? 0) === v, options: () => ['0', '1', '2', '3'] },
    { key: 'mediumCategory', label: 'Medium', match: (r: Work, v: string) => r.medium_category === v, options: () => [...new Set(rows.map((r) => r.medium_category).filter(Boolean) as string[])].sort() },
    { key: 'encountered', label: 'Encountered (manual field)', match: (r: Work, v: string) => { const seen = String(r.visit_count || '').trim().startsWith('Seen'); return v === 'seen' ? seen : !seen; }, optionLabel: (v: string) => v === 'seen' ? 'Seen' : 'Not seen', options: () => ['seen', 'not_seen'] },
    { key: 'realEncountered', label: 'Encountered (real)', match: (r: Work, v: string) => { const seen = (encounterCounts[r.work_id] || 0) > 0; return v === 'seen' ? seen : !seen; }, optionLabel: (v: string) => v === 'seen' ? 'Has encounter records' : 'No encounter records', options: () => ['seen', 'not_seen'] },
    {
      key: 'countMismatch', label: 'Manual vs real',
      match: (r: Work, v: string) => { const manual = manualVisitCount(r), real = encounterCounts[r.work_id] || 0; if (v === 'mismatch') return manual !== real; if (v === 'manual_higher') return manual > real; if (v === 'real_higher') return real > manual; return manual === real; },
      optionLabel: (v: string) => ({ mismatch: 'Any mismatch', manual_higher: 'Manual field overcounts', real_higher: 'Manual field undercounts', match: 'Matches' } as Record<string, string>)[v],
      options: () => ['mismatch', 'manual_higher', 'real_higher', 'match'],
    },
    { key: 'tag', label: 'Tag', match: (r: Work, v: string) => (r.tags || []).includes(v), options: () => [...new Set(rows.flatMap((r) => r.tags || []))].sort() },
  ], [rows, venueMap, dgMap, encounterCounts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let out = rows.filter((r) => {
      if (q) {
        const hay = [
          r.work_id, r.title, r.alternative_title, r.inventory_number, r.passavant_no, r.creator_name, r.medium,
          r.work_group, r.commissioner, r.description_short, r.notes_internal, r.source, r.source_reference,
          r.relationship_summary, r.program_cycle, r.period, r.size_text, r.canonical_venue_id, venueMap[r.canonical_venue_id || ''],
          r.canonical_display_group_id, dgMap[r.canonical_display_group_id || ''], (r.tags || []).join(' '),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const key in activeFilters) {
        const def = FILTER_DEFS.find((d) => d.key === key);
        if (def && !def.match(r, activeFilters[key])) return false;
      }
      if (yearFrom && (r.year_to ?? r.year_from ?? -Infinity) < parseInt(yearFrom)) return false;
      if (yearTo && (r.year_from ?? r.year_to ?? Infinity) > parseInt(yearTo)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sortCol === '__encCount') {
        const va = encounterCounts[a.work_id] || 0, vb = encounterCounts[b.work_id] || 0;
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      }
      const va = String((a as any)[sortCol] ?? '').toLowerCase();
      const vb = String((b as any)[sortCol] ?? '').toLowerCase();
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
    return out;
  }, [rows, search, activeFilters, yearFrom, yearTo, sortCol, sortDir, encounterCounts, venueMap, dgMap, FILTER_DEFS]);

  const stats = useMemo(() => ({
    total: rows.length,
    raphael: rows.filter((r) => r.attribution_category === 'Raphael').length,
    dg: rows.filter((r) => r.canonical_display_group_id).length,
    artwork: rows.filter((r) => r.artwork_url).length,
    venueImg: rows.filter((r) => r.venue_image_url).length,
    quest: rows.filter((r) => r.quest_image_url).length,
    realEncountered: rows.filter((r) => (encounterCounts[r.work_id] || 0) > 0).length,
    mismatch: rows.filter((r) => manualVisitCount(r) !== (encounterCounts[r.work_id] || 0)).length,
  }), [rows, encounterCounts]);

  function sortBy(c: string) { if (sortCol === c) setSortDir((d) => -d); else { setSortCol(c); setSortDir(1); } }

  async function openEdit(workId: string) {
    const r = rows.find((x) => x.work_id === workId); if (!r) return;
    setEdit(openEditState(r));
    setRelationships([]);
    setEncHistory([]);
    loadRelationships(workId);
    loadEncHistory(workId);
  }
  function openNew() {
    setEdit(emptyEditState());
    setRelationships([]);
    setEncHistory([]);
  }
  function closeEdit() { setEdit(null); }

  async function loadRelationships(workId: string) {
    try {
      const res = await callMrqApi('getWorkRelationships', { work_id: workId });
      setRelationships(res.data || []);
    } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); }
  }
  async function loadEncHistory(workId: string) {
    try {
      const res = await callMrqApi('getWorkEncounterHistory', { work_id: workId });
      setEncHistory(res.data || []);
    } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); }
  }

  async function addRelationship() {
    if (!edit) return;
    if (!relOtherId.trim()) { say('err', 'Enter the other work_id first'); return; }
    const payload = {
      relationship_type: relType,
      from_work_id: relDirection === 'from' ? edit.work_id : relOtherId.trim(),
      to_work_id: relDirection === 'from' ? relOtherId.trim() : edit.work_id,
      sequence: relSequence.trim() === '' ? null : parseInt(relSequence.trim()),
      role: relRole.trim() || null,
      notes: relNotes.trim() || null,
    };
    try {
      const res = await callMrqApi('addWorkRelationship', payload);
      say('ok', `✓ Relationship added (${res.data.relationship_id})`);
      setRelOtherId(''); setRelSequence(''); setRelRole(''); setRelNotes('');
      await loadRelationships(edit.work_id);
    } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); }
  }

  async function deleteRelationship(relId: string) {
    if (!edit) return;
    if (!confirm('Delete this relationship? This cannot be undone.')) return;
    try {
      await callMrqApi('deleteWorkRelationship', { relationship_id: relId });
      say('ok', '✓ Relationship deleted');
      await loadRelationships(edit.work_id);
    } catch (e) { say('err', e instanceof MrqApiError ? e.message : String(e)); }
  }

  function addTag() {
    const val = newTag.trim();
    if (!edit || !val || edit.tags.includes(val)) { setNewTag(''); return; }
    setEdit({ ...edit, tags: [...edit.tags, val] });
    setNewTag('');
  }
  function removeTag(t: string) { setEdit((prev) => prev && ({ ...prev, tags: prev.tags.filter((x) => x !== t) })); }

  async function save() {
    if (!edit) return;
    if (edit.isNew && !edit.work_id.trim()) { say('err', 'work_id required'); return; }
    if (edit.isNew && !edit.title.trim()) { say('err', 'title required'); return; }
    setSaving(true);
    const vi = (s: string) => (s.trim() === '' ? null : parseInt(s.trim()));
    const payload = {
      work_id: edit.work_id.trim(),
      is_new: edit.isNew,
      title: edit.title || null, alternative_title: edit.alternative_title || null,
      passavant_no: edit.passavant_no || null, inventory_number: edit.inventory_number || null,
      creator_name: edit.creator_name || null, attribution_category: edit.attribution_category || null,
      object_type: edit.object_type || null, medium_category: edit.medium_category || null, period: edit.period || null,
      year_from: vi(edit.year_from), year_to: vi(edit.year_to),
      medium: edit.medium || null, size_text: edit.size_text || null,
      commissioner: edit.commissioner || null, work_group: edit.work_group || null,
      canonical_venue_id: edit.canonical_venue_id || null, canonical_display_group_id: edit.canonical_display_group_id || null,
      status: edit.status || null, magnet: vi(edit.magnet) ?? 0, work_kind: edit.work_kind || 'physical',
      program_cycle: edit.program_cycle || null, visit_count: edit.visit_count || null,
      first_seen_date: edit.first_seen_date || null, last_checked: edit.last_checked || null,
      relationship_summary: edit.relationship_summary || null, description_short: edit.description_short || null,
      notes_internal: edit.notes_internal || null, source: edit.source || null, source_reference: edit.source_reference || null,
      artwork_url: edit.artwork_url || null, venue_image_url: edit.venue_image_url || null,
      quest_image_url: edit.quest_image_url || null, external_image_url: edit.external_image_url || null,
      tags: edit.tags.length > 0 ? edit.tags : null,
    };
    try {
      await callMrqApi('saveWork', payload);
      say('ok', `✓ ${payload.work_id} ${edit.isNew ? 'created' : 'saved'}`);
      closeEdit();
      await load();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteWork() {
    if (!edit || edit.isNew) return;
    if (!confirm(`Delete ${edit.work_id}? This cannot be undone.`)) return;
    try {
      await callMrqApi('deleteWork', { work_id: edit.work_id });
      say('ok', `✓ ${edit.work_id} deleted`);
      closeEdit();
      await load();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    }
  }

  const usedFilterKeys = new Set(Object.keys(activeFilters));

  return (
    <div>
      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, background: msg.type === 'ok' ? '#ddeee3' : msg.type === 'err' ? '#f5dad7' : '#dceafb', color: msg.type === 'ok' ? '#2d6a4f' : msg.type === 'err' ? '#8b2e23' : '#0c4a8c', fontSize: 13 }}>{msg.text}</div>}

      <div className="toolbar">
        <h2>Works Admin</h2>
        <button className="btn gold" onClick={openNew}>+ New work</button>
        <button className="btn ghost" onClick={load}>↺ Reload</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 14 }}>
        <div className="card"><div className="metric">{stats.total}</div><div className="label">total works</div></div>
        <div className="card"><div className="metric">{stats.raphael}</div><div className="label">Raphael</div></div>
        <div className="card"><div className="metric">{stats.dg}</div><div className="label">with display group</div></div>
        <div className="card"><div className="metric">{stats.artwork}</div><div className="label">artwork URL</div></div>
        <div className="card"><div className="metric">{stats.venueImg}</div><div className="label">venue image</div></div>
        <div className="card"><div className="metric">{stats.quest}</div><div className="label">quest photo</div></div>
        <div className="card"><div className="metric">{stats.realEncountered}</div><div className="label">actually encountered</div></div>
        <div className="card"><div className="metric" style={{ color: stats.mismatch ? 'var(--r)' : undefined }}>{stats.mismatch}</div><div className="label">manual/real mismatch</div></div>
      </div>

      <div className="crm-toolbar">
        <input placeholder="Search title, creator, venue, medium, notes…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
        <input placeholder="Yr from" type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} style={{ width: 80 }} />
        <input placeholder="Yr to" type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} style={{ width: 80 }} />
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
        {(search || yearFrom || yearTo || Object.keys(activeFilters).length > 0) && (
          <button className="clear-filters" onClick={() => { setSearch(''); setYearFrom(''); setYearTo(''); setActiveFilters({}); }}>Clear filters</button>
        )}
        <span className="small" style={{ marginLeft: 'auto' }}>{filtered.length} shown</span>
      </div>

      {edit && (
        <div className="card" style={{ border: '2px solid var(--g)', marginBottom: 14 }}>
          <div className="detail-head">
            <h2 style={{ fontSize: 16 }}>{edit.isNew ? 'New work' : `Edit work — ${edit.work_id}`}</h2>
            <button className="btn ghost btn-sm" onClick={closeEdit}>✕ Close</button>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Identity</div>
          <div className="fgrid">
            <div className="fitem"><label className="flabel">work_id</label><input value={edit.work_id} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, work_id: e.target.value })} placeholder="e.g. RAF-1099" /></div>
            <div className="fitem"><label className="flabel">title</label><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">alternative_title</label><input value={edit.alternative_title} onChange={(e) => setEdit({ ...edit, alternative_title: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">period</label><input value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">year_from</label><input type="number" value={edit.year_from} onChange={(e) => setEdit({ ...edit, year_from: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">year_to</label><input type="number" value={edit.year_to} onChange={(e) => setEdit({ ...edit, year_to: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">object_type</label>
              <select value={edit.object_type} onChange={(e) => setEdit({ ...edit, object_type: e.target.value })}>
                <option value="">— unset —</option>
                {['painting', 'drawing', 'tapestry', 'engraving', 'other'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">work_kind</label>
              <select value={edit.work_kind} onChange={(e) => setEdit({ ...edit, work_kind: e.target.value })}>
                <option value="physical">physical</option><option value="virtual">virtual</option>
              </select>
            </div>
            <div className="fitem"><label className="flabel">work_group</label><input value={edit.work_group} onChange={(e) => setEdit({ ...edit, work_group: e.target.value })} /></div>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Classification &amp; Attribution</div>
          <div className="fgrid">
            <div className="fitem"><label className="flabel">creator_name</label><input value={edit.creator_name} onChange={(e) => setEdit({ ...edit, creator_name: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">attribution_category</label>
              <select value={edit.attribution_category} onChange={(e) => setEdit({ ...edit, attribution_category: e.target.value })}>
                <option value="">— unset —</option>
                {['Raphael', 'After Raphael', 'After Michaelangelo', 'Attributed to', 'School of Raphael', 'Circle of Perugino', 'Leonardo da Vinci', 'Other'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">commissioner</label><input value={edit.commissioner} onChange={(e) => setEdit({ ...edit, commissioner: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">medium_category</label>
              <select value={edit.medium_category} onChange={(e) => setEdit({ ...edit, medium_category: e.target.value })}>
                <option value="">— unset —</option>
                {['Fresco', 'Oil on panel', 'Oil on canvas', 'Oil on wall', 'Tapestry', 'Pen and ink', 'Black chalk', 'Red chalk', 'Black and red chalk', 'Silverpoint/Metalpoint', 'Engraving', 'Gouache', 'Charcoal', 'Bronze', 'Sculpture (other)', 'Mosaic', 'Other/Mixed'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">medium</label><input value={edit.medium} onChange={(e) => setEdit({ ...edit, medium: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">size_text</label><input value={edit.size_text} onChange={(e) => setEdit({ ...edit, size_text: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">program_cycle</label><input value={edit.program_cycle} onChange={(e) => setEdit({ ...edit, program_cycle: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">magnet</label>
              <select value={edit.magnet} onChange={(e) => setEdit({ ...edit, magnet: e.target.value })}>
                <option value="0">0 — regular</option><option value="1">1 — magnet</option><option value="2">2 — high magnet</option><option value="3">3 — anchor</option>
              </select>
            </div>
            <div className="fitem"><label className="flabel">passavant_no</label><input value={edit.passavant_no} onChange={(e) => setEdit({ ...edit, passavant_no: e.target.value })} /></div>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Location &amp; Display</div>
          <div className="fgrid">
            <div className="fitem"><label className="flabel">canonical_venue_id</label>
              <select value={edit.canonical_venue_id} onChange={(e) => setEdit({ ...edit, canonical_venue_id: e.target.value })}>
                <option value="">— unset —</option>
                {[...venues].sort((a, b) => (a.venue_name || a.venue_id).localeCompare(b.venue_name || b.venue_id)).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name ? `${v.venue_name} (${v.venue_id})` : v.venue_id}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">inventory_number</label><input value={edit.inventory_number} onChange={(e) => setEdit({ ...edit, inventory_number: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">canonical_display_group_id</label>
              <select value={edit.canonical_display_group_id} onChange={(e) => setEdit({ ...edit, canonical_display_group_id: e.target.value })}>
                <option value="">— unset —</option>
                {[...displayGroups].sort((a, b) => (a.group_name || a.display_group_id).localeCompare(b.group_name || b.display_group_id)).map((d) => <option key={d.display_group_id} value={d.display_group_id}>{d.group_name ? `${d.group_name} (${d.display_group_id})` : d.display_group_id}</option>)}
              </select>
            </div>
            <div className="fitem"><label className="flabel">source</label><input value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">source_reference</label><input value={edit.source_reference} onChange={(e) => setEdit({ ...edit, source_reference: e.target.value })} /></div>
            <div className="fitem"><label className="flabel">last_checked</label><input value={edit.last_checked} onChange={(e) => setEdit({ ...edit, last_checked: e.target.value })} /></div>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', border: '1px solid #ccc', borderRadius: 5, minHeight: 34, marginBottom: 6 }}>
            {!edit.tags.length ? <span className="small">no tags</span> :
              edit.tags.map((t) => <span key={t} className="tag-chip">{t} <span style={{ cursor: 'pointer' }} onClick={() => removeTag(t)}>×</span></span>)}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input placeholder="Add tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)} style={{ width: 180 }} onKeyDown={(e) => { if (e.key === 'Enter') addTag(); }} />
            <button className="btn btn-sm btn-navy" onClick={addTag}>+ Add tag</button>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Notes</div>
          <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="fitem"><label className="flabel">description_short</label><textarea rows={3} value={edit.description_short} onChange={(e) => setEdit({ ...edit, description_short: e.target.value })} style={{ width: '100%' }} /></div>
            <div className="fitem"><label className="flabel">notes_internal</label><textarea rows={3} value={edit.notes_internal} onChange={(e) => setEdit({ ...edit, notes_internal: e.target.value })} style={{ width: '100%' }} /></div>
          </div>

          <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>URLs</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="fitem"><label className="flabel">artwork_url — institution catalog page</label><input value={edit.artwork_url} onChange={(e) => setEdit({ ...edit, artwork_url: e.target.value })} placeholder="https://…" /></div>
              <div className="fitem"><label className="flabel">venue_image_url — institution photo</label><input value={edit.venue_image_url} onChange={(e) => setEdit({ ...edit, venue_image_url: e.target.value })} placeholder="https://…" /></div>
              <div className="fitem"><label className="flabel">quest_image_url — your photo</label><input value={edit.quest_image_url} onChange={(e) => setEdit({ ...edit, quest_image_url: e.target.value })} placeholder="https://…" /></div>
              <div className="fitem"><label className="flabel">external_image_url — internet photo</label><input value={edit.external_image_url} onChange={(e) => setEdit({ ...edit, external_image_url: e.target.value })} placeholder="https://…" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Thumb url={edit.venue_image_url} label="Institution" />
              <Thumb url={edit.quest_image_url} label="Your photo" />
              <Thumb url={edit.external_image_url} label="Internet" />
            </div>
          </div>

          {edit.isNew ? (
            <div className="small" style={{ margin: '10px 0', color: 'var(--m)' }}>Relationships and encounter history become available once this work is saved.</div>
          ) : (
            <>
              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Relationships</div>
              <div className="fgroup"><label className="flabel">relationship_summary</label><input value={edit.relationship_summary} onChange={(e) => setEdit({ ...edit, relationship_summary: e.target.value })} style={{ width: '100%' }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {!relationships.length ? <span className="small">No relationships</span> :
                  [...relationships].sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)).map((r) => {
                    const isFrom = r.from_work_id === edit.work_id;
                    const otherId = isFrom ? r.to_work_id : r.from_work_id;
                    const otherHtml = `${r.other_title || otherId} (${otherId})`;
                    return (
                      <div key={r.relationship_id} style={{ padding: '8px 10px', background: 'var(--i)', border: '1px solid var(--l)', borderRadius: 6 }}>
                        <div style={{ fontSize: 13 }}>{relationshipSentence(r.relationship_type, isFrom, otherHtml)}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--m)', marginTop: 4, flexWrap: 'wrap' }}>
                          <span className="tag-chip-sm role-general">{r.relationship_type}</span>
                          {r.sequence != null && <span>seq {r.sequence}</span>}
                          {r.role && <span>role: {r.role}</span>}
                          {r.notes && <span title={r.notes}>📝 {r.notes.length > 40 ? r.notes.slice(0, 40) + '…' : r.notes}</span>}
                          <button className="btn ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => deleteRelationship(r.relationship_id)}>✕ Remove</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="small" style={{ marginBottom: 6, color: 'var(--m)' }}>Pick a relationship type, then say which work is which side of it.</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: 8, background: '#fff8e7', border: '1px solid #d4a84b', borderRadius: 6 }}>
                <select value={relType} onChange={(e) => setRelType(e.target.value)}>
                  {Object.entries(REL_LABELS).map(([k, lbl]) => <option key={k} value={k}>{k} — {lbl}</option>)}
                </select>
                <select value={relDirection} onChange={(e) => setRelDirection(e.target.value as 'from' | 'to')}>
                  <option value="from">This work → other is the whole/original</option>
                  <option value="to">Other → this work is the whole/original</option>
                </select>
                <input placeholder="Other work_id" value={relOtherId} onChange={(e) => setRelOtherId(e.target.value)} style={{ width: 140 }} />
                <input placeholder="Seq" type="number" value={relSequence} onChange={(e) => setRelSequence(e.target.value)} style={{ width: 60 }} />
                <input placeholder="Role" value={relRole} onChange={(e) => setRelRole(e.target.value)} style={{ width: 120 }} />
                <input placeholder="Notes" value={relNotes} onChange={(e) => setRelNotes(e.target.value)} style={{ width: 140 }} />
                <button className="btn btn-sm btn-navy" onClick={addRelationship}>+ Add</button>
              </div>

              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)', marginTop: 14 }}>
                Encounter History <span className="small" style={{ fontWeight: 400 }}>(read-only — edit in Encounter Admin)</span>
              </div>
              <div className="fgrid" style={{ marginBottom: 10 }}>
                <div className="fitem"><label className="flabel">visit_count (your manual record)</label>
                  <select value={edit.visit_count} onChange={(e) => setEdit({ ...edit, visit_count: e.target.value })}>
                    <option value="">— unset —</option>
                    <option value="Not Seen">Not Seen</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={`Seen (${n} times)`}>Seen ({n} time{n > 1 ? 's' : ''})</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">first_seen_date</label><input value={edit.first_seen_date} onChange={(e) => setEdit({ ...edit, first_seen_date: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">status (institutional)</label>
                  <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                    <option value="">On display</option>
                    {['LOST', 'MISSING', 'NOT ACCESIBLE', 'NOT IN DISPLAY'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                {!encHistory.length ? <span className="small">No encounters recorded</span> :
                  [...encHistory].sort((a, b) => (b.encounter_timestamp || '').localeCompare(a.encounter_timestamp || '')).map((e) => (
                    <div key={e.encounter_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--i)', border: '1px solid var(--l)', borderRadius: 6, fontSize: 11, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, minWidth: 80 }}>{e.encounter_timestamp ? e.encounter_timestamp.split('T')[0] : (e.visit_date || '—')}</span>
                      <span>{e.venue_name || '—'}</span>
                      {e.encounter_learning_path_id && <span className="tag-chip-sm role-digital">{e.encounter_learning_path_id}</span>}
                      {e.confirmation_method && <span className="small">{e.confirmation_method}</span>}
                      {e.notes && <span title={e.notes}>📝 {e.notes.length > 30 ? e.notes.slice(0, 30) + '…' : e.notes}</span>}
                      <span className="small" style={{ marginLeft: 'auto' }}>{e.encounter_id}</span>
                    </div>
                  ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
            <button className="btn gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : edit.isNew ? 'Create work' : 'Save changes'}</button>
            <button className="btn ghost" onClick={closeEdit}>Cancel</button>
            {!edit.isNew && <button className="btn btn-sm btn-danger-outline" style={{ marginLeft: 'auto' }} onClick={deleteWork}>Delete work</button>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card small">Loading works…</div>
      ) : (
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th onClick={() => sortBy('work_id')}>ID ↕</th>
                <th onClick={() => sortBy('title')}>Title ↕</th>
                <th onClick={() => sortBy('attribution_category')}>Attribution ↕</th>
                <th onClick={() => sortBy('object_type')}>Type ↕</th>
                <th>Dates</th>
                <th onClick={() => sortBy('canonical_venue_id')}>Venue ↕</th>
                <th onClick={() => sortBy('inventory_number')}>Inv. No ↕</th>
                <th onClick={() => sortBy('passavant_no')}>Passavant ↕</th>
                <th onClick={() => sortBy('status')}>Status ↕</th>
                <th onClick={() => sortBy('__encCount')} title="Real count from the encounter table">Encounters ↕</th>
                <th onClick={() => sortBy('magnet')}>⭑ ↕</th>
                <th>URLs</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const venueName = r.canonical_venue_id ? (venueMap[r.canonical_venue_id] || r.canonical_venue_id) : '—';
                const n = encounterCounts[r.work_id] || 0;
                const manual = manualVisitCount(r);
                const mismatch = n !== manual;
                return (
                  <tr key={r.work_id}>
                    <td className="small">{r.work_id}</td>
                    <td title={r.title || ''} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title || '—'}{r.work_kind === 'virtual' && <span className="tag-chip-sm role-digital" style={{ marginLeft: 4 }} title="virtual work (dispersed whole)">V</span>}
                    </td>
                    <td><span className={`tag-chip-sm ${attribClass(r.attribution_category)}`}>{r.attribution_category || '—'}</span></td>
                    <td className="small">{r.object_type || '—'}</td>
                    <td className="small">{dateStr(r)}</td>
                    <td className="small" title={venueName} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venueName}</td>
                    <td className="small">{r.inventory_number || '—'}</td>
                    <td className="small">{r.passavant_no || '—'}</td>
                    <td>
                      {r.status && <span className="tag-chip-sm role-gatekeeper">{r.status}</span>}
                      {String(r.visit_count || '').trim().startsWith('Seen') && <span className="tag-chip-sm role-curator" style={{ marginLeft: 2 }}>Encountered{manual ? ` ×${manual}` : ''}</span>}
                    </td>
                    <td>
                      {n > 0 ? <span className="tag-chip-sm role-curator">×{n}</span> : <span className="small">—</span>}
                      {mismatch && <span title={`Manual field says ${manual}, real count is ${n}`} style={{ color: 'var(--r)', fontWeight: 700, marginLeft: 4, cursor: 'help' }}>⚠</span>}
                    </td>
                    <td style={{ color: '#D4A84B' }} className="small">{'⭑'.repeat(r.magnet || 0)}</td>
                    <td>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', margin: 1, background: r.artwork_url ? '#27500A' : '#E0D9D0' }} title="artwork URL" />
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', margin: 1, background: r.venue_image_url ? '#27500A' : '#E0D9D0' }} title="venue image" />
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', margin: 1, background: r.quest_image_url ? '#27500A' : '#E0D9D0' }} title="quest photo" />
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', margin: 1, background: r.external_image_url ? '#27500A' : '#E0D9D0' }} title="external image" />
                    </td>
                    <td><button className="btn ghost btn-sm" onClick={() => openEdit(r.work_id)}>✎</button></td>
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

function Thumb({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ width: 130, height: 130, border: '1px solid var(--l)', borderRadius: 6, overflow: 'hidden', background: 'var(--i)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
      {!url ? (
        <div className="small" style={{ textAlign: 'center', padding: 10 }}>No {label.toLowerCase()} photo</div>
      ) : failed ? (
        <div className="small" style={{ textAlign: 'center', padding: 10 }}>⚠ Image failed to load</div>
      ) : (
        <>
          <img src={url} alt={label} onError={() => setFailed(true)} onClick={() => window.open(url, '_blank')} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, padding: '3px 5px', textAlign: 'center' }}>{label}</div>
        </>
      )}
    </div>
  );
}
