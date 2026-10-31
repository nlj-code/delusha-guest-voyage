-- Hosts can rewrite any part of a destination guide. Built-in guides live in js/guides-data.js.
create table public.guide_overrides (
  key text primary key,
  content jsonb not null,
  updated_by_name text,
  updated_at timestamptz not null default now()
);
alter table public.guide_overrides enable row level security;
create policy guide_overrides_select on public.guide_overrides for select to authenticated using (true);
create policy guide_overrides_host_insert on public.guide_overrides for insert to authenticated with check (public.is_host());
create policy guide_overrides_host_update on public.guide_overrides for update to authenticated using (public.is_host()) with check (public.is_host());
create policy guide_overrides_host_delete on public.guide_overrides for delete to authenticated using (public.is_host());
create trigger guide_overrides_touch before update on public.guide_overrides for each row execute function public.touch_updated_at();
