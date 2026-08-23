import { supabase } from './supabaseClient';

const EDGE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mrq-api`;

export class MrqApiError extends Error {}

// Same call shape Signups.tsx already used inline (get the session token, POST
// to the edge function) -- pulled out here since the admin ports need it repeatedly.
export async function callMrqApi(action: string, body: Record<string, unknown> = {}): Promise<any> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new MrqApiError('Not signed in');

  const res = await fetch(`${EDGE}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new MrqApiError(json.error || `Request failed (${res.status})`);
  return json;
}
