-- Each itinerary stop can say what kind of place it is.
alter table public.stops add column if not exists kind text check (kind in ('Anchorage', 'Beach', 'Port', 'Restaurant', 'Swim stop'));
update public.stops set kind = case when port_id is not null then 'Port' else 'Anchorage' end where kind is null;
