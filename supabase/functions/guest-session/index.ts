// Exchanges a guest's personal invite token for a signed-in session.
// Each guest gets their own hidden account the first time they open their link.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from './http.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== 'string' || !/^[a-f0-9]{24,64}$/.test(token)) {
      return json({ error: 'This invite link is not valid.' }, 400);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: invite } = await admin
      .from('guest_invites')
      .select('guest_id, guests(id, name, trip_id, user_id)')
      .eq('token', token)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const guest = (invite as any)?.guests;
    if (!guest) return json({ error: 'This invite link is not valid any more. Ask your host for a new one.' }, 404);

    const password = randomPassword();
    let userId: string | null = guest.user_id;
    let email = `guest-${guest.id}@guests.sydelusha.app`;

    if (userId) {
      const { data: staffRow } = await admin.from('staff').select('id').eq('user_id', userId).maybeSingle();
      if (staffRow) {
        return json({ error: 'This link is linked to a host or crew account. Please sign in with your email instead.', staff: true }, 409);
      }
      const { data, error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error || !data?.user) {
        userId = null;
      } else {
        email = data.user.email ?? email;
      }
    }

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: guest.name, guest_id: guest.id }
      });
      if (error || !data?.user) {
        return json({ error: 'Could not set up your access. Please try again.' }, 500);
      }
      userId = data.user.id;
      const { error: linkError } = await admin.from('guests').update({ user_id: userId }).eq('id', guest.id);
      if (linkError) return json({ error: 'Could not link your access. Please try again.' }, 500);
    }

    const pub = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: signIn, error: signInError } = await pub.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) return json({ error: 'Could not sign you in. Please try again.' }, 500);

    return json({
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token
      },
      guest: { id: guest.id, name: guest.name, trip_id: guest.trip_id }
    });
  } catch (_e) {
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
