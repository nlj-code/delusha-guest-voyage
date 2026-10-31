// Sends phone notifications.
//  - alert: a host's alert goes to everyone on the trip.
//  - request: a new laundry or cabin request goes to the crew (hosts if no crew account exists).
//  - request_status: the crew updated a request, so the person who asked is told.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders, json } from './http.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

type Payload = { title: string; body: string; url: string; tag: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { type, id } = await req.json().catch(() => ({}));
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false }
    });
    const { data: who } = await caller.auth.getUser();
    const callerId = who?.user?.id;
    if (!callerId) return json({ error: 'Please sign in again.' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: me } = await admin.from('staff').select('role').eq('user_id', callerId).maybeSingle();

    let recipients: string[] = [];
    let payload: Payload;

    if (type === 'alert') {
      if (me?.role !== 'host') return json({ error: 'Only hosts send alerts.' }, 403);
      const { data: alert } = await admin.from('alerts').select('*').eq('id', id).maybeSingle();
      if (!alert) return json({ error: 'Alert not found' }, 404);
      const { data: guests } = await admin.from('guests').select('user_id').eq('trip_id', alert.trip_id);
      recipients = (guests ?? []).map((g) => g.user_id).filter(Boolean);
      payload = { title: alert.title, body: alert.body ?? '', url: './#/alerts', tag: `alert-${alert.id}` };
    } else if (type === 'request') {
      const { data: r } = await admin.from('requests').select('*').eq('id', id).maybeSingle();
      if (!r || r.created_by !== callerId) return json({ error: 'Request not found' }, 404);
      const { data: crew } = await admin.from('staff').select('user_id, role');
      const crewIds = (crew ?? []).filter((s) => s.role === 'crew' && s.user_id).map((s) => s.user_id);
      const hostIds = (crew ?? []).filter((s) => s.role === 'host' && s.user_id).map((s) => s.user_id);
      recipients = crewIds.length ? crewIds : hostIds;
      const what = r.kind === 'laundry'
        ? (r.services?.length ? r.services.join(', ') : 'Laundry')
        : r.kind === 'chef'
        ? 'Note for the chef'
        : `Cabin issue: ${r.issue_type ?? 'Other'}`;
      const who2 = [r.requester_name, r.cabin].filter(Boolean).join(' · ');
      payload = {
        title: `${r.urgent ? 'URGENT · ' : ''}${what}`,
        body: [who2, r.note].filter(Boolean).join(' — '),
        url: './#/crew',
        tag: `request-${r.id}`
      };
    } else if (type === 'request_status') {
      if (!me) return json({ error: 'Only crew update requests.' }, 403);
      const { data: r } = await admin.from('requests').select('*').eq('id', id).maybeSingle();
      if (!r) return json({ error: 'Request not found' }, 404);
      recipients = r.created_by ? [r.created_by] : [];
      const what = r.kind === 'laundry' ? 'Your laundry request' : r.kind === 'chef' ? 'Your note to the chef' : 'Your cabin issue';
      const status = r.status === 'done' ? 'is done' : r.status === 'in_progress' ? 'is being handled' : 'was received';
      payload = { title: `${what} ${status}`, body: r.note ?? '', url: './#/requests', tag: `request-${r.id}` };
    } else {
      return json({ error: 'Unknown type' }, 400);
    }

    recipients = [...new Set(recipients)].filter((u) => u !== callerId);
    if (!recipients.length) return json({ sent: 0 });

    const { data: cfg } = await admin.rpc('get_push_config');
    if (!cfg?.vapid_public || !cfg?.vapid_private) return json({ error: 'Push is not configured' }, 500);
    webpush.setVapidDetails(cfg.vapid_subject ?? 'mailto:admin@sydelusha.app', cfg.vapid_public, cfg.vapid_private);

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', recipients);

    let sent = 0;
    const gone: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 6 }
          );
          sent++;
        } catch (e) {
          // deno-lint-ignore no-explicit-any
          const code = (e as any)?.statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint);
        }
      })
    );
    if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone);

    return json({ sent, recipients: recipients.length });
  } catch (_e) {
    return json({ error: 'Something went wrong.' }, 500);
  }
});
