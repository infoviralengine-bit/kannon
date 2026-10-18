import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite();
const file = readdirSync('supabase/migrations').findLast(name => readFileSync(`supabase/migrations/${name}`, 'utf8').includes('CREATE OR REPLACE FUNCTION public.low_view_video_eligible'));
if (!file) throw new Error('Missing account signals migration');
const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
beforeAll(async () => {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TYPE app_role AS ENUM ('admin','team','campaign_manager','operator','client','creator');
 CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT $2::text = current_setting('test.role',true) $$;
 CREATE TABLE campaigns(id uuid, name text, status text,client_profile_id uuid);
 CREATE TABLE creators(id uuid,profile_id uuid);
 CREATE TABLE tiktok_accounts(id uuid,username text,creator_id uuid,campaign_id uuid);
 CREATE TABLE videos(id uuid,tiktok_account_id uuid,tiktok_video_id text,views integer,published_at timestamptz,last_scraped_at timestamptz);`);
 await db.exec(sql);
}, 30000);
afterAll(() => db.close());
async function eligible(views: number | null, age: string) {
 const r = await db.query<{ ok: boolean }>(`SELECT low_view_video_eligible($1, '2026-10-18 12:00Z'::timestamptz - $2::interval,'2026-10-18 12:00Z') ok`,[views,age]);
 return r.rows[0].ok;
}
describe('account signals SQL', () => {
 it('counts 49 but excludes 50 and unknown views',async () => { expect(await eligible(49,'2 days')).toBe(true); expect(await eligible(50,'2 days')).toBe(false); expect(await eligible(null,'2 days')).toBe(false); });
 it('waits 24 hours exactly',async () => { expect(await eligible(0,'24 hours')).toBe(true); expect(await eligible(0,'23 hours 59 minutes')).toBe(false); });
 it('includes only the last 7 days',async () => { expect(await eligible(0,'7 days')).toBe(true); expect(await eligible(0,'7 days 1 second')).toBe(false); });
 it('caps tiers at three and scopes client, creator and operator access',async () => {
  await db.exec(`SET test.uid='00000000-0000-0000-0000-000000000001'; SET test.role='admin';
  INSERT INTO campaigns VALUES ('10000000-0000-0000-0000-000000000001','Active','active','00000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002','Other','completed','00000000-0000-0000-0000-000000000002');
  INSERT INTO creators VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
  INSERT INTO tiktok_accounts SELECT ('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'account'||i,CASE WHEN i<3 THEN '20000000-0000-0000-0000-000000000001'::uuid ELSE NULL END,CASE WHEN i<3 THEN '10000000-0000-0000-0000-000000000001'::uuid ELSE '10000000-0000-0000-0000-000000000002'::uuid END FROM generate_series(1,4) i;
  INSERT INTO videos SELECT ('40000000-0000-0000-0000-'||lpad((i*10+j)::text,12,'0'))::uuid,('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,(i*10+j)::text,49,now()-interval '2 days',now() FROM generate_series(1,4) i CROSS JOIN LATERAL generate_series(1,i) j;`);
  const read = async () => (await db.query<{ signals: { tier: number; low_count: number }[] }>('SELECT get_account_signals() signals')).rows[0].signals;
  expect((await read()).map(s=>s.tier)).toEqual([3,3,2,1]);
  expect((await read())[0].low_count).toBe(4);
  for (const role of ['client','creator','operator']) { await db.exec(`SET test.role='${role}'`); expect((await read()).map(s=>s.tier)).toEqual([2,1]); }
  await db.exec("SET test.uid=''"); await expect(read()).rejects.toThrow('Forbidden');
 });
});
