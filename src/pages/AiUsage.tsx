import { Badge } from '@/components/Badge';
import type { GuidanceOutput, UserProfile } from '@/types/database.types';

const TREND_DAYS = 14;

function dayKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.length >= 10 ? iso.slice(0, 10) : null;
}

function dayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function lastNDayKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function AiUsage({ outputs, profiles }: { outputs: GuidanceOutput[]; profiles: UserProfile[] }) {
  const nameByAuthUid = new Map(profiles.map((p) => [p.auth_uid, p.display_name || p.user_id]));
  const profileByAuthUid = new Map(profiles.map((p) => [p.auth_uid, p]));
  const labelFor = (userId: string | null) => (userId ? nameByAuthUid.get(userId) || userId : 'Unknown');

  const generations = outputs.filter((o) => o.output_type !== 'blocked');
  const blocked = outputs.filter((o) => o.output_type === 'blocked');

  const totalTokens = generations.reduce((sum, o) => sum + (o.tokens_used || 0), 0);
  const totalCost = generations.reduce((sum, o) => sum + (o.cost_estimate || 0), 0);

  const days = lastNDayKeys(TREND_DAYS);
  const daySet = new Set(days);

  // user_id -> day -> tokens
  const perUserDay = new Map<string, Map<string, number>>();
  const totalByUser = new Map<string, number>();
  for (const o of generations) {
    if (!o.user_id) continue;
    const key = dayKey(o.created_at);
    if (!key || !daySet.has(key)) continue;
    if (!perUserDay.has(o.user_id)) perUserDay.set(o.user_id, new Map());
    const dayMap = perUserDay.get(o.user_id)!;
    dayMap.set(key, (dayMap.get(key) || 0) + (o.tokens_used || 0));
    totalByUser.set(o.user_id, (totalByUser.get(o.user_id) || 0) + (o.tokens_used || 0));
  }

  const userIds = [...perUserDay.keys()].sort((a, b) => (totalByUser.get(b) || 0) - (totalByUser.get(a) || 0));
  const maxCell = Math.max(1, ...userIds.flatMap((u) => [...perUserDay.get(u)!.values()]));

  return (
    <>
      <div className="toolbar"><h2>AI Usage</h2></div>

      <div className="grid cols-3">
        <div className="card">
          <div className="label">Total tokens</div>
          <div className="metric">{totalTokens.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="label">Est. cost</div>
          <div className="metric">{fmtCost(totalCost)}</div>
        </div>
        <div className="card">
          <div className="label">Generations</div>
          <div className="metric">{generations.length}</div>
        </div>
      </div>

      <h2>Blocked calls needing review</h2>
      {blocked.length === 0 ? (
        <div className="card small">No blocked calls — nothing to review.</div>
      ) : (
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Work</th>
                <th>Persona / angle</th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((o) => (
                <tr key={o.output_id}>
                  <td><Badge value="blocked" /> {o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                  <td>{labelFor(o.user_id)}</td>
                  <td>{o.work_id || '—'}</td>
                  <td>{[o.persona, o.dna_angle].filter(Boolean).join(' / ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Daily usage per user (tokens, last {TREND_DAYS} days)</h2>
      {userIds.length === 0 ? (
        <div className="card small">No usage recorded yet.</div>
      ) : (
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Budget</th>
                {days.map((d) => <th key={d}>{dayLabel(d)}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {userIds.map((uid) => {
                const profile = profileByAuthUid.get(uid);
                const dayMap = perUserDay.get(uid)!;
                return (
                  <tr key={uid}>
                    <td>{labelFor(uid)}</td>
                    <td>
                      {profile?.budget_enforcement_enabled
                        ? <Badge value={`enforced · ${profile.token_budget ?? '—'}`} />
                        : <span className="small">off</span>}
                    </td>
                    {days.map((d) => {
                      const v = dayMap.get(d) || 0;
                      const alpha = v ? Math.max(0.12, v / maxCell) : 0;
                      return (
                        <td
                          key={d}
                          className="usage-cell"
                          style={v ? { backgroundColor: `rgba(30,39,97,${alpha})`, color: alpha > 0.5 ? '#fff' : undefined } : undefined}
                        >
                          {v || ''}
                        </td>
                      );
                    })}
                    <td><strong>{(totalByUser.get(uid) || 0).toLocaleString()}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
