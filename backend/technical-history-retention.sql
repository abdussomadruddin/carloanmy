-- Technical cron history only. Never delete business, delivery or reminder claims:
-- those claims prevent duplicate notifications.
begin;
do $$
begin
 if exists(select 1 from cron.job where jobname='car-loan-technical-history-retention') then
   perform cron.unschedule('car-loan-technical-history-retention');
 end if;
end;$$;
-- Daily 03:15 Malaysia (19:15 UTC). Keep failures longer for diagnosis.
select cron.schedule('car-loan-technical-history-retention','15 19 * * *',$job$
 delete from cron.job_run_details
 where jobid in(select jobid from cron.job where jobname in
 ('car-loan-pro-appointments','car-loan-pro-followup','car-loan-technical-history-retention'))
 and ((status='succeeded' and end_time<now()-interval '30 days')
 or (status='failed' and end_time<now()-interval '90 days'));
$job$);
commit;
