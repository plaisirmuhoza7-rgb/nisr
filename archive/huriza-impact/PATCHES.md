# HURIZA Impact (NGO) Archived Code & Patches

This file contains the exact code snippets removed from the active application when archiving the NGO / HURIZA Impact feature for Phase 2. To re-enable HURIZA Impact, refer to `archive/huriza-impact/README.md` and restore these snippets.

---

## 1. `src/server/finance/service.ts`

### Imports
```typescript
import {
  buildNgoState,
  handleNgoAction,
} from '../ngo/service';
```

### In `financeStateInTransaction`:
```typescript
    if(actor.role==='ngo'&&!options.orgId) {
      await assertPermission(actor,'ngo-imizi','report');
      if(!await hasMembership(sql,actor,'ngo-imizi')) {
        await fillFundState(sql,actor,state);
        return state;
      }
      const groups=(await sql.query("SELECT * FROM finance_orgs WHERE tenant_id=$1 AND kind='group' ORDER BY org_id FOR UPDATE",[actor.tenantId])).rows;
      for(const g of groups) {
        const org=String(g.org_id), t=await treasury(sql,actor.tenantId,org,g);
        state.impact.organizations.push({id:org,name:String(g.name),district:String(g.district),members:num(g.member_count),savings:t.contributions,outstanding:t.outstandingLoans,reportingStatus:'Synthetic demo · reconciled'});
      }
      state.impact.groups=groups.length;
      state.impact.members=sum(state.impact.organizations.map(g=>g.members));
      state.impact.savings=sum(state.impact.organizations.map(g=>g.savings));
      state.impact.loans=sum(state.impact.organizations.map(g=>g.outstanding));
      state.impact.reportingCompleteness=100;
      state.alerts.push({id:'synthetic-impact',kind:'info',message:'Synthetic operational aggregates only. These records do not establish real-world impact.'});
      state.ngoState = await buildNgoState(sql, actor, 'ngo-imizi');
      await fillFundState(sql,actor,state);
      return state;
    }
```

### In `financeAction`:
```typescript
  const ngoActions = new Set([
    'createNgoOrganization','updateNgoProfile','addNgoStaffMember','updateNgoStaffRole',
    'createNgoProgram','createNgoProject','createNgoGrant','createNgoBudgetLine',
    'requestNgoExpense','reviewNgoExpense','approveNgoExpense','confirmNgoExpensePayment',
    'recordNgoActivity','verifyNgoActivity','enrollNgoBeneficiaryCohort',
    'submitNgoFieldVisit','syncOfflineFieldVisits','createNgoIndicator',
    'recordIndicatorObservation','verifyNgoIndicator','resolveDataQualityIssue',
    'generateNgoReportSnapshot','approveNgoReportSnapshot','grantNgoDonorAccess','revokeNgoDonorAccess'
  ]);
  if (ngoActions.has(action)) {
    return db.transaction(async sql => {
      const ngoOrg = input.orgId ?? 'ngo-imizi';
      if (!(await hasMembership(sql, actor, ngoOrg)) && actor.role !== 'ngo') {
        throw new DomainError('You are not an authorized member of this NGO workspace.', 403);
      }
      await handleNgoAction(sql, actor, { ...input, kind: action, orgId: ngoOrg }, async (tx, act, oId, evt, details) => {
        await tx.query(
          `INSERT INTO interventions (id, tenant_id, org_id, title) VALUES ($1, $2, $3, $4)`,
          [id('intv'), act.tenantId, oId, `[NGO_AUDIT:${evt}] ${JSON.stringify(details).slice(0, 180)}`]
        );
      });
      return { ok: true, action, orgId: ngoOrg, synthetic: true };
    });
  }
```

---

## 2. `src/app/api/export/route.ts`

```typescript
 if(type==='impact'&&dataset==='trace'&&state.ngoState){
  rows=[['Trace ID','Donor','Grant','Budget Line','Activity','District','Confirmed Expense RWF','Cohort','Participants','Indicator Code','Observed','Target','Verification','Report Status'],...state.ngoState.impactTraceChains.map(c=>[c.traceId,c.donorName,c.grantTitle,c.budgetLineCode,c.activityTitle,c.activityDistrict,c.confirmedExpenseRwf,c.beneficiaryCohortName,c.participantsReached,c.indicatorCode,c.indicatorObservedValue,c.indicatorTargetValue,c.indicatorVerificationStatus,c.reportStatus])];
 }else if(type==='impact'&&dataset==='meal'&&state.ngoState){
  rows=[['Code','Indicator','Level','Unit','Baseline','Target','Observed','Progress %','Verification','Responsible Officer'],...state.ngoState.indicators.map(i=>[i.code,i.name,i.level,i.unit,i.baselineValue,i.targetValue,i.currentValue,i.progressPercent,i.verificationStatus,i.responsibleOfficer])];
 }else if(type==='impact')rows=[['Organization','District','Members','Recorded savings RWF','Outstanding RWF','Reporting'],...state.impact.organizations.map(x=>[x.name,x.district,x.members,x.savings,x.outstanding,x.reportingStatus])];
```

---

## 3. `src/app/api/actions/route.ts`

```typescript
 }else if(input.action==='addIntervention'){
  await assertPermission(actor,'ngo-imizi','manage');const {title}=z.object({title:z.string().trim().min(3).max(240)}).parse(input);const id=randomUUID();
  await db.transaction(async tx=>{const {rows}=await tx.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 AND role=$4 FOR SHARE',[actor.tenantId,actor.userId,'ngo-imizi',actor.role]);if(!rows.length)throw new DomainError('You are not a member of this program.',403);await tx.query('INSERT INTO interventions(id,tenant_id,org_id,title) VALUES($1,$2,$3,$4)',[id,actor.tenantId,'ngo-imizi',title]);});result={id};
```

---

## 4. `src/app/api/state/route.ts`

```typescript
workspace==='impact'&&user.memberships.some(m=>m.orgId==='ngo-imizi')?db.query('SELECT id,title,created_at FROM interventions WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC',[actor.tenantId,'ngo-imizi']):Promise.resolve({rows:[]}),
```

---

## 5. `src/components/huriza-app.tsx`

```typescript
import { NgoImpactDashboard } from './ngo-impact-dashboard';

// Nav item:
{id:'impact', icon:Activity, groupKey:'organization'},

// Active view rendering:
{active==='impact'&&data&&<NgoImpactDashboard state={data.ngoState} onAction={handleAction} onRefresh={loadState} userRole={data.user.role}/>}
```
