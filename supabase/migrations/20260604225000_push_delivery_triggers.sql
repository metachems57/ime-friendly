begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.push_webhook_url()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.settings.push_webhook_url', true), ''),
    'https://eecejwuqsmgavtitbjou.supabase.co/functions/v1/send-push'
  );
$$;

create or replace function public.push_webhook_secret()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.settings.push_webhook_secret', true), ''), '');
$$;

create or replace function public.enqueue_push_webhook(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  webhook_url text := public.push_webhook_url();
  webhook_secret text := public.push_webhook_secret();
begin
  if webhook_url = '' or webhook_secret = '' then
    return;
  end if;

  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', webhook_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  );
end;
$$;

create or replace function public.push_private_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.to_user_id is null or new.from_user_id is null or new.to_user_id = new.from_user_id then
    return new;
  end if;

  perform public.enqueue_push_webhook(jsonb_build_object(
    'event', 'private_message',
    'message_id', new.id,
    'recipient_id', new.to_user_id,
    'actor_id', new.from_user_id,
    'source', 'messagerie',
    'content', left(coalesce(new.content, ''), 140)
  ));

  return new;
end;
$$;

create or replace function public.push_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_id is null then
    return new;
  end if;

  perform public.enqueue_push_webhook(jsonb_build_object(
    'event', 'activity_notification',
    'notification_id', new.id,
    'recipient_id', new.recipient_id,
    'actor_id', new.actor_id,
    'type', new.type,
    'source', new.source,
    'source_post_id', new.source_post_id,
    'post_title', new.post_title,
    'message', new.message
  ));

  return new;
end;
$$;

create or replace function public.push_reseau_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_push_webhook(jsonb_build_object(
    'event', 'new_post',
    'source', 'reseau',
    'source_post_id', new.id,
    'actor_id', new.author_id,
    'post_title', public.activity_notification_post_title(new.title, new.content, 'Nouveau post réseau')
  ));

  return new;
end;
$$;

create or replace function public.push_blog_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_push_webhook(jsonb_build_object(
    'event', 'new_post',
    'source', 'blog',
    'source_post_id', new.id,
    'actor_id', new.author_id,
    'post_title', public.activity_notification_post_title(new.title, new.content, 'Nouveau post blog')
  ));

  return new;
end;
$$;

create or replace function public.push_tool_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_push_webhook(jsonb_build_object(
    'event', 'new_post',
    'source', 'tools',
    'source_post_id', new.id,
    'actor_id', new.author_id,
    'post_title', coalesce(nullif(trim(new.name), ''), 'Nouvel outil')
  ));

  return new;
end;
$$;

drop trigger if exists trg_push_private_message_notification on public.private_messages;
create trigger trg_push_private_message_notification
after insert on public.private_messages
for each row
execute function public.push_private_message_notification();

drop trigger if exists trg_push_activity_notification on public.activity_notifications;
create trigger trg_push_activity_notification
after insert on public.activity_notifications
for each row
execute function public.push_activity_notification();

drop trigger if exists trg_push_reseau_new_post on public.reseau_posts;
create trigger trg_push_reseau_new_post
after insert on public.reseau_posts
for each row
execute function public.push_reseau_new_post();

drop trigger if exists trg_push_blog_new_post on public.blog_posts;
create trigger trg_push_blog_new_post
after insert on public.blog_posts
for each row
execute function public.push_blog_new_post();

drop trigger if exists trg_push_tool_new_post on public.tools;
create trigger trg_push_tool_new_post
after insert on public.tools
for each row
execute function public.push_tool_new_post();

commit;
