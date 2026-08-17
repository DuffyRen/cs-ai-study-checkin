create table if not exists public.study_day_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 84),
  completed boolean not null default false,
  note text not null default '',
  focus_minutes integer not null default 0 check (focus_minutes >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_number)
);

alter table public.study_day_states enable row level security;
revoke all on table public.study_day_states from anon;
grant select, insert, update, delete on table public.study_day_states to authenticated;

drop policy if exists "Users can read their own study data" on public.study_day_states;
create policy "Users can read their own study data"
on public.study_day_states for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own study data" on public.study_day_states;
create policy "Users can create their own study data"
on public.study_day_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own study data" on public.study_day_states;
create policy "Users can update their own study data"
on public.study_day_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own study data" on public.study_day_states;
create policy "Users can delete their own study data"
on public.study_day_states for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_day_states'
  ) then
    alter publication supabase_realtime add table public.study_day_states;
  end if;
end
$$;
