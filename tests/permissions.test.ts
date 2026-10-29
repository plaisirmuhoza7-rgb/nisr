import {test} from 'node:test';import assert from 'node:assert/strict';
import {assertPermission} from '../src/server/permissions';
test('member cannot approve or read another organization',async()=>{const a={tenantId:'demo',userId:'member',role:'member'} as const;await assert.rejects(assertPermission(a,'group-ubumwe','approve'));await assert.rejects(assertPermission(a,'coop-imena','read'));await assertPermission(a,'group-ubumwe','request');});
test('NGO program affiliation grants no member ledger access',async()=>{const a={tenantId:'demo',userId:'ngo',role:'ngo'} as const;await assertPermission(a,'ngo-imizi','report');await assert.rejects(assertPermission(a,'group-ubumwe','read'));});
test('treasurer cannot authorize emergency loan approval',async()=>{await assert.rejects(assertPermission({tenantId:'demo',userId:'treasurer',role:'treasurer'},'group-ubumwe','approve'));});
