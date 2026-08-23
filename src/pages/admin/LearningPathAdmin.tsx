import { useEffect, useMemo, useRef, useState } from 'react';
import { callMrqApi, MrqApiError } from '@/lib/mrqApi';

// Ported from mrq_lp_admin_v7.html. "Encountered" is computed purely from LP
// membership (learning_path_work) intersected with real encounter rows --
// encounter_learning_path_id was cleared globally in production and is
// intentionally never read, same as the legacy tool's own note on this.
type LearningPath = {
  learning_path_id: string; learning_path_name: string | null; learning_path_type: string | null;
  learning_path_focus: string | null; description: string | null; status: string | null;
  total_target_count: number | null; encountered_count: number | null; progress_percent: number | null;
  institution_id: string | null; path_mode: string | null; shareable: number | null; estimated_time_minutes: number | null;
};
type Venue = { venue_id: string; venue_name: string | null; city: string | null };
type DisplayGroup = { display_group_id: string; group_name: string | null };
type LPWorkRow = {
  learning_path_id: string; work_id: string; catalogue_reference: string | null; venue_id: string | null;
  display_group_id: string | null; sequence: number | null;
  work_title: string | null; work_type: string | null; work_status: string | null;
  encounters: { encounter_id: string; date: string | null }[];
};

type EditState = { work_id: string; catalogue_reference: string; venue_id: string; display_group_id: string; sequence: string; encounters: LPWorkRow['encounters'] };
type LPMetaState = {
  learning_path_id: string; learning_path_name: string; learning_path_type: string; status: string; path_mode: string;
  learning_path_focus: string; institution_id: string; total_target_count: string; encountered_count: number | null;
  progress_percent: number | null; estimated_time_minutes: string; shareable: string; description: string;
};

