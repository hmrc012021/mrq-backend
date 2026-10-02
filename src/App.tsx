import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, signOut, signInWithPassword, resetPasswordForEmail, updatePassword } from '@/lib/supabaseClient';
import { useMrqData } from '@/lib/useMrqData';
import { Dashboard } from '@/pages/Dashboard';
import { Actions } from '@/pages/Actions';
import { Deliverables } from '@/pages/Deliverables';
import { Milestones } from '@/pages/Milestones';
import { Decisions } from '@/pages/Decisions';
import { Social } from '@/pages/Social';
import { Crm } from '@/pages/crm/Crm';
import { AiUsage } from '@/pages/AiUsage';
import { Signups } from '@/pages/Signups';
import { KnowledgeAssetAdmin } from '@/pages/admin/KnowledgeAssetAdmin';
import { WorksAdmin } from '@/pages/admin/WorksAdmin';
import { EncounterAdmin } from '@/pages/admin/EncounterAdmin';
import { VenueAdmin } from '@/pages/admin/VenueAdmin';
import { LearningPathAdmin } from '@/pages/admin/LearningPathAdmin';

// Business-facing tabs, plus 2 tabs that are themselves groups of sub-tabs
// (useradmin / admin) -- same flat-array-drives-nav pattern as before, just
// nested one level for the grouped ones. `system`, `reconciliation`, `sources`,
// `intake` were dropped from navigation entirely (2026-08-07) -- investigated
// and confirmed they're not ongoing tools, just a one-time record of the July
// 2026 spreadsheet-to-database migration that built the Actions/Deliverables/CRM
// tables in the first place (since archived out of the public schema -- see migration_archive).
// `training` also dropped (2026-08-07, explicit call) -- not a data/schema
// change, just no nav entry for either; underlying tables untouched.
// Order and labels below are exact, deliberate choices, not alphabetical.
const MAIN_TABS = ['dashboard', 'actionlog', 'crm', 'admin', 'useradmin', 'social'] as const;
type MainTab = (typeof MAIN_TABS)[number];

// Actions/Deliverables/Milestones/Decisions are all the same kind of thing --
// a work/action log -- grouped so they don't each take a main-bar slot.
const ACTIONLOG_TABS = ['actions', 'deliverables', 'milestones', 'decisions'] as const;
type ActionLogTab = (typeof ACTIONLOG_TABS)[number];

// Signups + AI Usage: confirmed as real, useful tools -- grouped together
// under a name that reflects what they actually do (manage user access +
// track user activity), separate from the still-undecided ops tools above.
const USERADMIN_TABS = ['signups', 'aiusage'] as const;
type UserAdminTab = (typeof USERADMIN_TABS)[number];

// Content/master-data editors -- Works, Venues, Work URLs, Knowledge Assets,
// Encounters, Learning Paths. None of these are built yet (they exist only
// as standalone legacy HTML tools that were never ported into this app) --
// each shows a placeholder until its own port lands as separate follow-up work.
const ADMIN_TABS = ['workurls', 'venues', 'encounters', 'knowledgeassets', 'learningpaths', 'works'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const LABELS: Record<string, string> = {
  dashboard: 'CEO Dashboard',
  actionlog: 'Action Log',
  crm: 'Stakeholders',
  admin: 'Database Admin',
  useradmin: 'User Admin',
  social: 'Social Media',
  aiusage: 'AI Usage',
  workurls: 'Work URLs',
  knowledgeassets: 'Knowledge Assets',
  learningpaths: 'Learning Paths',
};

function label(t: string): string {
  if (LABELS[t]) return LABELS[t];
  return t[0].toUpperCase() + t.slice(1);
}

const ADMIN_SOURCE_FILE: Record<AdminTab, string> = {
  workurls: 'mrq_url_audit.html',
  venues: 'mrq_venue_admin_v2.html',
  encounters: 'mrq_encounter_admin_v14.html',
  knowledgeassets: 'mrq_knowledge_admin_v24.html',
  learningpaths: 'mrq_lp_admin_v7.html',
  works: 'mrq_works_admin_v32.html',
};

function AdminPlaceholder({ tab }: { tab: AdminTab }) {
  return (
    <div className="card small">
      Not yet ported — see task tracker. Legacy source: <code>{ADMIN_SOURCE_FILE[tab]}</code>
    </div>
  );
}

// Forced at the start (2026-08-07) -- there is exactly one account in this
// project, so "read-only for anonymous visitors" protected nothing and just
// meant every page carried its own isAuthed/onRequireAuth plumbing. Gate once,
// here, before anything else mounts; every call made after this point already
// has a real session. Error shown inline, not via alert() -- a blocking native
// popup is exactly what browsers/extensions silently suppress after repeated
// triggers, which is indistinguishable from "nothing happened at all".
function LoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(emailRef.current?.value || '', pwRef.current?.value || '');
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    const email = emailRef.current?.value || '';
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?"');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPasswordForEmail(email);
      setError('Password reset email sent — check your inbox.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--p)' }}>
      <div className="card" style={{ width: 340 }}>
        <div className="brand" style={{ marginBottom: 4 }}>My<em>Raphael</em>Quest</div>
        <div className="small" style={{ marginBottom: 14 }}>CEO Dashboard</div>
        <p><input ref={emailRef} type="email" placeholder="Email" style={{ width: '100%' }} onKeyDown={(e) => e.key === 'Enter' && signIn()} /></p>
        <p><input ref={pwRef} type="password" placeholder="Password" style={{ width: '100%' }} onKeyDown={(e) => e.key === 'Enter' && signIn()} /></p>
        {error && <p style={{ color: 'var(--r)', fontSize: 13, fontWeight: 600 }}>{error}</p>}
        <button className="btn gold" onClick={signIn} disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Login'}</button>
        <p style={{ textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); forgotPassword(); }} style={{ fontSize: 12, color: 'var(--n)' }}>Forgot password?</a>
        </p>
      </div>
    </div>
  );
}

