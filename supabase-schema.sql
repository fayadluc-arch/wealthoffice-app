-- PrecatóriosPRO Schema
-- Run this in Supabase SQL Editor

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Precatórios table
create table if not exists public.precatorios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  cedente text not null,
  devedor text not null,
  esfera text not null check (esfera in ('Estadual', 'Federal', 'Municipal')),
  cnj text default '',
  ordem_cronologica text default '',
  tribunal text default '',
  advogado text default '',
  status text not null default 'Homologação' check (status in ('Homologação', 'Transferência', 'Análise Procuradoria', 'Fila de Pagamento', 'Recebido')),
  prazo_estimado text not null default '12-24 meses' check (prazo_estimado in ('Recebido', '0-6 meses', '6-12 meses', '12-24 meses', '24-36 meses', '+36 meses')),
  data_aquisicao date,
  desembolso numeric(15,2) default 0,
  valor_nominal numeric(15,2) default 0,
  preco numeric(5,4) default 0,
  credito_atualizado numeric(15,2) default 0,
  pct_receber numeric(5,4) default 0,
  honorarios_adv numeric(5,4) default 0,
  valor_receber numeric(15,2) default 0,
  retorno numeric(5,4) default 0,
  tir numeric(5,4) default 0,
  data_recebimento date,
  prazo_decorrido numeric(6,1) default 0,
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.precatorios enable row level security;

create policy "Users can view own precatorios" on public.precatorios
  for select using (auth.uid() = user_id);

create policy "Users can insert own precatorios" on public.precatorios
  for insert with check (auth.uid() = user_id);

create policy "Users can update own precatorios" on public.precatorios
  for update using (auth.uid() = user_id);

create policy "Users can delete own precatorios" on public.precatorios
  for delete using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger precatorios_updated_at
  before update on public.precatorios
  for each row execute function public.update_updated_at();

-- 3. Atividades table (audit log)
create table if not exists public.atividades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  precatorio_id uuid references public.precatorios(id) on delete cascade,
  tipo text not null check (tipo in ('criacao', 'edicao', 'exclusao', 'status')),
  descricao text not null,
  campo text,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz not null default now()
);

alter table public.atividades enable row level security;

create policy "Users can view own atividades" on public.atividades
  for select using (auth.uid() = user_id);

create policy "Users can insert own atividades" on public.atividades
  for insert with check (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_precatorios_user_id on public.precatorios(user_id);
create index if not exists idx_atividades_user_id on public.atividades(user_id);
create index if not exists idx_atividades_precatorio_id on public.atividades(precatorio_id);
