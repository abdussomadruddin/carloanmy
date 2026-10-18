begin;
create or replace function public.car_admin_agent_totals()
returns jsonb language sql stable security invoker set search_path='' as $$
with contacts as (
 select whatsapp,min(created_at) as first_at from public.car_download_requests
 where created_at<=now() group by whatsapp
), daily_counts as (
 select (first_at at time zone 'Asia/Kuala_Lumpur')::date as day,count(*) as total
 from contacts group by 1
), days as (
 select (now() at time zone 'Asia/Kuala_Lumpur')::date-i as day from generate_series(0,29) i
)
select jsonb_build_object('total',(select count(*) from contacts),'checkedAt',now(),
 'daily',(select jsonb_agg(jsonb_build_object('date',d.day,'count',coalesce(c.total,0)) order by d.day)
 from days d left join daily_counts c on c.day=d.day));
$$;
revoke all on function public.car_admin_agent_totals() from public,anon,authenticated;
grant execute on function public.car_admin_agent_totals() to service_role;
-- Invoker rights retain the authenticated agent's existing row-level policies.
create or replace function public.car_agent_counts()
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('case',count(*),'followup',count(*) filter(
 where status not in('Rejected','Delivered','Cancelled') and activity_at<=now()-interval '72 hours'),
 'appointment',(select count(*) from public.car_agent_appointments
 where owner_id=(select auth.uid()) and agent_deleted_at is null
 and status='Scheduled' and starts_at>=now()))
from public.car_agent_cases where owner_id=(select auth.uid()) and agent_deleted_at is null;
$$;
revoke all on function public.car_agent_counts() from public,anon;
grant execute on function public.car_agent_counts() to authenticated;

-- Only the authenticated admin API (service role) can read the aggregate.
create or replace function public.car_admin_announcement_summary()
returns jsonb language sql stable security invoker set search_path='' as $$
with announcements as (
 select * from public.car_announcements order by created_at desc limit 40
), totals as (
 select d.announcement_id,count(*) as total,
 count(*) filter(where state='sent') as sent,
 count(*) filter(where state='failed') as failed,
 count(*) filter(where state='processing') as processing,max(updated_at) as last_updated
 from public.car_push_deliveries d join announcements a on a.id=d.announcement_id
 group by d.announcement_id
)
select jsonb_build_object('activeSubscriptions',
 (select count(*) from public.car_push_subscriptions where enabled),
 'announcements',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('delivery',
 jsonb_build_object('sent',coalesce(t.sent,0),'failed',coalesce(t.failed,0),
 'processing',coalesce(t.processing,0),'total',coalesce(t.total,0),'lastUpdated',t.last_updated))
 order by a.created_at desc) from announcements a left join totals t on t.announcement_id=a.id),'[]'::jsonb));
$$;
revoke all on function public.car_admin_announcement_summary() from public,anon,authenticated;
grant execute on function public.car_admin_announcement_summary() to service_role;

create or replace function public.car_link_agent_device(device_id uuid,agent_id uuid)
returns void language sql security invoker set search_path='' as $$
insert into public.car_agent_devices(subscription_id,owner_id) values(device_id,agent_id)
on conflict(subscription_id) do update set owner_id=excluded.owner_id
where public.car_agent_devices.owner_id is distinct from excluded.owner_id;
$$;
revoke all on function public.car_link_agent_device(uuid,uuid) from public,anon,authenticated;
grant execute on function public.car_link_agent_device(uuid,uuid) to service_role;
commit;
