type Model='ACCUMULATING'|'ROTATING';
type Schedule={model:Model;startDate:string;cycleEndDate:string;shareOutDate:string;rotationOrder:string;memberCount:number};

/** Changing model at review requires rechecking its model-specific fields. */
export function stepAfterModelChange(step:number,previous:Model,next:Model):number {
 return previous===next?step:Math.min(step,2);
}

export function validateGroupSchedule(draft:Schedule):'dates'|'recipients'|null {
 if(!draft.startDate || (draft.model==='ROTATING'
   ? !draft.shareOutDate || draft.shareOutDate<draft.startDate
   : !draft.cycleEndDate || !draft.shareOutDate || draft.cycleEndDate<=draft.startDate || draft.shareOutDate<draft.cycleEndDate)) return 'dates';
 if(draft.model==='ROTATING'){
  const names=draft.rotationOrder.split(/\r?\n/).map(name=>name.trim()).filter(Boolean);
  if(names.length!==draft.memberCount || names.some(name=>name.length>120) || new Set(names.map(name=>name.toLowerCase())).size!==names.length)return 'recipients';
 }
 return null;
}
