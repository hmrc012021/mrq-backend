import { useRef } from 'react';
import { signInWithPassword } from '@/lib/supabaseClient';

export function AuthModal({ open, onClose, onSignedIn }: { open: boolean; onClose: () => void; onSignedIn: () => void }) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  if (dlgRef.current) {
    if (open && !dlgRef.current.open) dlgRef.current.showModal();
    if (!open && dlgRef.current.open) dlgRef.current.close();
  }

  async function signIn() {
    const email = emailRef.current?.value || '';
    const password = pwRef.current?.value || '';
    try {
      await signInWithPassword(email, password);
      onSignedIn();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <dialog ref={dlgRef} onClose={onClose}>
      <h2>Supabase Login</h2>
      <p><input ref={emailRef} type="email" placeholder="Email" /></p>
      <p><input ref={pwRef} type="password" placeholder="Password" /></p>
      <p>
        <button className="btn ghost" onClick={onClose}>Cancel</button>{' '}
        <button className="btn gold" onClick={signIn}>Login</button>
      </p>
    </dialog>
  );
}
