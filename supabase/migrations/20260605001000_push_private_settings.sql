begin;

create table if not exists public.app_private_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_private_settings enable row level security;

revoke all on table public.app_private_settings from anon;
revoke all on table public.app_private_settings from authenticated;
grant all on table public.app_private_settings to service_role;

create or replace function public.private_app_setting(setting_key text)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select value
    from public.app_private_settings
    where key = setting_key
    limit 1
  ), '');
$$;

revoke all on function public.private_app_setting(text) from public;
grant execute on function public.private_app_setting(text) to service_role;

create or replace function public.push_webhook_url()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    nullif(public.private_app_setting('push_webhook_url'), ''),
    'https://eecejwuqsmgavtitbjou.supabase.co/functions/v1/send-push'
  );
$$;

create or replace function public.push_webhook_secret()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(public.private_app_setting('push_webhook_secret'), ''), '');
$$;

revoke all on function public.push_webhook_url() from public;
revoke all on function public.push_webhook_secret() from public;

commit;
