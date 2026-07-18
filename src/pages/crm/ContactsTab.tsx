import { useMemo, useState } from 'react';
import { roleClass } from '@/lib/crmFields';
import { fmtLabel, contactDisplayName } from '@/lib/format';
import type { CrmContact, Venue } from '@/types/database.types';

type FilterField = 'role' | 'completion' | 'orgType' | 'country' | 'city' | 'campaign' | 'instRole' | 'outreachStatus' | 'venue';

interface FilterDef {
  label: string;
  type: 'opts' | 'dynamic' | 'dynamicTags' | 'venue';
  opts?: string[];
  getter?: (c: CrmContact) => unknown;
  test: (c: CrmContact, v: string) => boolean;
}

function filterableFields(): Record<FilterField, FilterDef> {
  return {
    role: { label: 'Role', type: 'opts', opts: ['buyer', 'validator', 'collaborator', 'amplifier', 'access_node', 'introducer'], test: (c, v) => c.stakeholder_role_primary === v || c.stakeholder_role_secondary === v },
    completion: { label: 'Completion', type: 'opts', opts: ['complete', 'partial', 'placeholder', 'not_started'], test: (c, v) => c.completion_status === v },
    orgType: { label: 'Org Type', type: 'dynamic', getter: (c) => c.organization_type, test: (c, v) => c.organization_type === v },
    country: { label: 'Country', type: 'dynamic', getter: (c) => c.country, test: (c, v) => c.country === v },
    city: { label: 'City', type: 'dynamic', getter: (c) => c.city, test: (c, v) => c.city === v },
    campaign: { label: 'Campaign', type: 'dynamicTags', getter: (c) => c.campaigns, test: (c, v) => Array.isArray(c.campaigns) && c.campaigns.includes(v) },
    instRole: { label: 'Institution Role', type: 'opts', opts: ['general', 'director', 'curator', 'digital', 'access', 'gatekeeper'], test: (c, v) => Array.isArray(c.institution_role) && c.institution_role.includes(v) },
    outreachStatus: { label: 'Outreach Status', type: 'opts', opts: ['not_started', 'drafted', 'sent', 'replied', 'replied_followup_due', 'waiting_for_me', 'waiting_for_them', 'reengage_for_call', 'meeting_scheduled', 'on_hold', 'no_response', 'closed'], test: (c, v) => c.outreach_status === v },
    venue: { label: 'Venue', type: 'venue', getter: (c) => c.venue_id, test: (c, v) => c.venue_id === v },
  };
}

const PRI_BG: Record<string, string> = { P0: '#F9E0DE', P1: '#FFF3CD', P2: '#F0EEEC', P3: '#E8E8E8' };

