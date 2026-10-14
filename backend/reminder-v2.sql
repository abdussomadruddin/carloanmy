begin;
alter table public.car_agent_appointments add column if not exists auto_completed_at timestamptz;
create function public.car_auto_completion_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('anon','authenticated') then
   if TG_OP='INSERT' then new.auto_completed_at:=null;
   elsif new.auto_completed_at is distinct from old.auto_completed_at then raise exception 'Automatic completion is server-managed'; end if;
 end if;
 if TG_OP='UPDATE' and new.status<>'Completed' then new.auto_completed_at:=null; end if;
 return new;
end;$$;
create trigger car_b_auto_completion_guard before insert or update on public.car_agent_appointments for each row execute function public.car_auto_completion_guard();
revoke all on function public.car_auto_completion_guard() from public,anon,authenticated;
alter table public.car_agent_followup_push add column if not exists slot_hour integer not null default 8 check(slot_hour in(8,12,16));
alter table public.car_agent_followup_push drop constraint car_agent_followup_push_pkey;
alter table public.car_agent_followup_push add primary key(day,slot_hour,subscription_id);
drop function public.car_claim_followup_push();
create function public.car_claim_followup_push()
returns table(subscription_id uuid,subscription jsonb,case_count bigint,slot_hour integer,slot_day date)
language sql security definer set search_path='' as $$
with slot as (
 select (now() at time zone 'Asia/Kuala_Lumpur')::date as day,
 case when (now() at time zone 'Asia/Kuala_Lumpur')::time>=time '16:00' then 16
 when (now() at time zone 'Asia/Kuala_Lumpur')::time>=time '12:00' then 12
 when (now() at time zone 'Asia/Kuala_Lumpur')::time>=time '08:00' then 8 end as hour
),eligible as (
 select d.subscription_id,s.subscription,count(c.id) case_count,t.hour,t.day
 from public.car_agent_devices d join public.car_push_subscriptions s on s.id=d.subscription_id and s.enabled
 join auth.users u on u.id=d.owner_id join public.car_agent_cases c on c.owner_id=d.owner_id cross join slot t
 where t.hour is not null and c.agent_deleted_at is null and c.status not in('Rejected','Delivered','Cancelled')
 and c.activity_at<=((t.day+make_time(t.hour,0,0)) at time zone 'Asia/Kuala_Lumpur')-interval '72 hours' and coalesce(u.raw_app_meta_data->>'pro_disabled','false')<>'true'
 and u.email_confirmed_at is not null and now()<timestamptz '2027-01-01 00:00:00+08'
 and not exists(select 1 from public.car_agent_followup_push p where p.subscription_id=d.subscription_id and p.day=t.day and p.slot_hour=t.hour)
 group by d.subscription_id,s.subscription,t.hour,t.day order by d.subscription_id limit 100
),claimed as (
 insert into public.car_agent_followup_push(day,slot_hour,subscription_id)
 select day,hour,subscription_id from eligible on conflict do nothing returning *
)select e.subscription_id,e.subscription,e.case_count,e.hour,e.day from eligible e join claimed c on c.subscription_id=e.subscription_id and c.day=e.day and c.slot_hour=e.hour;
$$;
create or replace function public.car_auto_complete_appointments()
returns bigint language plpgsql security definer set search_path='' as $$
declare affected bigint;
begin
 update public.car_agent_appointments set status='Completed',auto_completed_at=now()
 where status='Scheduled' and agent_deleted_at is null and starts_at<=now()-interval '5 hours'
 -- Do not retroactively complete old appointments when this feature is activated.
 and starts_at>=(select activated_at from public.car_reminder_policy where id=1);
 get diagnostics affected=row_count;return affected;
end;$$;
create table public.car_reminder_policy(id integer primary key check(id=1),activated_at timestamptz not null default now());
insert into public.car_reminder_policy(id) values(1);
alter table public.car_reminder_policy enable row level security;
revoke all on public.car_reminder_policy from public,anon,authenticated;
grant select on public.car_reminder_policy to service_role;
create or replace function public.car_agent_claim_reminders()
returns table(appointment_id uuid,revision integer,offset_hours integer,subscription_id uuid,subscription jsonb,type text,starts_at timestamptz)
language sql security invoker set search_path='' as $$
with due as (
 select a.id,a.revision,o.hours,s.id subscription_id,s.subscription,a.type,a.starts_at,
 row_number() over(partition by a.id,s.id order by o.hours asc) priority
 from public.car_agent_appointments a cross join(values(72),(24),(4),(1),(-2),(-3),(-4)) o(hours)
 join public.car_agent_devices d on d.owner_id=a.owner_id
 join public.car_push_subscriptions s on s.id=d.subscription_id and s.enabled
 left join public.car_agent_reminders r on r.appointment_id=a.id and r.revision=a.revision and r.offset_hours=o.hours and r.subscription_id=s.id
 where a.agent_deleted_at is null and a.status='Scheduled'
 and now()>=a.starts_at-make_interval(hours=>o.hours)
 and (case o.hours when 72 then now()<a.starts_at-interval '24 hours'
 when 24 then now()<a.starts_at-interval '4 hours' when 4 then now()<a.starts_at-interval '1 hour'
 when 1 then now()<a.starts_at when -2 then now()<a.starts_at+interval '3 hours'
 when -3 then now()<a.starts_at+interval '4 hours' else now()<a.starts_at+interval '5 hours' end)
 and ((o.hours>0 and a.starts_at>now()) or (o.hours<0 and now()<a.starts_at+interval '5 hours'
 and a.starts_at>=(select activated_at from public.car_reminder_policy where id=1)))
 and a.updated_at<=a.starts_at-make_interval(hours=>o.hours)
 and (r.appointment_id is null or r.state='processing' and r.updated_at<now()-interval '2 minutes')
),candidates as(select * from due where priority=1 order by starts_at limit 30),claimed as (
 insert into public.car_agent_reminders as r(appointment_id,revision,offset_hours,subscription_id,state)
 select id,revision,hours,subscription_id,'processing' from candidates
 on conflict on constraint car_agent_reminders_pkey do update set updated_at=now()
 where r.state='processing' and r.updated_at<now()-interval '2 minutes' returning r.*
)select c.id,c.revision,c.hours,c.subscription_id,c.subscription,c.type,c.starts_at from candidates c join claimed r on r.appointment_id=c.id and r.revision=c.revision and r.offset_hours=c.hours and r.subscription_id=c.subscription_id;
$$;
revoke all on function public.car_claim_followup_push(),public.car_auto_complete_appointments() from public,anon,authenticated;
grant execute on function public.car_claim_followup_push(),public.car_auto_complete_appointments() to service_role;
commit;
