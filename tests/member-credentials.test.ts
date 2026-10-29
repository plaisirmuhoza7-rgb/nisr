import test from 'node:test';
import assert from 'node:assert/strict';
import {hashMemberPassword,normalizeRwandaPhone,verifyMemberPassword} from '../src/server/member-credentials';

test('normalizes Rwanda local and international mobile numbers',()=>{
 assert.equal(normalizeRwandaPhone('0781234567'),'+250781234567');
 assert.equal(normalizeRwandaPhone('  +250 78 123 4567  '),'+250781234567');
 assert.equal(normalizeRwandaPhone('079-123-4567'),'+250791234567');
});

test('rejects ambiguous and invalid Rwanda phone formats',()=>{
 for(const phone of ['781234567','250781234567','00250781234567','+25078123456','+250681234567','07812345678','']){
  assert.throws(()=>normalizeRwandaPhone(phone),TypeError,phone);
 }
});

test('hashes and verifies passwords with independent salted scrypt hashes',async()=>{
 const first=await hashMemberPassword('short-member-password');
 const second=await hashMemberPassword('short-member-password');
 assert.match(first,/^scrypt\$v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
 assert.notEqual(first,second);
 assert.equal(await verifyMemberPassword('short-member-password',first),true);
 assert.equal(await verifyMemberPassword('another-password',first),false);
});

test('enforces password length bounds for creation',async()=>{
 await assert.rejects(hashMemberPassword('12345'),/between 6 and 128/);
 await assert.rejects(hashMemberPassword('x'.repeat(129)),/between 6 and 128/);
});

test('malformed or unsupported hashes never verify',async()=>{
 for(const value of ['', 'scrypt$v2$'+'0'.repeat(32)+'$'+'0'.repeat(128), 'scrypt$v1$xyz$00', 'scrypt$v1$'+'0'.repeat(32)+'$'+'0'.repeat(126), 'scrypt$v1$'+'A'.repeat(32)+'$'+'0'.repeat(128), 'x'.repeat(300)]){
  assert.equal(await verifyMemberPassword('any-password',value),false,value);
 }
});
