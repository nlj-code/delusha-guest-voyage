-- SY Delusha Guest App · initial schema
-- Roles: hosts and crew (table staff, email + password login), guests (one login per invite link).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.secrets (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------- tables

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique check (email = lower(email)),
  name text not null,
  role text not null check (role in ('host', 'crew')),
  title text,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  allow_corinth boolean not null default false,
  current_stop_id uuid,
  created_at timestamptz not null default now()
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  seq int not null,
  port_id text,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  arrive_on date,
  tender_name text,
  tender_lat double precision,
  tender_lon double precision,
  created_at timestamptz not null default now()
);
create index stops_trip_idx on public.stops (trip_id, seq);

alter table public.trips
  add constraint trips_current_stop_fk foreign key (current_stop_id)
  references public.stops (id) on delete set null;
create index trips_current_stop_idx on public.trips (current_stop_id);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  cabin text check (cabin in ('Master', 'Port VIP', 'Starboard VIP', 'Twin')),
  is_host boolean not null default false,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index guests_trip_idx on public.guests (trip_id);
create index guests_user_idx on public.guests (user_id);

-- Invite tokens live apart from guests so co-guests can never read them.
create table public.guest_invites (
  guest_id uuid primary key references public.guests (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);

create table public.preferences (
  guest_id uuid primary key references public.guests (id) on delete cascade,
  diet text[] not null default '{}',
  allergies text,
  allergy_severity text check (allergy_severity in ('Mild', 'Moderate', 'Severe')),
  drinks text,
  pillow text check (pillow in ('Soft', 'Medium', 'Firm')),
  cabin_temp text check (cabin_temp in ('Cool', 'Medium', 'Warm')),
  seasickness text check (seasickness in ('Never', 'Sometimes', 'Often')),
  health_notes text,
  special_requests text,
  food_done boolean not null default false,
  cabin_done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  plan_date date not null,
  headline text,
  subline text,
  schedule jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (trip_id, plan_date)
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  menu_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
  served_at text,
  location text,
  note text,
  courses jsonb not null default '[]'::jsonb,
  author_name text,
  updated_at timestamptz not null default now(),
  unique (trip_id, menu_date, meal)
);

create table public.safety_sections (
  id uuid primary key default gen_random_uuid(),
  seq int not null,
  title text not null,
  body text not null
);

create table public.safety_acks (
  guest_id uuid not null references public.guests (id) on delete cascade,
  section_id uuid not null references public.safety_sections (id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (guest_id, section_id)
);
create index safety_acks_section_idx on public.safety_acks (section_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  body text,
  sender_name text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index alerts_trip_idx on public.alerts (trip_id, created_at desc);
create index alerts_created_by_idx on public.alerts (created_by);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null,
  requester_name text,
  cabin text,
  kind text not null check (kind in ('laundry', 'issue')),
  services text[] not null default '{}',
  back_by text,
  issue_type text,
  note text,
  urgent boolean not null default false,
  photo_path text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  captain_told boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_trip_idx on public.requests (trip_id, created_at desc);
create index requests_created_by_idx on public.requests (created_by);
create index requests_guest_idx on public.requests (guest_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  stop_id uuid references public.stops (id) on delete set null,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  uploader_name text,
  kind text not null check (kind in ('photo', 'video')),
  path text not null,
  thumb_path text,
  width int,
  height int,
  duration_s numeric,
  size_bytes bigint,
  lat double precision,
  lon double precision,
  taken_at timestamptz,
  on_tv boolean not null default true,
  created_at timestamptz not null default now()
);
create index media_trip_idx on public.media (trip_id, created_at desc);
create index media_stop_idx on public.media (stop_id);
create index media_uploaded_by_idx on public.media (uploaded_by);

create table public.media_favs (
  media_id uuid not null references public.media (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, user_id)
);
create index media_favs_user_idx on public.media_favs (user_id);

create table public.positions (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  speed_kn numeric,
  heading numeric,
  accuracy_m numeric,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index positions_trip_idx on public.positions (trip_id, recorded_at desc);
create index positions_recorded_by_idx on public.positions (recorded_by);

create table public.logbook (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  entry_date date not null default current_date,
  route text,
  distance_nm numeric,
  peak_kn numeric,
  wind text,
  note text,
  created_at timestamptz not null default now()
);
create index logbook_trip_idx on public.logbook (trip_id, entry_date);

create table public.yacht_settings (
  id int primary key default 1 check (id = 1),
  wifi_ssid text,
  wifi_password text,
  crew jsonb not null default '[]'::jsonb,
  toys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------- helpers

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()));
$$;

create or replace function public.is_host() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.role = 'host');
$$;

create or replace function public.is_trip_member(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guests g where g.trip_id = t and g.user_id = (select auth.uid()));
$$;

create or replace function public.can_view_trip(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or public.is_trip_member(t);
$$;

create or replace function public.owns_guest(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guests g where g.id = gid and g.user_id = (select auth.uid()));
$$;

-- Storage paths start with the trip id: "<trip_id>/<file>"
create or replace function public.path_trip(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.is_staff, public.is_host, public.is_trip_member,
  public.can_view_trip, public.owns_guest from public, anon;
grant execute on function public.is_staff, public.is_host, public.is_trip_member,
  public.can_view_trip, public.owns_guest, public.path_trip to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.staff enable row level security;
alter table public.trips enable row level security;
alter table public.stops enable row level security;
alter table public.guests enable row level security;
alter table public.guest_invites enable row level security;
alter table public.preferences enable row level security;
alter table public.day_plans enable row level security;
alter table public.menus enable row level security;
alter table public.safety_sections enable row level security;
alter table public.safety_acks enable row level security;
alter table public.alerts enable row level security;
alter table public.requests enable row level security;
alter table public.media enable row level security;
alter table public.media_favs enable row level security;
alter table public.positions enable row level security;
alter table public.logbook enable row level security;
alter table public.yacht_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table private.secrets enable row level security;

-- staff
create policy staff_select on public.staff for select to authenticated using (public.is_staff());
create policy staff_host_write on public.staff for all to authenticated
  using (public.is_host()) with check (public.is_host());

-- trips, stops, day plans, logbook: everyone on the trip reads, hosts write
create policy trips_select on public.trips for select to authenticated using (public.can_view_trip(id));
create policy trips_host_write on public.trips for all to authenticated
  using (public.is_host()) with check (public.is_host());

create policy stops_select on public.stops for select to authenticated using (public.can_view_trip(trip_id));
create policy stops_host_write on public.stops for all to authenticated
  using (public.is_host()) with check (public.is_host());

create policy day_plans_select on public.day_plans for select to authenticated using (public.can_view_trip(trip_id));
create policy day_plans_host_write on public.day_plans for all to authenticated
  using (public.is_host()) with check (public.is_host());

create policy logbook_select on public.logbook for select to authenticated using (public.can_view_trip(trip_id));
create policy logbook_host_write on public.logbook for all to authenticated
  using (public.is_host()) with check (public.is_host());

-- guests: trip members see each other (names and cabins only); hosts manage
create policy guests_select on public.guests for select to authenticated using (public.can_view_trip(trip_id));
create policy guests_host_write on public.guests for all to authenticated
  using (public.is_host()) with check (public.is_host());

create policy guest_invites_host on public.guest_invites for all to authenticated
  using (public.is_host()) with check (public.is_host());

-- preferences: the guest and staff
create policy preferences_select on public.preferences for select to authenticated
  using (public.owns_guest(guest_id) or public.is_staff());
create policy preferences_insert on public.preferences for insert to authenticated
  with check (public.owns_guest(guest_id) or public.is_host());
create policy preferences_update on public.preferences for update to authenticated
  using (public.owns_guest(guest_id) or public.is_host())
  with check (public.owns_guest(guest_id) or public.is_host());

-- menus: staff (hosts, chef, chief stew) write
create policy menus_select on public.menus for select to authenticated using (public.can_view_trip(trip_id));
create policy menus_staff_write on public.menus for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- safety
create policy safety_sections_select on public.safety_sections for select to authenticated using (true);
create policy safety_sections_host_write on public.safety_sections for all to authenticated
  using (public.is_host()) with check (public.is_host());

create policy safety_acks_select on public.safety_acks for select to authenticated
  using (public.owns_guest(guest_id) or public.is_staff());
create policy safety_acks_insert on public.safety_acks for insert to authenticated
  with check (public.owns_guest(guest_id));
create policy safety_acks_delete on public.safety_acks for delete to authenticated
  using (public.owns_guest(guest_id));

-- alerts: hosts send
create policy alerts_select on public.alerts for select to authenticated using (public.can_view_trip(trip_id));
create policy alerts_host_insert on public.alerts for insert to authenticated with check (public.is_host());
create policy alerts_host_delete on public.alerts for delete to authenticated using (public.is_host());

-- requests: the requester and staff see them; staff update status
create policy requests_select on public.requests for select to authenticated
  using (created_by = (select auth.uid()) or public.is_staff());
create policy requests_insert on public.requests for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_view_trip(trip_id));
create policy requests_staff_update on public.requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy requests_delete on public.requests for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_host());

-- media
create policy media_select on public.media for select to authenticated using (public.can_view_trip(trip_id));
create policy media_insert on public.media for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and public.can_view_trip(trip_id));
create policy media_update on public.media for update to authenticated
  using (public.is_host()) with check (public.is_host());
create policy media_delete on public.media for delete to authenticated
  using (uploaded_by = (select auth.uid()) or public.is_host());

create policy media_favs_select on public.media_favs for select to authenticated
  using (exists (select 1 from public.media m where m.id = media_id and public.can_view_trip(m.trip_id)));
create policy media_favs_insert on public.media_favs for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.media m where m.id = media_id and public.can_view_trip(m.trip_id)));
create policy media_favs_delete on public.media_favs for delete to authenticated
  using (user_id = (select auth.uid()));

