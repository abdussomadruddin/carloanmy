-- Read-only gates: never claim reminders merely to check whether work exists.
begin;
create or replace function public.car_reminder_work_due(kind text)
returns boolean language sql security invoker set search_path='' as $$
select case when kind='appointment' then
 exists(select 1 from public.car_agent_appointments a
 where a.status='Scheduled' and a.agent_deleted_at is null
 and a.starts_at<=now()-interval '5 hours'
 and a.starts_at>=(select activated_at from public.car_reminder_policy where id=1))
 or exists(
 select 1 from public.car_agent_appointments a
 cross join(values(72),(24),(4),(1),(-2),(-3),(-4)) o(hours)
 join public.car_agent_devices d on d.owner_id=a.owner_id
 join public.car_push_subscriptions s on s.id=d.subscription_id and s.enabled
 left join public.car_agent_reminders r on r.appointment_id=a.id and r.revision=a.revision
 and r.offset_hours=o.hours and r.subscription_id=s.id
 where a.agent_deleted_at is null and a.status='Scheduled'
 and now()>=a.starts_at-make_interval(hours=>o.hours)
 and (case o.hours when 72 then now()<a.starts_at-interval '24 hours'
 when 24 then now()<a.starts_at-interval '4 hours' when 4 then now()<a.starts_at-interval '1 hour'
 when 1 then now()<a.starts_at when -2 then now()<a.starts_at+interval '3 hours'
 when -3 then now()<a.starts_at+interval '4 hours' else now()<a.starts_at+interval '5 hours' end)
 and ((o.hours>0 and a.starts_at>now()) or (o.hours<0 and now()<a.starts_at+interval '5 hours'
 and a.starts_at>=(select activated_at from public.car_reminder_policy where id=1)))
 and a.updated_at<=a.starts_at-make_interval(hours=>o.hours)
 and (r.appointment_id is null or r.state='processing' and r.updated_at<now()-interval '2 minutes'))
 when kind='followup' then exists(
 select 1 from public.car_agent_devices d
 join public.car_push_subscriptions s on s.id=d.subscription_id and s.enabled
 join auth.users u on u.id=d.owner_id
 join public.car_agent_cases c on c.owner_id=d.owner_id
 cross join lateral (select (now() at time zone 'Asia/Kuala_Lumpur')::date as day,
 case when (now() at time zone 'Asia/Kuala_Lumpur')::time>=time '16:00' then 16
 when (now() at time zone 'Asia/Kuala_Lumpur')::time>=time '12:00' then 12
 when (now() at time zone 'Asia/Kuala_Lumpur')::time>=time '08:00' then 8 end as hour) t
 where t.hour is not null and c.agent_deleted_at is null
 and c.status not in('Rejected','Delivered','Cancelled')
 and c.activity_at<=((t.day+make_time(t.hour,0,0)) at time zone 'Asia/Kuala_Lumpur')-interval '72 hours'
 and coalesce(u.raw_app_meta_data->>'pro_disabled','false')<>'true'
 and u.email_confirmed_at is not null and now()<timestamptz '2027-01-01 00:00:00+08'
 and not exists(select 1 from public.car_agent_followup_push p
 where p.subscription_id=d.subscription_id and p.day=t.day and p.slot_hour=t.hour))
 else false end;
$$;
revoke all on function public.car_reminder_work_due(text) from public,anon,authenticated;
grant execute on function public.car_reminder_work_due(text) to service_role;

-- Keep both minute schedules and existing jobs; only replace their dispatch commands.
do $$
declare j record; k text; action text;
begin
 for j in select jobid,jobname from cron.job
 where jobname in('car-loan-pro-appointments','car-loan-pro-followup') loop
 k:=case when j.jobname='car-loan-pro-appointments' then 'appointment' else 'followup' end;
 action:=case when k='appointment' then 'pro-reminders' else 'pro-followup-reminders' end;
 perform cron.alter_job(j.jobid,command:=format($cmd$
 do $dispatch$ begin
 if public.car_reminder_work_due(%L) then
 perform net.http_post(url:=%L,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
 (select decrypted_secret from vault.decrypted_secrets where name='car_pro_reminder_secret')),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
 end if;
 end $dispatch$;
 $cmd$,k,'https://carloanmalaysia.vercel.app/api/app?action='||action));
 end loop;
end;$$;
commit;