function SetPasswordGate({ onDone }: { onDone: () => void }) {
  const pwRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const password = pwRef.current?.value || '';
    const confirm = confirmRef.current?.value || '';
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--p)' }}>
      <div className="card" style={{ width: 340 }}>
        <div className="brand" style={{ marginBottom: 4 }}>My<em>Raphael</em>Quest</div>
        <div className="small" style={{ marginBottom: 14 }}>Set a new password</div>
        <p><input ref={pwRef} type="password" placeholder="New password (min. 8 characters)" style={{ width: '100%' }} onKeyDown={(e) => e.key === 'Enter' && submit()} /></p>
        <p><input ref={confirmRef} type="password" placeholder="Confirm password" style={{ width: '100%' }} onKeyDown={(e) => e.key === 'Enter' && submit()} /></p>
        {error && <p style={{ color: 'var(--r)', fontSize: 13, fontWeight: 600 }}>{error}</p>}
        <button className="btn gold" onClick={submit} disabled={busy} style={{ width: '100%' }}>{busy ? 'Setting password…' : 'Set password & continue'}</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<MainTab>('dashboard');
  const [actionLogTab, setActionLogTab] = useState<ActionLogTab>('actions');
  const [userAdminTab, setUserAdminTab] = useState<UserAdminTab>('signups');
  const [adminTab, setAdminTab] = useState<AdminTab>('workurls');
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const { data, loading, error, reload } = useMrqData();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAuthed = Boolean(session);
  const isFull = tab === 'crm';

  let statusText = 'Connecting…';
  if (error) statusText = 'Load failed: ' + error;
  else if (!loading) statusText = `Live · ${data.actions.length} actions · ${data.contacts.length} stakeholders · ${data.interactions.length} interactions`;

  if (session === undefined) return <div className="card small" style={{ margin: 40 }}>Loading…</div>;
  if (recovery) return <SetPasswordGate onDone={() => setRecovery(false)} />;
  if (!isAuthed) return <LoginGate onSignedIn={() => {}} />;
  const reqAuth = () => {}; // no-op: past the gate, every render already has a real session

  return (
    <>
      <header>
        <div className="brand">MRQ</div>
        <nav>
          {MAIN_TABS.map((t) => (
            <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
              {label(t)}
            </button>
          ))}
        </nav>
        <span>{session?.user.email}</span>
        <button className="btn gold" onClick={signOut}>Logout</button>
      </header>
      <div className="status">{statusText}</div>
      <main className={isFull ? 'full' : ''}>
        {loading ? (
          <div className="card small">Loading…</div>
        ) : tab === 'dashboard' ? (
          <Dashboard actions={data.actions} interactions={data.interactions} contacts={data.contacts} />
        ) : tab === 'crm' ? (
          <Crm
            contacts={data.contacts}
            interactions={data.interactions}
            notes={data.notes}
            venues={data.venues}
            isAuthed={isAuthed}
            onRequireAuth={reqAuth}
            onReload={reload}
          />
        ) : tab === 'actionlog' ? (
          <>
            <nav className="subnav">
              {ACTIONLOG_TABS.map((t) => (
                <button key={t} className={t === actionLogTab ? 'active' : ''} onClick={() => setActionLogTab(t)}>
                  {label(t)}
                </button>
              ))}
            </nav>
            {actionLogTab === 'actions' ? (
              <Actions rows={data.actions} isAuthed={isAuthed} onRequireAuth={reqAuth} onReload={reload} />
            ) : actionLogTab === 'deliverables' ? (
              <Deliverables rows={data.deliverables} isAuthed={isAuthed} onRequireAuth={reqAuth} onReload={reload} />
            ) : actionLogTab === 'milestones' ? (
              <Milestones rows={data.milestones} isAuthed={isAuthed} onRequireAuth={reqAuth} onReload={reload} />
            ) : (
              <Decisions rows={data.decisions} isAuthed={isAuthed} onRequireAuth={reqAuth} onReload={reload} />
            )}
          </>
        ) : tab === 'social' ? (
          <Social rows={data.social} isAuthed={isAuthed} onRequireAuth={reqAuth} onReload={reload} />
        ) : tab === 'useradmin' ? (
          <>
            <nav className="subnav">
              {USERADMIN_TABS.map((t) => (
                <button key={t} className={t === userAdminTab ? 'active' : ''} onClick={() => setUserAdminTab(t)}>
                  {label(t)}
                </button>
              ))}
            </nav>
            {userAdminTab === 'signups' ? (
              <Signups requests={data.signupRequests} isAuthed={isAuthed} onRequireAuth={reqAuth} onReload={reload} />
            ) : (
              <AiUsage outputs={data.guidanceOutputs} profiles={data.userProfiles} />
            )}
          </>
        ) : (
          <>
            <nav className="subnav">
              {ADMIN_TABS.map((t) => (
                <button key={t} className={t === adminTab ? 'active' : ''} onClick={() => setAdminTab(t)}>
                  {label(t)}
                </button>
              ))}
            </nav>
            {adminTab === 'knowledgeassets' ? <KnowledgeAssetAdmin /> : adminTab === 'works' ? <WorksAdmin /> : adminTab === 'encounters' ? <EncounterAdmin /> : adminTab === 'venues' ? <VenueAdmin /> : adminTab === 'learningpaths' ? <LearningPathAdmin /> : <AdminPlaceholder tab={adminTab} />}
          </>
        )}
      </main>
    </>
  );
}
