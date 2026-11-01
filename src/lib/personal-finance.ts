export function accountTotal(accounts: ReadonlyArray<{balance: number}>): bigint {
  return accounts.reduce((sum, account) => {
    if (!Number.isSafeInteger(account.balance) || account.balance < 0) throw new RangeError('Invalid account balance');
    return sum + BigInt(account.balance);
  }, 0n);
}

export function safeRwf(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError('RWF total exceeds the supported range');
  return Number(value);
}

export function repaymentSchedule(amount: number, months: number, firstDate: string) {
  if (!Number.isSafeInteger(amount) || amount < 1 || !Number.isInteger(months) || months < 1 || months > 120 || amount < months || !/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) throw new RangeError('Invalid repayment plan');
  const first = new Date(`${firstDate}T00:00:00Z`);
  if (Number.isNaN(first.valueOf()) || first.toISOString().slice(0, 10) !== firstDate) throw new RangeError('Invalid first payment date');
  const principal = BigInt(amount), count = BigInt(months);
  return Array.from({length: months}, (_, i) => {
    const monthStart = new Date(first);
    monthStart.setUTCDate(1);
    monthStart.setUTCMonth(first.getUTCMonth() + i);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0);
    const lastDay = monthEnd.getUTCDate();
    monthStart.setUTCDate(Math.min(first.getUTCDate(), lastDay));
    if(monthStart.getUTCFullYear()>9999)throw new RangeError('Repayment dates exceed the supported range');
    return {dueDate: monthStart.toISOString().slice(0,10), amount: safeRwf(principal / count + (BigInt(i) < principal % count ? 1n : 0n))};
  });
}

export function nextRepayment(amount: number, paid: number, months: number, firstDate: string) {
  let applied = BigInt(paid);
  for (const installment of repaymentSchedule(amount, months, firstDate)) {
    const due = BigInt(installment.amount);
    if (applied < due) return {dueDate: installment.dueDate, amount: safeRwf(due - applied)};
    applied -= due;
  }
  return null;
}
