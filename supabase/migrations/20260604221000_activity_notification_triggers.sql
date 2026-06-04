begin;

create or replace function public.activity_notification_post_title(
  title text,
  content text,
  fallback text
)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(title), ''),
    nullif(left(trim(content), 120), ''),
    fallback
  );
$$;

create or replace function public.create_reseau_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_record public.reseau_posts%rowtype;
  notification_title text;
begin
  select *
  into post_record
  from public.reseau_posts
  where id = new.post_id;

  if not found then
    return new;
  end if;

  notification_title := public.activity_notification_post_title(
    post_record.title,
    post_record.content,
    'Post réseau'
  );

  insert into public.activity_notifications (
    recipient_id,
    actor_id,
    type,
    source,
    source_post_id,
    post_title,
    message,
    is_read
  )
  select
    recipients.recipient_id,
    new.author_id,
    case when recipients.recipient_id = post_record.author_id then 'comment' else 'reply' end,
    'reseau',
    new.post_id,
    notification_title,
    case when recipients.recipient_id = post_record.author_id then 'Nouveau commentaire sur votre post' else 'Nouvelle réponse dans un post que vous suivez' end,
    false
  from (
    select post_record.author_id as recipient_id
    union
    select distinct c.author_id as recipient_id
    from public.reseau_comments c
    where c.post_id = new.post_id
      and c.id <> new.id
  ) recipients
  where recipients.recipient_id is not null
    and recipients.recipient_id <> new.author_id;

  return new;
end;
$$;

create or replace function public.create_blog_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_record public.blog_posts%rowtype;
  notification_title text;
begin
  select *
  into post_record
  from public.blog_posts
  where id = new.post_id;

  if not found then
    return new;
  end if;

  notification_title := public.activity_notification_post_title(
    post_record.title,
    post_record.content,
    'Sujet blog'
  );

  insert into public.activity_notifications (
    recipient_id,
    actor_id,
    type,
    source,
    source_post_id,
    post_title,
    message,
    is_read
  )
  select
    recipients.recipient_id,
    new.author_id,
    case when recipients.recipient_id = post_record.author_id then 'comment' else 'reply' end,
    'blog',
    new.post_id,
    notification_title,
    case when recipients.recipient_id = post_record.author_id then 'Nouveau commentaire sur votre sujet' else 'Nouvelle réponse dans un sujet que vous suivez' end,
    false
  from (
    select post_record.author_id as recipient_id
    union
    select distinct c.author_id as recipient_id
    from public.blog_comments c
    where c.post_id = new.post_id
      and c.id <> new.id
  ) recipients
  where recipients.recipient_id is not null
    and recipients.recipient_id <> new.author_id;

  return new;
end;
$$;

create or replace function public.create_reseau_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  notification_title text;
begin
  if new.likes_count <= old.likes_count then
    return new;
  end if;

  actor := auth.uid();
  if actor is not null and actor = new.author_id then
    return new;
  end if;

  notification_title := public.activity_notification_post_title(
    new.title,
    new.content,
    'Post réseau'
  );

  insert into public.activity_notifications (
    recipient_id,
    actor_id,
    type,
    source,
    source_post_id,
    post_title,
    message,
    is_read
  )
  values (
    new.author_id,
    actor,
    'like',
    'reseau',
    new.id,
    notification_title,
    'Nouveau like sur votre post',
    false
  );

  return new;
end;
$$;

drop trigger if exists trg_reseau_comment_activity_notifications on public.reseau_comments;
create trigger trg_reseau_comment_activity_notifications
after insert on public.reseau_comments
for each row
execute function public.create_reseau_comment_notifications();

drop trigger if exists trg_blog_comment_activity_notifications on public.blog_comments;
create trigger trg_blog_comment_activity_notifications
after insert on public.blog_comments
for each row
execute function public.create_blog_comment_notifications();

drop trigger if exists trg_reseau_like_activity_notifications on public.reseau_posts;
create trigger trg_reseau_like_activity_notifications
after update of likes_count on public.reseau_posts
for each row
execute function public.create_reseau_like_notification();

commit;
