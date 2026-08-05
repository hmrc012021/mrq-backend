import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/Badge';
import type { SignupRequest } from '@/types/database.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type RowState = { budget: string; enforce: boolean; busy: boolean; error: string | null };

export function Signups({
  requests, isAuthed, onRequireAuth, onReload,
}: {
  requests: SignupRequest[];
  isAuthed: boolean;
  onRequireAuth: () => void;
  onReload: () => void;
}) {
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  const pending = requests.filter((r) => r.status !== 'approved');
  const reviewed = requests.filter((r) => r.status === 'approved');

  const getRow = (id: number): RowState => rowState[id] || { budget: '', enforce: false, busy: false, error: null };
  const setRow = (id: number, patch: Partial<RowState>) =>
    setRowState((prev) => ({ ...prev, [id]: { ...getRow(id), ...patch } }));

  async function approve(r: SignupRequest) {
    if (!isAuthed) { onRequireAuth(); return; }
    const row = getRow(r.id);
    setRow(r.id, { busy: true, error: null });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not signed in');

      const budget = row.budget.trim() === '' ? null : Number(row.budget);
      if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
        throw new Error('Token budget must be a positive number');
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/approve-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          signup_request_id: r.id,
          token_budget: budget,
          budget_enforcement_enabled: row.enforce,
        }),
      });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error || `Request failed (${res.status})`);
      onReload();
    } catch (e) {
      setRow(r.id, { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setRow(r.id, { busy: false });
    }
  }

  return (
    <>
      <div className="toolbar"><h2>Signups</h2></div>

      {!pending.length ? (
        <div className="card small">No pending signup requests.</div>
      ) : (
        <div className="contact-grid">
          {pending.map((r) => {
            const row = getRow(r.id);
            return (
              <div className="card" key={r.id}>
                <div className="cc-name">{r.name || r.email}</div>
                <div className="cc-org">{r.email}</div>
                <div className="small">{r.institution || ''}</div>
                {r.motivation && <div className="small" style={{ marginTop: 6 }}>{r.motivation}</div>}
                <div className="form" style={{ marginTop: 10 }}>
                  <label>
                    Token budget (optional)
                    <input
                      type="number"
                      min={0}
                      placeholder="No limit"
                      value={row.budget}
                      onChange={(e) => setRow(r.id, { budget: e.target.value })}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={row.enforce}
                      onChange={(e) => setRow(r.id, { enforce: e.target.checked })}
                    />
                    {' '}Enable budget enforcement now
                  </label>
                </div>
                {row.error && <div className="small" style={{ color: 'var(--r)', marginTop: 6 }}>{row.error}</div>}
                <button
                  className="btn gold"
                  style={{ marginTop: 10 }}
                  disabled={row.busy}
                  onClick={() => approve(r)}
                >
                  {row.busy ? 'Approving…' : isAuthed ? 'Approve' : 'Sign in to approve'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <h2>Reviewed</h2>
      {!reviewed.length ? (
        <div className="card small">No approved signups yet.</div>
      ) : (
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th>Assigned user</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td><Badge value={r.status} /></td>
                  <td>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : '—'}</td>
                  <td>{r.assigned_user_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
