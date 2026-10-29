import {randomUUID} from 'node:crypto';
import type {Database} from './db';
import {seedFinance} from './finance/service';
import {orgPermissions} from './permissions';
import type {Role} from '@/lib/contracts';
export const DEMO_USERS=[
 {id:'member',name:'Aline Uwase',email:'member@demo.huriza.test',role:'member'},
 {id:'president',name:'Jean Mugisha',email:'president@demo.huriza.test',role:'president'},
 {id:'treasurer',name:'Diane Keza',email:'treasurer@demo.huriza.test',role:'treasurer'},
 {id:'cooperative',name:'Eric Nkurunziza',email:'cooperative@demo.huriza.test',role:'cooperative'},
 {id:'ngo',name:'Grace Mukamana',email:'ngo@demo.huriza.test',role:'ngo'}
] as const;
export async function ensureSeed(db:Database){
 for(const user of DEMO_USERS)await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[user.id,user.name,user.email,'firebase-managed',user.role]);
}
export async function newDemoTenant(db:Database):Promise<string>{
 const tenantId=randomUUID();
 await db.transaction(async tx=>{
  await tx.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenantId]);
  for(const user of DEMO_USERS) for(const orgId of Object.keys(orgPermissions(user.role as Role))) await tx.query('INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4)',[tenantId,user.id,orgId,user.role]);
  await tx.query('INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),tenantId,'member','School fees · Term one',600000,240000,'2027-01-15']);
  await tx.query('INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),tenantId,'member','Emergency reserve',300000,90000,'2027-04-01']);
  await tx.query('INSERT INTO interventions(id,tenant_id,org_id,title) VALUES($1,$2,$3,$4)',[randomUUID(),tenantId,'ngo-imizi','Treasury transparency workshop · Rwamagana']);
  for(const user of DEMO_USERS) await tx.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[randomUUID(),tenantId,user.id,'Welcome to your private HURIZA demo. All identities and transactions are fictional.']);
 });
 await seedFinance(db,tenantId);
 return tenantId;
}
