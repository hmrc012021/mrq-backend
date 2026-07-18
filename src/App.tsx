import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, signOut } from '@/lib/supabaseClient';
import { useMrqData } from '@/lib/useMrqData';
import { AuthModal } from '@/components/AuthModal';
import { Dashboard } from '@/pages/Dashboard';
import { Actions } from '@/pages/Actions';
import { Deliverables } from '@/pages/Deliverables';
import { Milestones } from '@/pages/Milestones';
import { Decisions } from '@/pages/Decisions';
import { Reconciliation } from '@/pages/Reconciliation';
import { Intake } from '@/pages/Intake';
import { Sources } from '@/pages/Sources';
import { Social } from '@/pages/Social';
import { Training } from '@/pages/Training';
import { System } from '@/pages/System';
import { Crm } from '@/pages/crm/Crm';

const TABS = ['dashboard', 'crm', 'actions', 'deliverables', 'milestones', 'decisions', 'reconciliation', 'intake', 'sources', 'social', 'training', 'system'] as const;
type Tab = (typeof TABS)[number];

function tabLabel(t: Tab): string {
  if (t === 'crm') return 'CRM / Stakeholders';
  return t[0].toUpperCase() + t.slice(1);
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const { data, loading, error, reload } = useMrqData();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAuthed = Boolean(session);
  const isFull = tab === 'crm';

  let statusText = 'Connecting…';
  if (error) statusText = 'Load failed: ' + error;
  else if (!loading) statusText = `Live · ${data.actions.length} actions · ${data.contacts.length} stakeholders · ${data.interactions.length} interactions`;

  return (
    <>
      <header>
        <div className="brand">MRQ</div>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
              {tabLabel(t)}
            </button>
          ))}
        </nav>
        <span>{isAuthed ? session?.user.email : 'Read only'}</span>
        <button
          className="btn gold"
          onClick={() => {
            if (isAuthed) { signOut(); } else { setAuthOpen(true); }
          }}
        >
          {isAuthed ? 'Logout' : 'Login'}
        </button>
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
            onRequireAuth={() => setAuthOpen(true)}
            onReload={reload}
          />
        ) : tab === 'actions' ? (
          <Actions rows={data.actions} isAuthed={isAuthed} onRequireAuth={() => setAuthOpen(true)} onReload={reload} />
        ) : tab === 'deliverables' ? (
          <Deliverables rows={data.deliverables} isAuthed={isAuthed} onRequireAuth={() => setAuthOpen(true)} onReload={reload} />
        ) : tab === 'milestones' ? (
          <Milestones rows={data.milestones} isAuthed={isAuthed} onRequireAuth={() => setAuthOpen(true)} onReload={reload} />
        ) : tab === 'decisions' ? (
          <Decisions rows={data.decisions} isAuthed={isAuthed} onRequireAuth={() => setAuthOpen(true)} onReload={reload} />
        ) : tab === 'reconciliation' ? (
          <Reconciliation rows={data.reconciliation} />
        ) : tab === 'intake' ? (
          <Intake rows={data.raw} />
        ) : tab === 'sources' ? (
          <Sources sources={data.sources} rules={data.rules} />
        ) : tab === 'social' ? (
          <Social rows={data.social} isAuthed={isAuthed} onRequireAuth={() => setAuthOpen(true)} onReload={reload} />
        ) : tab === 'training' ? (
          <Training rows={data.training} isAuthed={isAuthed} onRequireAuth={() => setAuthOpen(true)} onReload={reload} />
        ) : (
          <System data={data} authed={isAuthed} />
        )}
      </main>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSignedIn={() => setAuthOpen(false)} />
    </>
  );
}
