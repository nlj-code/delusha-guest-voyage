-- Server-only access to the push keys stored in private.secrets.
create or replace function public.get_push_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(key, value) from private.secrets where key like 'vapid_%';
$$;
revoke execute on function public.get_push_config from public, anon, authenticated;
grant execute on function public.get_push_config to service_role;

-- Guests can also send a note to the chef.
alter table public.requests drop constraint requests_kind_check;
alter table public.requests add constraint requests_kind_check check (kind in ('laundry', 'issue', 'chef'));
