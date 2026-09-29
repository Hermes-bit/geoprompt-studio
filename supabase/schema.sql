-- GéoPrompt Studio : une seule table, chaque ligne appartient à un utilisateur.
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  col        text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, col, id)
);

alter table public.docs enable row level security;

-- Chacun ne voit et ne modifie que ses propres données.
drop policy if exists "docs_proprietaire" on public.docs;
create policy "docs_proprietaire" on public.docs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
