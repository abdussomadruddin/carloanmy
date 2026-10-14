begin;
create or replace function public.car_admin_cases(filters jsonb default '{}'::jsonb, page_number integer default 1, analysis boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
with filtered as materialized (
  select c.*,coalesce(nullif(u.raw_user_meta_data->>'name',''),u.email,'Ejen') as agent_name,
    c.status not in ('Rejected','Delivered','Cancelled') as is_active,
    c.agent_deleted_at is null and c.status not in ('Rejected','Delivered','Cancelled')
      and c.activity_at<=now()-interval '3 days' as needs_followup
  from public.car_agent_cases c join auth.users u on u.id=c.owner_id
  where (coalesce(filters->>'agent','')='' or c.owner_id::text=filters->>'agent')
    and (coalesce(filters->>'status','')='' or c.status=filters->>'status')
    and (coalesce(filters->>'deleted','all')='all'
      or filters->>'deleted'='deleted' and c.agent_deleted_at is not null
      or filters->>'deleted'='visible' and c.agent_deleted_at is null)
    and (coalesce(filters->>'from','')='' or c.created_at>=(filters->>'from')::timestamptz)
    and (coalesce(filters->>'to','')='' or c.created_at<(filters->>'to')::timestamptz)
    and (coalesce(filters->>'search','')='' or position(lower(filters->>'search') in lower(concat_ws(' ',c.name,c.phone,c.brand,c.model,c.variant)))>0)
), agents as (
  select distinct c.owner_id as id,coalesce(nullif(u.raw_user_meta_data->>'name',''),u.email,'Ejen') as name
  from public.car_agent_cases c join auth.users u on u.id=c.owner_id
)
select case when not analysis then jsonb_build_object(
  'total',(select count(*) from filtered),'page',page_number,
  'agents',coalesce((select jsonb_agg(a order by name,id) from agents a),'[]'::jsonb),
  'records',coalesce((select jsonb_agg(r order by activity_at desc,id) from
    (select * from filtered order by activity_at desc,id limit 20 offset greatest(page_number-1,0)*20) r),'[]'::jsonb))
else jsonb_build_object(
  'checkedAt',now(),
  'summary',(select jsonb_build_object('total',count(*),'active',count(*) filter(where is_active),
    'lou',count(*) filter(where status='LOU received'),'delivered',count(*) filter(where status='Delivered'),
    'rejected',count(*) filter(where status='Rejected'),'cancelled',count(*) filter(where status='Cancelled'),
    'followup',count(*) filter(where needs_followup),'deleted',count(*) filter(where agent_deleted_at is not null)) from filtered),
  'statuses',coalesce((select jsonb_agg(r order by status) from (select status,count(*) as count from filtered group by status) r),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(r order by date) from (select (created_at at time zone 'Asia/Kuala_Lumpur')::date as date,count(*) as count from filtered group by 1) r),'[]'::jsonb),
  'agents',coalesce((select jsonb_agg(r order by total desc,agent_name,owner_id) from
    (select owner_id,agent_name,count(*) as total,count(*) filter(where is_active) as active,
      count(*) filter(where status='Delivered') as delivered,count(*) filter(where status='Rejected') as rejected,
      count(*) filter(where status='Cancelled') as cancelled,count(*) filter(where needs_followup) as followup from filtered group by owner_id,agent_name) r),'[]'::jsonb),
  'models',coalesce((select jsonb_agg(r order by total desc,brand,model) from
    (select brand,model,count(*) as total,count(*) filter(where status='Delivered') as delivered from filtered group by brand,model) r),'[]'::jsonb)) end;
$$;
create or replace function public.car_admin_case_detail(case_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('record',to_jsonb(c)||jsonb_build_object('agent_name',coalesce(nullif(u.raw_user_meta_data->>'name',''),u.email,'Ejen')),
  'history',coalesce((select jsonb_agg(e order by e.created_at desc,e.id desc) from public.car_agent_case_events e where e.case_id=c.id),'[]'::jsonb))
from public.car_agent_cases c join auth.users u on u.id=c.owner_id where c.id=case_id;
$$;
revoke all on function public.car_admin_cases(jsonb,integer,boolean),public.car_admin_case_detail(uuid) from public,anon,authenticated;
grant execute on function public.car_admin_cases(jsonb,integer,boolean),public.car_admin_case_detail(uuid) to service_role;
drop trigger if exists car_case_admin_live on public.car_agent_cases;
create trigger car_case_admin_live after insert or update or delete on public.car_agent_cases for each statement execute function public.car_emit_live_signal('admin');
drop trigger if exists car_case_event_admin_live on public.car_agent_case_events;
create trigger car_case_event_admin_live after insert or update or delete on public.car_agent_case_events for each statement execute function public.car_emit_live_signal('admin');
commit;
