-- Security hardening pass:
-- 1) Protect profile updates from self role/validation escalation.
-- 2) Add DB-side rate limiting helpers.
-- 3) Tighten insert policies for high-volume tables.

begin;

create or replace function public.can_participate_in_messaging(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.is_validated = true
  )
  and not exists (
    select 1
    from public.messaging_blocks b
    where b.blocked_user_id = uid
      and b.lifted_at is null
  );
$$;

create or replace function public.within_rate_limit(
  actor uuid,
  scope text,
  max_count integer,
  window_interval interval
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  current_count bigint := 0;
  norm_scope text := lower(coalesce(scope, ''));
begin
  if actor is null then
    return false;
  end if;

  if max_count is null or max_count < 1 then
    return false;
  end if;

  if window_interval is null then
    return false;
  end if;

  case norm_scope
    when 'reseau_posts' then
      select count(*) into current_count
      from public.reseau_posts
      where author_id = actor
        and created_at >= now() - window_interval;

    when 'reseau_comments' then
      select count(*) into current_count
      from public.reseau_comments
      where author_id = actor
        and created_at >= now() - window_interval;

    when 'blog_posts' then
      select count(*) into current_count
      from public.blog_posts
      where author_id = actor
        and created_at >= now() - window_interval;

    when 'blog_comments' then
      select count(*) into current_count
      from public.blog_comments
      where author_id = actor
        and created_at >= now() - window_interval;

    when 'tools' then
      select count(*) into current_count
      from public.tools
      where author_id = actor
        and created_at >= now() - window_interval;

    when 'private_messages' then
      select count(*) into current_count
      from public.private_messages
      where from_user_id = actor
        and created_at >= now() - window_interval;

    when 'message_reports' then
      select count(*) into current_count
      from public.message_reports
      where reporter_id = actor
        and created_at >= now() - window_interval;

    when 'activity_notifications' then
      select count(*) into current_count
      from public.activity_notifications
      where actor_id = actor
        and created_at >= now() - window_interval;

    else
      return false;
  end case;

  return current_count < max_count;
end;
$$;

-- Helpful indexes for rate-limit checks
create index if not exists idx_reseau_posts_author_created_at
  on public.reseau_posts(author_id, created_at desc);

create index if not exists idx_reseau_comments_author_created_at
  on public.reseau_comments(author_id, created_at desc);

create index if not exists idx_blog_posts_author_created_at
  on public.blog_posts(author_id, created_at desc);

create index if not exists idx_blog_comments_author_created_at
  on public.blog_comments(author_id, created_at desc);

create index if not exists idx_tools_author_created_at
  on public.tools(author_id, created_at desc);

create index if not exists idx_message_reports_reporter_created_at
  on public.message_reports(reporter_id, created_at desc);

-- Profiles: stop self privilege escalation while keeping admin edit path.
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_admin_update_all on public.profiles;

create policy profiles_update_self_limited
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and is_validated = (select p.is_validated from public.profiles p where p.id = auth.uid())
  and coalesce(email, '') = coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')
);

create policy profiles_update_admin_all
on public.profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Reseau policies
drop policy if exists reseau_posts_insert_validated on public.reseau_posts;
create policy reseau_posts_insert_validated
on public.reseau_posts
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'reseau_posts', 20, interval '1 hour')
);

drop policy if exists reseau_comments_insert_validated on public.reseau_comments;
create policy reseau_comments_insert_validated
on public.reseau_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'reseau_comments', 120, interval '1 hour')
);

-- Blog policies
drop policy if exists blog_posts_insert_validated on public.blog_posts;
create policy blog_posts_insert_validated
on public.blog_posts
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'blog_posts', 15, interval '1 hour')
);

drop policy if exists blog_comments_insert_validated on public.blog_comments;
create policy blog_comments_insert_validated
on public.blog_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'blog_comments', 120, interval '1 hour')
);

-- Tools policies
drop policy if exists tools_insert_validated on public.tools;
create policy tools_insert_validated
on public.tools
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'tools', 25, interval '1 hour')
);

-- Messaging policies
drop policy if exists private_messages_insert_sender on public.private_messages;
drop policy if exists private_messages_insert_sender_validated on public.private_messages;

create policy private_messages_insert_sender_validated
on public.private_messages
for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and from_user_id <> to_user_id
  and public.can_participate_in_messaging(auth.uid())
  and public.can_participate_in_messaging(to_user_id)
  and public.within_rate_limit(auth.uid(), 'private_messages', 180, interval '1 hour')
);

-- Reports policy
drop policy if exists message_reports_insert_reporter on public.message_reports;
create policy message_reports_insert_reporter
on public.message_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'message_reports', 20, interval '1 day')
);

-- Activity notifications policy
drop policy if exists activity_notifications_insert_actor on public.activity_notifications;
drop policy if exists activity_notifications_insert_authenticated on public.activity_notifications;

create policy activity_notifications_insert_actor
on public.activity_notifications
for insert
to authenticated
with check (
  (actor_id is null or actor_id = auth.uid())
  and recipient_id <> auth.uid()
  and public.is_validated(auth.uid())
  and public.within_rate_limit(auth.uid(), 'activity_notifications', 300, interval '1 hour')
);

commit;
