-- Diario técnico · estructura de la nube. Pégalo entero en Supabase › SQL Editor › Run.
-- Seguridad: cada cuenta solo puede leer y escribir sus propias filas y sus propios vídeos.

-- 1) Tabla única de documentos (secciones, clips, notas...). "data" lleva el contenido.
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('section','clip','note','comparison')),
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,   -- "lápida": avisa a los demás dispositivos de un borrado
  updated_at bigint      not null,                 -- hora del cambio en el dispositivo (gana el más reciente)
  synced_at  timestamptz not null default clock_timestamp(),  -- hora del servidor: sirve para pedir solo lo nuevo
  primary key (user_id, kind, id)
);
create index if not exists docs_user_synced on public.docs (user_id, synced_at);

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin new.synced_at := clock_timestamp(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

alter table public.docs enable row level security;
drop policy if exists "docs propios: leer"     on public.docs;
drop policy if exists "docs propios: insertar" on public.docs;
drop policy if exists "docs propios: editar"   on public.docs;
drop policy if exists "docs propios: borrar"   on public.docs;
create policy "docs propios: leer"     on public.docs for select using (auth.uid() = user_id);
create policy "docs propios: insertar" on public.docs for insert with check (auth.uid() = user_id);
create policy "docs propios: editar"   on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "docs propios: borrar"   on public.docs for delete using (auth.uid() = user_id);

-- 2) Almacén de vídeos (privado). Cada vídeo va en la carpeta de su dueño: <id-usuario>/<id-clip>
--    Límite de 50 MB por vídeo (el plan gratuito no admite más por archivo).
insert into storage.buckets (id, name, public, file_size_limit)
values ('videos', 'videos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "videos propios: leer"     on storage.objects;
drop policy if exists "videos propios: subir"    on storage.objects;
drop policy if exists "videos propios: cambiar"  on storage.objects;
drop policy if exists "videos propios: borrar"   on storage.objects;
create policy "videos propios: leer"    on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos propios: subir"   on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos propios: cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos propios: borrar"  on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
