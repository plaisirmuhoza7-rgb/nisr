import { randomUUID } from 'node:crypto';
import type { Database } from '@/server/db';
import type { Actor } from '@/lib/contracts';
import { DomainError } from '@/server/permissions';

export async function recordPersonalLoanPayment(db: Database, actor: Actor, data: {loanId:string; amount:number; paymentDate:string; reference?:string}) {
 if (!Number.isSafeInteger(data.amount) || data.amount < 1 || data.amount > 1_000_000_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(data.paymentDate) || Number.isNaN(new Date(data.paymentDate+'T00:00:00Z').valueOf()) || new Date(data.paymentDate+'T00:00:00Z').toISOString().slice(0,10)!==data.paymentDate) throw new DomainError('Invalid payment.',400);
 return db.transaction(async tx => {
  const {rows} = await tx.query('SELECT amount,paid_amount FROM personal_loans WHERE id=$1 AND tenant_id=$2 AND user_id=$3 FOR UPDATE',[data.loanId,actor.tenantId,actor.userId]);
  if (!rows.length) throw new DomainError('Loan not found.',404);
  if (data.reference) {
   const existing = await tx.query('SELECT loan_id,amount,payment_date FROM personal_loan_payments WHERE tenant_id=$1 AND user_id=$2 AND reference=$3',[actor.tenantId,actor.userId,data.reference]);
   if (existing.rows.length) {
    const old=existing.rows[0];
    const date=old.payment_date instanceof Date ? old.payment_date.toISOString().slice(0,10) : String(old.payment_date).slice(0,10);
    if (old.loan_id!==data.loanId || BigInt(old.amount as string)!==BigInt(data.amount) || date!==data.paymentDate) throw new DomainError('Payment reference already used.',409);
    return {id:data.loanId, duplicate:true};
   }
  }
  const total=BigInt(rows[0].amount as string), paid=BigInt(rows[0].paid_amount as string), next=paid+BigInt(data.amount);
  if (next>total) throw new DomainError('Payment exceeds the remaining balance.',400);
  const status=next===total?'settled':'partially_paid';
  await tx.query('INSERT INTO personal_loan_payments(id,tenant_id,user_id,loan_id,amount,payment_date,reference) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),actor.tenantId,actor.userId,data.loanId,data.amount,data.paymentDate,data.reference||null]);
  await tx.query('UPDATE personal_loans SET paid_amount=$1,status=$2,updated_at=now() WHERE id=$3 AND tenant_id=$4 AND user_id=$5',[next.toString(),status,data.loanId,actor.tenantId,actor.userId]);
  return {id:data.loanId,status};
 });
}
