const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create schema cron;
      create table cron.job(jobid int,jobname text);
      create table cron.job_run_details(jobid int,status text,end_time timestamptz);
      create table cron.scheduled(command text);
      create function cron.unschedule(text) returns boolean language sql as $$select true$$;
      create function cron.schedule(text,text,text) returns int language sql as $$insert into cron.scheduled values($3) returning 1$$;
      insert into cron.job values(1,'car-loan-pro-appointments'),(2,'unrelated');
      insert into cron.job_run_details values
      (1,'succeeded',now()-interval '31 days'),(1,'succeeded',now()-interval '29 days'),
      (1,'failed',now()-interval '31 days'),(1,'failed',now()-interval '91 days'),
      (2,'succeeded',now()-interval '100 days'),(1,'running',null);`);
    await db.exec(fs.readFileSync('backend/technical-history-retention.sql','utf8'));
    const command=(await db.query('select command from cron.scheduled')).rows[0].command;
    await db.exec(command);
    assert.equal((await db.query('select * from cron.job_run_details')).rows.length,4);
    assert.equal((await db.query("select * from cron.job_run_details where status='failed'")).rows.length,1);
    assert.equal((await db.query('select * from cron.job_run_details where jobid=2')).rows.length,1);
    console.log('PASS technical retention: success 30 days, failure 90 days, preserves running and unrelated jobs.');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
