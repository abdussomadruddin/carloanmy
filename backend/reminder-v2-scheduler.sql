-- Activate only after reminder-v2.sql and the updated API are released.
begin;
select cron.unschedule(jobid) from cron.job where jobname='car-loan-pro-followup';
select cron.schedule('car-loan-pro-followup','* * * * *',$job$
 select net.http_post(url:='https://carloanmalaysia.vercel.app/api/app?action=pro-followup-reminders',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='car_pro_reminder_secret')),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
commit;