export function ContactsTab({
  contacts, venues, onSelectContact,
}: {
  contacts: CrmContact[];
  venues: Venue[];
  onSelectContact: (id: string) => void;
}) {
  const FF = useMemo(filterableFields, []);
  const [search, setSearch] = useState('');
  const [fPri, setFPri] = useState('all');
  const [fField, setFField] = useState<FilterField | 'none'>('none');
  const [fValue, setFValue] = useState('all');
  const [activeFilters, setActiveFilters] = useState<{ field: FilterField; value: string }[]>([]);
  const [sortBy, setSortBy] = useState<'last_name' | 'name' | 'organization_name' | 'priority_level' | 'completion_status' | 'country' | 'date_added'>('last_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function venueLabel(venueId: string) {
    const v = venues.find((v) => v.venue_id === venueId);
    if (!v) return venueId;
    return `${v.venue_name}${v.city ? `, ${v.city}` : ''} (${v.venue_id})`;
  }

  const filtered = useMemo(() => {
    let list = contacts.filter((c) => {
      if (search) {
        const hay = [c.first_name, c.last_name, c.organization_name, c.title, c.city, c.why_this_matters].map((x) => (x || '').toLowerCase()).join(' ');
        if (!hay.includes(search.toLowerCase())) return false;
      }
      if (fPri !== 'all' && c.priority_level !== fPri) return false;
      for (const af of activeFilters) {
        if (!FF[af.field].test(c, af.value)) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av: string, bv: string;
      if (sortBy === 'name') { av = contactDisplayName(a).toLowerCase(); bv = contactDisplayName(b).toLowerCase(); }
      else { av = String(a[sortBy] || '').toLowerCase(); bv = String(b[sortBy] || '').toLowerCase(); }
      if (av === '' && bv !== '') return 1;
      if (bv === '' && av !== '') return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [contacts, search, fPri, activeFilters, sortBy, sortDir, FF]);

  const scopedContacts = useMemo(
    () => contacts.filter((c) => activeFilters.every((af) => FF[af.field].test(c, af.value))),
    [contacts, activeFilters, FF]
  );

  let valueOptions: string[] = [];
  if (fField !== 'none') {
    const fdef = FF[fField];
    if (fdef.type === 'opts') valueOptions = fdef.opts!;
    else if (fdef.type === 'dynamic') valueOptions = [...new Set(scopedContacts.map((c) => fdef.getter!(c) as string).filter(Boolean))].sort();
    else if (fdef.type === 'dynamicTags') valueOptions = [...new Set(scopedContacts.flatMap((c) => (Array.isArray(fdef.getter!(c)) ? (fdef.getter!(c) as string[]) : [])))].sort();
    else if (fdef.type === 'venue') valueOptions = [...new Set(scopedContacts.map((c) => fdef.getter!(c) as string).filter(Boolean))].sort();
  }

  function addFilter(v: string) {
    if (v === 'all' || fField === 'none') { setFValue('all'); return; }
    setActiveFilters((prev) => [...prev.filter((f) => f.field !== fField), { field: fField, value: v }]);
    setFField('none');
    setFValue('all');
  }

  const filtersActive = Boolean(search) || fPri !== 'all' || activeFilters.length > 0;

  return (
    <div className="list-search">
      <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="filter-row">
        {(['all', 'P0', 'P1', 'P2', 'P3'] as const).map((p) => (
          <button
            key={p}
            className={`pri-btn${fPri === p ? ' active' : ''}`}
            style={{ background: p === 'all' ? '#fff' : PRI_BG[p] }}
            onClick={() => setFPri(p)}
          >
            {p === 'all' ? 'All' : p}
          </button>
        ))}
        <select className="role-filter" value={fField} onChange={(e) => { setFField(e.target.value as FilterField | 'none'); setFValue('all'); }}>
          <option value="none">Filter by…</option>
          {(Object.entries(FF) as [FilterField, FilterDef][]).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
        </select>
        {fField !== 'none' && (
          <select className="role-filter" value={fValue} onChange={(e) => addFilter(e.target.value)}>
            <option value="all">Any {FF[fField].label}</option>
            {valueOptions.map((v) => (
              <option key={v} value={v}>{fField === 'venue' ? venueLabel(v) : fmtLabel(v)}</option>
            ))}
          </select>
        )}
      </div>
      {activeFilters.length > 0 && (
        <div className="filter-row" style={{ marginTop: 6 }}>
          {activeFilters.map((af) => (
            <span className="filter-chip" key={af.field}>
              {FF[af.field].label}: {af.field === 'venue' ? venueLabel(af.value) : fmtLabel(af.value)}{' '}
              <button onClick={() => setActiveFilters((prev) => prev.filter((f) => f.field !== af.field))}>&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="sort-row">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="last_name">Sort: Last Name</option>
          <option value="name">Sort: Full Name</option>
          <option value="organization_name">Sort: Organization</option>
          <option value="priority_level">Sort: Priority</option>
          <option value="completion_status">Sort: Completion</option>
          <option value="country">Sort: Country</option>
          <option value="date_added">Sort: Date Added</option>
        </select>
        <button className="sort-dir-btn" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          {sortDir === 'asc' ? '↑ A–Z' : '↓ Z–A'}
        </button>
      </div>
      <div className="result-count">
        {filtered.length} of {contacts.length} contacts
        {filtersActive && (
          <>
            {' · '}
            <button className="clear-filters" onClick={() => { setSearch(''); setFPri('all'); setFField('none'); setFValue('all'); setActiveFilters([]); }}>
              clear filters
            </button>
          </>
        )}
      </div>
      <div className="contact-grid">
        {filtered.length === 0 ? (
          <div className="small" style={{ padding: 30 }}>No contacts match</div>
        ) : (
          filtered.map((c) => (
            <div className="contact-card" key={c.contact_id} onClick={() => onSelectContact(c.contact_id)}>
              <span className="cc-name">{contactDisplayName(c)}</span>
              <span className="cc-org">{c.organization_name || ''}</span>
              <span className="cc-inst-role">
                {Array.isArray(c.institution_role) && c.institution_role.map((r) => (
                  <span key={r} className={`tag-chip-sm ${roleClass(r)}`}>{fmtLabel(r)}</span>
                ))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
