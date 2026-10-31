// Host and crew accounts.
//  - claim: someone a host has added to the team sets their own password the first time.
//  - reset: a host sets a new password for a team member.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from './http.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8) return json({ error: 'Passwords need at least 8 characters.' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    if (action === 'claim') {
      const email = String(body.email || '').trim().toLowerCase();
      const { data: staff } = await admin.from('staff').select('id, name, user_id').eq('email', email).maybeSingle();
      if (!staff) return json({ error: 'This email is not on the Delusha team list. Ask a host to add you.' }, 404);
      if (staff.user_id) return json({ error: 'This account is already set up. Sign in with your password.' }, 409);

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: staff.name }
      });
      if (error || !data?.user) return json({ error: 'Could not create the account. Ask a host for help.' }, 500);

      const { error: linkError } = await admin.from('staff').update({ user_id: data.user.id }).eq('id', staff.id);
      if (linkError) return json({ error: 'Could not link the account. Ask a host for help.' }, 500);
      return json({ ok: true });
    }

    if (action === 'reset') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const caller = createClient(url, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      });
      const { data: who } = await caller.auth.getUser();
      if (!who?.user) return json({ error: 'Please sign in again.' }, 401);

      const { data: me } = await admin.from('staff').select('role').eq('user_id', who.user.id).maybeSingle();
      if (me?.role !== 'host') return json({ error: 'Only hosts can reset passwords.' }, 403);

      const { data: target } = await admin.from('staff').select('user_id, email, name').eq('id', body.staff_id).maybeSingle();
      if (!target) return json({ error: 'Team member not found.' }, 404);

      if (target.user_id) {
        const { error } = await admin.auth.admin.updateUserById(target.user_id, { password });
        if (error) return json({ error: 'Could not reset the password.' }, 500);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: target.email,
          password,
          email_confirm: true,
          user_metadata: { name: target.name }
        });
        if (error || !data?.user) return json({ error: 'Could not create the account.' }, 500);
        await admin.from('staff').update({ user_id: data.user.id }).eq('id', body.staff_id);
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (_e) {
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