export function LearningPathAdmin() {
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [workCounts, setWorkCounts] = useState<Record<string, number>>({});
  const [encounteredCounts, setEncounteredCounts] = useState<Record<string, number>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [displayGroups, setDisplayGroups] = useState<DisplayGroup[]>([]);

  const [lpSortField, setLpSortField] = useState('learning_path_id');
  const [lpSortDir, setLpSortDir] = useState(1);
  const [lpEncFilter, setLpEncFilter] = useState('all');

  const [showNewLP, setShowNewLP] = useState(false);
  const [nlId, setNlId] = useState('');
  const [nlName, setNlName] = useState('');
  const [nlType, setNlType] = useState('system');
  const [nlFocus, setNlFocus] = useState('');
  const [nlStatus, setNlStatus] = useState('active');
  const [nlTarget, setNlTarget] = useState('0');
  const [nlInstitution, setNlInstitution] = useState('');
  const [nlMode, setNlMode] = useState('physical');
  const [nlShareable, setNlShareable] = useState('0');
  const [nlDesc, setNlDesc] = useState('');
  const [nlSaving, setNlSaving] = useState(false);

  const [currentLPId, setCurrentLPId] = useState<string | null>(null);
  const [rows, setRows] = useState<LPWorkRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [pendingFilterKey, setPendingFilterKey] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortCol, setSortCol] = useState('work_id');
  const [sortDir, setSortDir] = useState(1);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const [lpMeta, setLpMeta] = useState<LPMetaState | null>(null);
  const [lpMetaSaving, setLpMetaSaving] = useState(false);

  const [awQuery, setAwQuery] = useState('');
  const [awResults, setAwResults] = useState<{ work_id: string; title: string | null; object_type: string | null }[]>([]);
  const [awOpen, setAwOpen] = useState(false);
  const [awStatus, setAwStatus] = useState('');
  const awDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(type: 'ok' | 'err' | 'info', text: string) {
    setMsg({ type, text });
    if (type === 'ok') setTimeout(() => setMsg(null), 3000);
  }

  async function loadOverview() {
    setOverviewLoading(true);
    say('info', 'Loading learning paths…');
    try {
      const res = await callMrqApi('getLearningPathOverview');
      setLearningPaths(res.data.learningPaths);
      setWorkCounts(res.data.workCounts);
      setEncounteredCounts(res.data.encounteredCounts);
      setVenues(res.data.venues);
      setDisplayGroups(res.data.displayGroups);
      say('ok', `${res.data.learningPaths.length} learning paths found`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setOverviewLoading(false);
    }
  }

  useEffect(() => { loadOverview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const venueMap = useMemo(() => { const m: Record<string, Venue> = {}; for (const v of venues) m[v.venue_id] = v; return m; }, [venues]);
  const dgMap = useMemo(() => { const m: Record<string, DisplayGroup> = {}; for (const d of displayGroups) m[d.display_group_id] = d; return m; }, [displayGroups]);
  const currentLPRow = useMemo(() => learningPaths.find((l) => l.learning_path_id === currentLPId) || null, [learningPaths, currentLPId]);

  const enrichedLPs = useMemo(() => learningPaths.map((lp) => {
    const workCount = workCounts[lp.learning_path_id] || 0;
    const encountered = encounteredCounts[lp.learning_path_id] || 0;
    const progressComputed = workCount ? Math.round((encountered / workCount) * 100) : 0;
    return { lp, workCount, encountered, progressComputed };
  }), [learningPaths, workCounts, encounteredCounts]);

  const filteredLPs = useMemo(() => {
    let out = enrichedLPs.filter((x) => {
      if (lpEncFilter === 'has') return x.encountered > 0;
      if (lpEncFilter === 'none') return x.encountered === 0;
      return true;
    });
    out = [...out].sort((a, b) => {
      let va: any, vb: any;
      if (lpSortField === 'work_count') { va = a.workCount; vb = b.workCount; }
      else if (lpSortField === 'encountered_works') { va = a.encountered; vb = b.encountered; }
      else if (lpSortField === 'progress_computed') { va = a.progressComputed; vb = b.progressComputed; }
      else if (lpSortField === 'total_target_count') { va = a.lp.total_target_count || 0; vb = b.lp.total_target_count || 0; }
      else { va = String((a.lp as any)[lpSortField] ?? '').toLowerCase(); vb = String((b.lp as any)[lpSortField] ?? '').toLowerCase(); }
      return va < vb ? -lpSortDir : va > vb ? lpSortDir : 0;
    });
    return out;
  }, [enrichedLPs, lpEncFilter, lpSortField, lpSortDir]);

  const lpTotals = useMemo(() => filteredLPs.reduce((acc, x) => ({
    works: acc.works + x.workCount, encountered: acc.encountered + x.encountered, target: acc.target + (x.lp.total_target_count || 0),
  }), { works: 0, encountered: 0, target: 0 }), [filteredLPs]);

  function openNewLPForm() {
    const maxSeq = learningPaths.reduce((m, r) => { const match = String(r.learning_path_id || '').match(/^LP-(\d+)$/); return match ? Math.max(m, parseInt(match[1])) : m; }, 0);
    setNlId(`LP-${String(maxSeq + 1).padStart(3, '0')}`);
    setShowNewLP(true);
  }

  async function createLP() {
    if (!nlId.trim()) { say('err', 'Learning path ID required'); return; }
    if (!nlName.trim()) { say('err', 'Name required'); return; }
    if (learningPaths.some((r) => r.learning_path_id === nlId.trim())) { say('err', 'That ID already exists'); return; }
    setNlSaving(true);
    try {
      await callMrqApi('createLearningPath', {
        learning_path_id: nlId.trim(), learning_path_name: nlName.trim(), learning_path_type: nlType,
        learning_path_focus: nlFocus.trim() || null, description: nlDesc.trim() || null, status: nlStatus,
        total_target_count: parseInt(nlTarget || '0'), encountered_count: 0, progress_percent: 0,
        institution_id: nlInstitution || null, path_mode: nlMode, shareable: parseInt(nlShareable),
      });
      say('ok', `✓ Created ${nlId.trim()}`);
      setShowNewLP(false); setNlName(''); setNlFocus(''); setNlDesc('');
      await loadOverview();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setNlSaving(false);
    }
  }

  async function selectLP(lpId: string) {
    setCurrentLPId(lpId);
    setActiveFilters({}); setSearch('');
    await loadLPWorks(lpId);
  }

  async function loadLPWorks(lpId: string) {
    setRowsLoading(true);
    say('info', `Loading ${lpId}…`);
    try {
      const res = await callMrqApi('getLearningPathWorks', { learning_path_id: lpId });
      setRows(res.data || []);
      say('ok', `Loaded ${(res.data || []).length} works for ${lpId}`);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setRowsLoading(false);
    }
  }

  function changeLP() {
    setCurrentLPId(null);
    setRows([]);
    loadOverview();
  }

  const FILTER_DEFS = useMemo(() => [
    { key: 'workType', label: 'Work Type', match: (r: LPWorkRow, v: string) => (r.work_type || '__none__') === v, optionLabel: (v: string) => v === '__none__' ? '⚠ No type' : v, options: () => ['__none__', ...new Set(rows.map((r) => r.work_type).filter(Boolean) as string[])].sort() },
    { key: 'workStatus', label: 'Status', match: (r: LPWorkRow, v: string) => (r.work_status || '__none__') === v, optionLabel: (v: string) => v === '__none__' ? '(on display / no flag)' : v, options: () => ['__none__', ...new Set(rows.map((r) => r.work_status).filter(Boolean) as string[])].sort() },
    { key: 'venue', label: 'Venue', match: (r: LPWorkRow, v: string) => v === '__none__' ? !r.venue_id : r.venue_id === v, optionLabel: (v: string) => v === '__none__' ? '⚠ No venue' : (venueMap[v]?.venue_name || v), options: () => ['__none__', ...new Set(rows.map((r) => r.venue_id).filter(Boolean) as string[])].sort() },
    { key: 'displayGroup', label: 'Display Group', match: (r: LPWorkRow, v: string) => v === '__none__' ? !r.display_group_id : r.display_group_id === v, optionLabel: (v: string) => v === '__none__' ? '⚠ No DG' : (dgMap[v]?.group_name || v), options: () => ['__none__', ...new Set(rows.map((r) => r.display_group_id).filter(Boolean) as string[])].sort() },
    { key: 'encountered', label: 'Encounters', match: (r: LPWorkRow, v: string) => v === 'yes' ? r.encounters.length > 0 : r.encounters.length === 0, optionLabel: (v: string) => v === 'yes' ? 'Has encounters' : 'No encounters yet', options: () => ['yes', 'no'] },
  ], [rows, venueMap, dgMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let out = rows.filter((r) => {
      if (q && !r.work_id.toLowerCase().includes(q) && !(r.catalogue_reference || '').toLowerCase().includes(q) && !(r.work_title || '').toLowerCase().includes(q)) return false;
      for (const key in activeFilters) {
        const def = FILTER_DEFS.find((d) => d.key === key);
        if (def && !def.match(r, activeFilters[key])) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === '__venue') { va = venueMap[a.venue_id || '']?.venue_name || ''; vb = venueMap[b.venue_id || '']?.venue_name || ''; }
      else if (sortCol === '__title') { va = a.work_title || ''; vb = b.work_title || ''; }
      else if (sortCol === '__type') { va = a.work_type || ''; vb = b.work_type || ''; }
      else if (sortCol === '__status') { va = a.work_status || ''; vb = b.work_status || ''; }
      else if (sortCol === '__dg') { va = dgMap[a.display_group_id || '']?.group_name || ''; vb = dgMap[b.display_group_id || '']?.group_name || ''; }
      else if (sortCol === '__enc') { va = a.encounters.length; vb = b.encounters.length; }
      else { va = (a as any)[sortCol] ?? ''; vb = (b as any)[sortCol] ?? ''; }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
    return out;
  }, [rows, search, activeFilters, sortCol, sortDir, FILTER_DEFS, venueMap, dgMap]);

  const stats = useMemo(() => ({
    total: rows.length, shown: filtered.length,
    encountered: filtered.filter((r) => r.encounters.length > 0).length,
    noVenue: rows.filter((r) => !r.venue_id).length, noDg: rows.filter((r) => !r.display_group_id).length,
  }), [rows, filtered]);

  function sortBy(c: string) { if (sortCol === c) setSortDir((d) => -d); else { setSortCol(c); setSortDir(1); } }
  const usedFilterKeys = new Set(Object.keys(activeFilters));

  useEffect(() => {
    if (awDebounce.current) clearTimeout(awDebounce.current);
    const q = awQuery.trim();
    if (q.length < 2) { setAwResults([]); setAwOpen(false); return; }
    awDebounce.current = setTimeout(async () => {
      try {
        const res = await callMrqApi('searchWorksAdmin', { query: q });
        const inLP = new Set(rows.map((r) => r.work_id));
        setAwResults((res.data || []).filter((w: any) => !inLP.has(w.work_id)));
        setAwOpen(true);
      } catch { /* ignore transient search errors */ }
    }, 300);
    return () => { if (awDebounce.current) clearTimeout(awDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awQuery]);

  async function addWorkToLP(workId: string) {
    if (!currentLPId) return;
    setAwStatus('Adding…'); setAwOpen(false);
    try {
      await callMrqApi('addWorkToLearningPath', { learning_path_id: currentLPId, work_id: workId });
      setAwStatus(`✓ Added ${workId}`); setAwQuery('');
      await loadLPWorks(currentLPId);
      setTimeout(() => setAwStatus(''), 2000);
    } catch (e) {
      setAwStatus(`Failed: ${e instanceof MrqApiError ? e.message : String(e)}`);
    }
  }

  function openEdit(workId: string) {
    const r = rows.find((x) => x.work_id === workId); if (!r) return;
    setEdit({ work_id: workId, catalogue_reference: r.catalogue_reference || '', venue_id: r.venue_id || '', display_group_id: r.display_group_id || '', sequence: r.sequence == null ? '' : String(r.sequence), encounters: r.encounters });
  }
  function closeEdit() { setEdit(null); }

  async function saveWorkEdit() {
    if (!edit || !currentLPId) return;
    setSaving(true);
    try {
      await callMrqApi('saveLearningPathWork', {
        learning_path_id: currentLPId, work_id: edit.work_id,
        catalogue_reference: edit.catalogue_reference.trim() || null, venue_id: edit.venue_id || null,
        display_group_id: edit.display_group_id || null, sequence: edit.sequence.trim() === '' ? null : parseInt(edit.sequence),
      });
      say('ok', `✓ ${edit.work_id} saved`);
      closeEdit();
      await loadLPWorks(currentLPId);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeWorkLine() {
    if (!edit || !currentLPId) return;
    if (!confirm(`Remove ${edit.work_id} from ${currentLPId}? This only removes it from this learning path — the work record itself is untouched.`)) return;
    try {
      await callMrqApi('removeLearningPathWork', { learning_path_id: currentLPId, work_id: edit.work_id });
      say('ok', `✓ Removed ${edit.work_id} from ${currentLPId}`);
      closeEdit();
      await loadLPWorks(currentLPId);
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    }
  }

  function openLPMetaEdit() {
    const lp = currentLPRow; if (!lp) return;
    setLpMeta({
      learning_path_id: lp.learning_path_id, learning_path_name: lp.learning_path_name || '', learning_path_type: lp.learning_path_type || 'system',
      status: lp.status || 'active', path_mode: lp.path_mode || 'physical', learning_path_focus: lp.learning_path_focus || '',
      institution_id: lp.institution_id || '', total_target_count: String(lp.total_target_count ?? 0), encountered_count: lp.encountered_count ?? 0,
      progress_percent: lp.progress_percent ?? 0, estimated_time_minutes: lp.estimated_time_minutes == null ? '' : String(lp.estimated_time_minutes),
      shareable: String(lp.shareable ?? 0), description: lp.description || '',
    });
  }
  function closeLPMetaEdit() { setLpMeta(null); }

  async function saveLPMeta() {
    if (!lpMeta) return;
    setLpMetaSaving(true);
    try {
      await callMrqApi('saveLearningPathMeta', {
        learning_path_id: lpMeta.learning_path_id, learning_path_name: lpMeta.learning_path_name.trim() || null,
        learning_path_type: lpMeta.learning_path_type, status: lpMeta.status, path_mode: lpMeta.path_mode,
        learning_path_focus: lpMeta.learning_path_focus.trim() || null, institution_id: lpMeta.institution_id || null,
        total_target_count: lpMeta.total_target_count.trim() === '' ? 0 : parseInt(lpMeta.total_target_count),
        estimated_time_minutes: lpMeta.estimated_time_minutes.trim() === '' ? null : parseInt(lpMeta.estimated_time_minutes),
        shareable: parseInt(lpMeta.shareable), description: lpMeta.description.trim() || null,
        last_updated: new Date().toISOString().slice(0, 10),
      });
      say('ok', `✓ ${lpMeta.learning_path_id} details saved`);
      closeLPMetaEdit();
      await loadOverview();
    } catch (e) {
      say('err', e instanceof MrqApiError ? e.message : String(e));
    } finally {
      setLpMetaSaving(false);
    }
  }

  return (
    <div>
      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, background: msg.type === 'ok' ? '#ddeee3' : msg.type === 'err' ? '#f5dad7' : '#dceafb', color: msg.type === 'ok' ? '#2d6a4f' : msg.type === 'err' ? '#8b2e23' : '#0c4a8c', fontSize: 13 }}>{msg.text}</div>}

      {!currentLPId ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 8 }}>Select a learning path to load</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="small">Sort by</span>
            <select value={lpSortField} onChange={(e) => setLpSortField(e.target.value)}>
              <option value="learning_path_id">ID</option><option value="learning_path_name">Name</option>
              <option value="learning_path_type">Type</option><option value="status">Status</option>
              <option value="work_count">Works in path</option><option value="encountered_works">Encountered works</option>
              <option value="total_target_count">Target count</option><option value="progress_computed">Progress %</option>
            </select>
            <button className="btn btn-sm" onClick={() => setLpSortDir((d) => -d)}>{lpSortDir === 1 ? '↑ asc' : '↓ desc'}</button>
            <span className="small" style={{ marginLeft: 10 }}>Filter</span>
            <select value={lpEncFilter} onChange={(e) => setLpEncFilter(e.target.value)}>
              <option value="all">All learning paths</option><option value="has">Has encounters</option><option value="none">No encounters yet</option>
            </select>
          </div>
          {overviewLoading ? (
            <div className="small">Loading learning paths…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto' }}>
              {filteredLPs.map((x) => {
                const lp = x.lp;
                return (
                  <div key={lp.learning_path_id} className="clickable" onClick={() => selectLP(lp.learning_path_id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid var(--l)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--n)' }}>
                        {lp.learning_path_id} <span className="tag-chip-sm role-curator">{lp.learning_path_type || '?'}</span><span className="tag-chip-sm role-digital" style={{ marginLeft: 4 }}>{lp.status || '?'}</span>
                      </div>
                      <div style={{ marginTop: 2 }}>{lp.learning_path_name || ''}</div>
                      {lp.learning_path_focus && <div className="small" style={{ marginTop: 2 }}>{lp.learning_path_focus}</div>}
                    </div>
                    <div className="small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {x.workCount} work{x.workCount !== 1 ? 's' : ''} linked<br />
                      target {lp.total_target_count || 0} · <span style={{ fontWeight: 700, color: x.encountered ? '#155724' : undefined }}>{x.encountered} encountered</span> ({x.progressComputed}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!overviewLoading && (
            <div style={{ display: 'flex', gap: 18, marginTop: 10, padding: '8px 14px', background: '#fff', border: '1px dashed var(--l)', borderRadius: 6, fontSize: 11 }}>
              <span>{filteredLPs.length} learning path{filteredLPs.length !== 1 ? 's' : ''} shown</span>
              <span>Works: <b>{lpTotals.works}</b></span>
              <span>Target: <b>{lpTotals.target}</b></span>
              <span>Encountered works: <b>{lpTotals.encountered}</b></span>
            </div>
          )}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--l)' }}>
            <button className="btn btn-sm btn-navy" onClick={openNewLPForm}>+ New Learning Path</button>
            {showNewLP && (
              <div className="fgrid" style={{ marginTop: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="fitem"><label className="flabel">Learning path ID</label><input value={nlId} onChange={(e) => setNlId(e.target.value)} placeholder="LP-008" /></div>
                <div className="fitem"><label className="flabel">Name</label><input value={nlName} onChange={(e) => setNlName(e.target.value)} placeholder="e.g. The Florentine Period" /></div>
                <div className="fitem"><label className="flabel">Type</label>
                  <select value={nlType} onChange={(e) => setNlType(e.target.value)}><option value="system">system</option><option value="user">user</option><option value="institution">institution</option></select>
                </div>
                <div className="fitem"><label className="flabel">Focus</label><input value={nlFocus} onChange={(e) => setNlFocus(e.target.value)} placeholder="optional" /></div>
                <div className="fitem"><label className="flabel">Status</label>
                  <select value={nlStatus} onChange={(e) => setNlStatus(e.target.value)}><option value="active">active</option><option value="paused">paused</option><option value="completed">completed</option><option value="template">template</option></select>
                </div>
                <div className="fitem"><label className="flabel">Target count</label><input type="number" value={nlTarget} onChange={(e) => setNlTarget(e.target.value)} /></div>
                <div className="fitem"><label className="flabel">Institution (venue)</label>
                  <select value={nlInstitution} onChange={(e) => setNlInstitution(e.target.value)}>
                    <option value="">— none —</option>
                    {[...venues].sort((a, b) => (a.venue_name || a.venue_id).localeCompare(b.venue_name || b.venue_id)).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name}{v.city ? `, ${v.city}` : ''}</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">Path mode</label>
                  <select value={nlMode} onChange={(e) => setNlMode(e.target.value)}><option value="physical">physical</option><option value="virtual">virtual</option></select>
                </div>
                <div className="fitem"><label className="flabel">Shareable</label>
                  <select value={nlShareable} onChange={(e) => setNlShareable(e.target.value)}><option value="0">no</option><option value="1">yes</option></select>
                </div>
                <div className="fitem" style={{ gridColumn: '1 / -1' }}><label className="flabel">Description</label><input value={nlDesc} onChange={(e) => setNlDesc(e.target.value)} placeholder="optional" /></div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-navy" onClick={createLP} disabled={nlSaving}>{nlSaving ? 'Creating…' : 'Create learning path'}</button>
                  <button className="btn ghost btn-sm" onClick={() => setShowNewLP(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eeedfe', border: '1px solid #d8d4f5', borderRadius: 6, padding: '8px 14px', marginBottom: 12, fontSize: 13, flexWrap: 'wrap' }}>
            Viewing: <span style={{ fontFamily: 'monospace', color: '#3c3489' }}>{currentLPId}</span> — <b>{currentLPRow?.learning_path_name || ''}</b>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn ghost btn-sm" onClick={openLPMetaEdit}>✎ Edit LP details</button>
              <button className="btn ghost btn-sm" onClick={changeLP}>↺ Change learning path</button>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 14 }}>
            <div className="card"><div className="metric">{stats.total}</div><div className="label">works in path</div></div>
            <div className="card"><div className="metric">{stats.shown}</div><div className="label">shown</div></div>
            <div className="card"><div className="metric">{stats.encountered}</div><div className="label">have encounters</div></div>
            <div className="card"><div className="metric" style={{ color: stats.noVenue ? 'var(--r)' : undefined }}>{stats.noVenue}</div><div className="label">missing venue</div></div>
            <div className="card"><div className="metric" style={{ color: stats.noDg ? 'var(--r)' : undefined }}>{stats.noDg}</div><div className="label">missing display group</div></div>
          </div>

          <div className="card" style={{ marginBottom: 12, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder="Search work by title or ID to add…" value={awQuery} onChange={(e) => setAwQuery(e.target.value)} onFocus={() => awResults.length && setAwOpen(true)} style={{ width: 320 }} />
              <span className="small">{awStatus}</span>
            </div>
            {awOpen && (
              <div style={{ position: 'absolute', top: 46, left: 12, width: 400, maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid #C8C0B0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 50 }}>
                {!awResults.length ? <div style={{ padding: '6px 10px', color: 'var(--m)', fontSize: 11 }}>No matches</div> :
                  awResults.map((w) => (
                    <div key={w.work_id} onClick={() => addWorkToLP(w.work_id)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid #F0EBE4' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--n)', fontWeight: 600 }}>{w.work_id}</span> — {w.title || ''} <span className="small">{w.object_type || ''}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="crm-toolbar">
            <input placeholder="Work ID, catalogue ref, title…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
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
                <h2 style={{ fontSize: 16 }}>Edit line · {edit.work_id}</h2>
                <button className="btn ghost btn-sm" onClick={closeEdit}>✕ Close</button>
              </div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">work_id</label><input value={edit.work_id} disabled /></div>
                <div className="fitem"><label className="flabel">Catalogue reference</label><input value={edit.catalogue_reference} onChange={(e) => setEdit({ ...edit, catalogue_reference: e.target.value })} /></div>
              </div>
              <div className="fgrid">
                <div className="fitem"><label className="flabel">venue_id</label>
                  <select value={edit.venue_id} onChange={(e) => setEdit({ ...edit, venue_id: e.target.value })}>
                    <option value="">— none —</option>
                    {[...venues].sort((a, b) => (a.venue_name || a.venue_id).localeCompare(b.venue_name || b.venue_id)).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name}{v.city ? `, ${v.city}` : ''}</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">display_group_id</label>
                  <select value={edit.display_group_id} onChange={(e) => setEdit({ ...edit, display_group_id: e.target.value })}>
                    <option value="">— none —</option>
                    {[...displayGroups].sort((a, b) => (a.group_name || a.display_group_id).localeCompare(b.group_name || b.display_group_id)).map((d) => <option key={d.display_group_id} value={d.display_group_id}>{d.group_name || d.display_group_id}</option>)}
                  </select>
                </div>
                <div className="fitem"><label className="flabel">sequence</label><input type="number" value={edit.sequence} onChange={(e) => setEdit({ ...edit, sequence: e.target.value })} /></div>
              </div>

              <div className="fgroup-title" style={{ borderColor: 'var(--g)', color: 'var(--g)' }}>Encounters logged against this work</div>
              <div className="small" style={{ marginBottom: 10 }}>
                {!edit.encounters.length ? '— none —' : edit.encounters.map((e) => <div key={e.encounter_id} style={{ padding: '3px 0' }}><span style={{ fontFamily: 'monospace' }}>{e.encounter_id}</span> — {e.date || 'no date'}</div>)}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
                <button className="btn gold" onClick={saveWorkEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                <button className="btn ghost" onClick={closeEdit}>Cancel</button>
                <button className="btn btn-sm btn-danger-outline" style={{ marginLeft: 'auto' }} onClick={removeWorkLine}>Remove from path</button>
              </div>
            </div>
          )}

          {lpMeta && (
            <div className="card" style={{ border: '2px solid var(--g)', marginBottom: 14 }}>
              <div className="detail-head">
                <h2 style={{ fontSize: 16 }}>Edit learning path details</h2>
                <button className="btn ghost btn-sm" onClick={closeLPMetaEdit}>✕ Close</button>
              </div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">learning_path_id</label><input value={lpMeta.learning_path_id} disabled /></div>
                <div className="fitem"><label className="flabel">Name</label><input value={lpMeta.learning_path_name} onChange={(e) => setLpMeta({ ...lpMeta, learning_path_name: e.target.value })} /></div>
              </div>
              <div className="fgrid">
                <div className="fitem"><label className="flabel">Type</label>
                  <select value={lpMeta.learning_path_type} onChange={(e) => setLpMeta({ ...lpMeta, learning_path_type: e.target.value })}><option value="system">system</option><option value="user">user</option><option value="institution">institution</option></select>
                </div>
                <div className="fitem"><label className="flabel">Status</label>
                  <select value={lpMeta.status} onChange={(e) => setLpMeta({ ...lpMeta, status: e.target.value })}><option value="active">active</option><option value="paused">paused</option><option value="completed">completed</option><option value="template">template</option></select>
                </div>
                <div className="fitem"><label className="flabel">Path mode</label>
                  <select value={lpMeta.path_mode} onChange={(e) => setLpMeta({ ...lpMeta, path_mode: e.target.value })}><option value="physical">physical</option><option value="virtual">virtual</option></select>
                </div>
              </div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">Focus</label><input value={lpMeta.learning_path_focus} onChange={(e) => setLpMeta({ ...lpMeta, learning_path_focus: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">Institution (venue)</label>
                  <select value={lpMeta.institution_id} onChange={(e) => setLpMeta({ ...lpMeta, institution_id: e.target.value })}>
                    <option value="">— none —</option>
                    {[...venues].sort((a, b) => (a.venue_name || a.venue_id).localeCompare(b.venue_name || b.venue_id)).map((v) => <option key={v.venue_id} value={v.venue_id}>{v.venue_name}{v.city ? `, ${v.city}` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="fgrid">
                <div className="fitem"><label className="flabel">Target count</label><input type="number" value={lpMeta.total_target_count} onChange={(e) => setLpMeta({ ...lpMeta, total_target_count: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">Encountered count <span className="small" style={{ fontWeight: 400 }}>(computed elsewhere)</span></label><input value={lpMeta.encountered_count ?? 0} disabled /></div>
                <div className="fitem"><label className="flabel">Progress % <span className="small" style={{ fontWeight: 400 }}>(computed elsewhere)</span></label><input value={`${lpMeta.progress_percent ?? 0}%`} disabled /></div>
              </div>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="fitem"><label className="flabel">Estimated time (min)</label><input type="number" value={lpMeta.estimated_time_minutes} onChange={(e) => setLpMeta({ ...lpMeta, estimated_time_minutes: e.target.value })} /></div>
                <div className="fitem"><label className="flabel">Shareable</label>
                  <select value={lpMeta.shareable} onChange={(e) => setLpMeta({ ...lpMeta, shareable: e.target.value })}><option value="0">no</option><option value="1">yes</option></select>
                </div>
              </div>
              <div className="fgroup"><label className="flabel">Description</label><textarea rows={3} value={lpMeta.description} onChange={(e) => setLpMeta({ ...lpMeta, description: e.target.value })} style={{ width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eee' }}>
                <button className="btn gold" onClick={saveLPMeta} disabled={lpMetaSaving}>{lpMetaSaving ? 'Saving…' : 'Save changes'}</button>
                <button className="btn ghost" onClick={closeLPMetaEdit}>Cancel</button>
              </div>
            </div>
          )}

          {rowsLoading ? (
            <div className="card small">Loading works…</div>
          ) : (
            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => sortBy('work_id')}>Work ID ↕</th>
                    <th onClick={() => sortBy('__title')}>Title ↕</th>
                    <th onClick={() => sortBy('__type')}>Type ↕</th>
                    <th onClick={() => sortBy('__status')}>Status ↕</th>
                    <th onClick={() => sortBy('catalogue_reference')}>Catalogue Ref ↕</th>
                    <th onClick={() => sortBy('__venue')}>Venue ↕</th>
                    <th onClick={() => sortBy('__dg')}>Display Group ↕</th>
                    <th onClick={() => sortBy('sequence')}>Seq ↕</th>
                    <th onClick={() => sortBy('__enc')}>Encounters ↕</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const venue = r.venue_id ? venueMap[r.venue_id] : null;
                    const dg = r.display_group_id ? dgMap[r.display_group_id] : null;
                    return (
                      <tr key={r.work_id} style={(!r.venue_id || !r.display_group_id) ? { background: '#FFF8F0' } : undefined}>
                        <td className="small">{r.work_id}</td>
                        <td title={r.work_title || ''} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.work_title || <span style={{ color: 'var(--r)', fontWeight: 600 }}>⚠ title not found</span>}</td>
                        <td className="small">{r.work_type || '—'}</td>
                        <td className="small">{r.work_status ? <span style={{ color: 'var(--r)', fontWeight: 600 }}>{r.work_status}</span> : '—'}</td>
                        <td className="small">{r.catalogue_reference || '—'}</td>
                        <td>{venue ? <span className="tag-chip-sm role-digital">{venue.venue_name}</span> : <span style={{ color: 'var(--r)', fontSize: 10, fontWeight: 600 }}>⚠ none</span>}</td>
                        <td>{dg ? <span className="tag-chip-sm role-director">{dg.group_name}</span> : (r.display_group_id ? <span className="tag-chip-sm role-director">{r.display_group_id}</span> : <span className="small">—</span>)}</td>
                        <td className="small">{r.sequence ?? '—'}</td>
                        <td>{r.encounters.length ? <span className="tag-chip-sm role-curator" title={r.encounters.map((e) => e.date || e.encounter_id).join(', ')}>{r.encounters.length}</span> : <span className="tag-chip-sm role-general">0</span>}</td>
                        <td><button className="btn ghost btn-sm" onClick={() => openEdit(r.work_id)}>✎</button></td>
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
