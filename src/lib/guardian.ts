export interface ScenarioInput {cash:number;reserveBps:number;requests:number;loanAmount:number;contributions:number;expectedRepayments:number;delayBps:number;investment:number;outstandingLoans:number}
export function integer(value:unknown,name='Amount',min=0,max=1_000_000_000_000):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${name} must be a whole number between ${min} and ${max}.`);return value;
}
const safe=(x:bigint)=>{const result=Number(x);if(!Number.isSafeInteger(result))throw new Error('Calculation exceeds the supported amount.');return result;};
export function calculateScenario(input:ScenarioInput){
 for(const name of ['cash','loanAmount','contributions','expectedRepayments','investment','outstandingLoans'] as const)integer(input[name],name);
 integer(input.reserveBps,'Reserve percentage',0,10000);integer(input.delayBps,'Repayment delay',0,10000);integer(input.requests,'Requests',0,1000);
 const reserve=safe((BigInt(input.cash)*BigInt(input.reserveBps)+9999n)/10000n);
 const inflows=input.contributions+safe(BigInt(input.expectedRepayments)*BigInt(10000-input.delayBps)/10000n);
 const newLoans=safe(BigInt(input.requests)*BigInt(input.loanAmount));
 const cashAfter=safe(BigInt(input.cash)+BigInt(inflows)-BigInt(newLoans)-BigInt(input.investment));
 const shortfall=Math.max(0,reserve-cashAfter);
 const lendingCapacity=Math.max(0,cashAfter-reserve);
 const loanExposure=safe(BigInt(input.outstandingLoans)+BigInt(newLoans));
 const status=shortfall>0?'critical':BigInt(lendingCapacity)*4n<BigInt(reserve)?'warning':'healthy';
 const explanation=shortfall>0?`This scenario falls ${shortfall.toLocaleString('en-RW')} RWF below the required reserve. Reduce proposed lending or expenditure, or use confirmed inflows.`:`After the modeled decisions, ${lendingCapacity.toLocaleString('en-RW')} RWF remains above the ${reserve.toLocaleString('en-RW')} RWF reserve. Expected inflows are assumptions, not confirmed money.`;
 return {cashAfter,reserve,lendingCapacity,shortfall,loanExposure,status,explanation,inflows,outflows:newLoans+input.investment,formulas:['Reserve = ceiling(starting cash × reserve basis points ÷ 10,000)','Expected inflows = contributions + floor(expected repayments × (10,000 − delayed basis points) ÷ 10,000)','Ending cash = starting cash + expected inflows − new loans − investment','Lending capacity = max(0, ending cash − reserve)'],assumptions:['Reserve is held against starting cash for this scenario.','All planned lending and expenditure occurs within the modeled period.','Expected contributions and repayments are uncertain.','No interest, fees, earnings or causal impact is assumed.']};
}
export function savingsPlan(target:number,saved:number,periods:number){integer(target,'Target',1);integer(saved,'Saved');integer(periods,'Periods',1,600);return {remaining:Math.max(0,target-saved),perPeriod:safe((BigInt(Math.max(0,target-saved))+BigInt(periods)-1n)/BigInt(periods))};}
export function scenarioPreset(kind:'healthy'|'warning'|'critical'):ScenarioInput {
 return {cash:5000000,reserveBps:2000,requests:kind==='healthy'?3:kind==='warning'?19:20,loanAmount:kind==='critical'?250000:kind==='warning'?200000:150000,contributions:0,expectedRepayments:0,delayBps:0,investment:0,outstandingLoans:150000};
}
export * from './guardian/index';

