import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupCreateSchema} from '../src/lib/group-create-schema';

const input={model:'ACCUMULATING',name:'SIMULATED savings group',description:'',location:'Gakenke',contact:'0780000000',administratorLabel:'Demo president',expectedMembers:10,contributionAmount:5000,frequency:'weekly',startDate:'2026-11-01',endDate:'2027-11-01',shareOutDate:'2027-11-01',rotationOrder:[],reserveBps:1000,accepted:true};
test('accepts an Itsinda with ten members, a 5000 RWF contribution and 10% reserve',()=>{
 assert.equal(groupCreateSchema.safeParse(input).success,true);
});
test('invalid fields return useful, specific messages without input values',()=>{
 const result=groupCreateSchema.safeParse({...input,startDate:'',contact:'x',expectedMembers:501});
 assert.equal(result.success,false);
 if(result.success)return;
 const messages=result.error.issues.map(issue=>issue.message);
 assert.ok(messages.includes('Enter a valid start date.'));
 assert.ok(messages.includes('Enter a contact phone number.'));
 assert.ok(messages.includes('Enter no more than 500 members.'));
});
