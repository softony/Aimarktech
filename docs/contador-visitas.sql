-- =========================================================
-- AIMARKTECH — Contador de visitas (Supabase)
-- ---------------------------------------------------------
-- Pega TODO este bloque en Supabase -> SQL Editor -> New query
-- y dale "Run". Crea:
--   1) la tabla 'site_visits' (una sola fila con el total)
--   2) la función 'increment_visits()' que suma +1 de forma
--      atómica (segura aunque entren muchas personas a la vez)
-- =========================================================

-- 1) Tabla con un único registro (id = 1) que guarda el total
create table if not exists public.site_visits (
  id    int    primary key default 1,
  total bigint not null default 0
);

-- Aseguramos que exista la fila inicial en cero
insert into public.site_visits (id, total)
values (1, 0)
on conflict (id) do nothing;

-- 2) Función atómica que suma 1 y devuelve el nuevo total
create or replace function public.increment_visits()
returns bigint
language plpgsql
security definer
as $$
declare
  nuevo bigint;
begin
  update public.site_visits
     set total = total + 1
   where id = 1
  returning total into nuevo;
  return nuevo;
end;
$$;

-- 3) Seguridad: dejamos la tabla privada (solo la función
--    serverless con la service_role key puede tocarla)
alter table public.site_visits enable row level security;
