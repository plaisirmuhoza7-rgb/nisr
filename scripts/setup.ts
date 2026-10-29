import {getDb} from '../src/server/db';
import {ensureSeed,newDemoTenant} from '../src/server/seed';
async function main(){const db=await getDb();try{await ensureSeed(db);const id=await newDemoTenant(db);console.log('PostgreSQL migrations and balanced fictional seed complete. Sample tenant:',id);}finally{await db.close?.();}}
main().catch(error=>{console.error(error);process.exitCode=1;});
