import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepAfterModelChange,validateGroupSchedule} from '../src/lib/group-setup-validation';

test('changing model on review returns to the model-specific date step',()=>{
 assert.equal(stepAfterModelChange(3,'ROTATING','ACCUMULATING'),2);
 assert.equal(stepAfterModelChange(3,'ACCUMULATING','ROTATING'),2);
 assert.equal(stepAfterModelChange(3,'ACCUMULATING','ACCUMULATING'),3);
 assert.equal(stepAfterModelChange(1,'ACCUMULATING','ROTATING'),1);
});
test('Itsinda dates must be complete and in the right order',()=>{
 const d={model:'ACCUMULATING' as const,startDate:'2026-11-01',cycleEndDate:'2027-11-01',shareOutDate:'2027-11-01',rotationOrder:'',memberCount:10};
 assert.equal(validateGroupSchedule(d),null);
 assert.equal(validateGroupSchedule({...d,cycleEndDate:''}),'dates');
 assert.equal(validateGroupSchedule({...d,cycleEndDate:d.startDate}),'dates');
 assert.equal(validateGroupSchedule({...d,shareOutDate:'2027-10-31'}),'dates');
});
test('Ikimina requires distinct recipient names and a payout on or after start',()=>{
 const d={model:'ROTATING' as const,startDate:'2026-11-01',cycleEndDate:'',shareOutDate:'2026-11-01',rotationOrder:'Aline\nJean',memberCount:2};
 assert.equal(validateGroupSchedule(d),null);
 assert.equal(validateGroupSchedule({...d,rotationOrder:'Aline\naline'}),'recipients');
 assert.equal(validateGroupSchedule({...d,rotationOrder:`${'a'.repeat(121)}\nJean`}),'recipients');
 assert.equal(validateGroupSchedule({...d,shareOutDate:'2026-10-01'}),'dates');
});