-- positions: staff share, everyone on the trip reads
create policy positions_select on public.positions for select to authenticated using (public.can_view_trip(trip_id));
create policy positions_staff_insert on public.positions for insert to authenticated with check (public.is_staff());

-- yacht settings: any signed-in person reads (Wi-Fi), hosts write
create policy yacht_settings_select on public.yacht_settings for select to authenticated using (true);
create policy yacht_settings_host_write on public.yacht_settings for all to authenticated
  using (public.is_host()) with check (public.is_host());

-- push subscriptions: own only
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- triggers

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger preferences_touch before update on public.preferences
  for each row execute function public.touch_updated_at();
create trigger day_plans_touch before update on public.day_plans
  for each row execute function public.touch_updated_at();
create trigger menus_touch before update on public.menus
  for each row execute function public.touch_updated_at();
create trigger requests_touch before update on public.requests
  for each row execute function public.touch_updated_at();
create trigger yacht_settings_touch before update on public.yacht_settings
  for each row execute function public.touch_updated_at();

-- New guests get an invite token automatically
create or replace function public.make_guest_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.guest_invites (guest_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.make_guest_invite from public, anon, authenticated;

create trigger guests_make_invite after insert on public.guests
  for each row execute function public.make_guest_invite();

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800),
       ('request-photos', 'request-photos', false, 15728640)
on conflict (id) do nothing;

create policy media_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.can_view_trip(public.path_trip(name)));
create policy media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.can_view_trip(public.path_trip(name)));
create policy media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (owner_id = (select auth.uid())::text or public.is_host()));

create policy request_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'request-photos' and (owner_id = (select auth.uid())::text or public.is_staff()));
create policy request_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'request-photos' and public.can_view_trip(public.path_trip(name)));

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table
  public.alerts, public.requests, public.media, public.media_favs, public.positions,
  public.day_plans, public.menus, public.stops, public.trips;
