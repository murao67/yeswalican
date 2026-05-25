import { Member, Expense, Settlement } from "./types";

export interface ExpenseBreakdown {
  expense: Expense;
  amounts: Record<string, number>; // memberId -> 負担額
}

export interface CalcResult {
  breakdowns: ExpenseBreakdown[];
  totalBurden: Record<string, number>;  // memberId -> 負担合計
  totalPaid: Record<string, number>;    // memberId -> 支払合計
  balance: Record<string, number>;      // memberId -> 差額 (支払 - 負担, +なら受取側)
  settlements: Settlement[];
}

function calcExpenseBreakdown(
  expense: Expense,
  members: Member[]
): ExpenseBreakdown {
  const amounts: Record<string, number> = {};
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // 個別指定額の合計
  const customMap = new Map(
    expense.customAmounts.map((c) => [c.memberId, c.amount])
  );
  let customTotal = 0;
  for (const c of expense.customAmounts) {
    if (expense.participantIds.includes(c.memberId)) {
      customTotal += c.amount;
      amounts[c.memberId] = c.amount;
    }
  }

  // 残額を倍率按分するメンバー
  const remaining = expense.amount - customTotal;
  const ratioMembers = expense.participantIds.filter(
    (id) => !customMap.has(id)
  );
  const totalRatio = ratioMembers.reduce(
    (sum, id) => sum + (memberMap.get(id)?.ratio ?? 1),
    0
  );

  if (totalRatio > 0 && remaining > 0) {
    for (const id of ratioMembers) {
      const ratio = memberMap.get(id)?.ratio ?? 1;
      amounts[id] = Math.round(remaining * (ratio / totalRatio));
    }
    // 端数調整: 合計が expense.amount に一致するように最後のメンバーで調整
    const currentTotal =
      Object.values(amounts).reduce((a, b) => a + b, 0);
    const diff = expense.amount - currentTotal;
    if (diff !== 0 && ratioMembers.length > 0) {
      const lastId = ratioMembers[ratioMembers.length - 1];
      amounts[lastId] += diff;
    }
  }

  return { expense, amounts };
}

function optimizeSettlements(balance: Record<string, number>): Settlement[] {
  // 貪欲法で送金を最小化
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, bal] of Object.entries(balance)) {
    if (bal < -1) debtors.push({ id, amount: -bal });
    else if (bal > 1) creditors.push({ id, amount: bal });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      settlements.push({
        fromId: debtors[i].id,
        toId: creditors[j].id,
        amount: Math.round(amount),
      });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 1) i++;
    if (creditors[j].amount < 1) j++;
  }

  return settlements;
}

export function calculate(members: Member[], expenses: Expense[]): CalcResult {
  const breakdowns = expenses.map((e) => calcExpenseBreakdown(e, members));

  const totalBurden: Record<string, number> = {};
  const totalPaid: Record<string, number> = {};

  for (const m of members) {
    totalBurden[m.id] = 0;
    totalPaid[m.id] = 0;
  }

  for (const b of breakdowns) {
    totalPaid[b.expense.payerId] =
      (totalPaid[b.expense.payerId] ?? 0) + b.expense.amount;
    for (const [id, amount] of Object.entries(b.amounts)) {
      totalBurden[id] = (totalBurden[id] ?? 0) + amount;
    }
  }

  const balance: Record<string, number> = {};
  for (const m of members) {
    balance[m.id] = (totalPaid[m.id] ?? 0) - (totalBurden[m.id] ?? 0);
  }

  const settlements = optimizeSettlements(balance);

  return { breakdowns, totalBurden, totalPaid, balance, settlements };
}
