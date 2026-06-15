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

// 端数 diff（符号付き・整数）を「立替払額が最小の参加者」へ寄せて amounts に加算する。
// 立替払いした人ほど端数を負担しない（立替分の報酬）という考え方。最小立替の参加者が
// 複数いれば負担倍率で按分し、配分の端数は倍率の大きい順に1円ずつ寄せる。
// 立替額が最小の参加者は多くの場合「立替ゼロの人たち」になる。
function allocateRemainder(
  amounts: Record<string, number>,
  participantIds: string[],
  diff: number,
  totalPaid: Record<string, number>,
  memberMap: Map<string, Member>
) {
  if (diff === 0 || participantIds.length === 0) return;

  // 立替払額が最小の参加者を端数の負担者にする
  const minPaid = Math.min(
    ...participantIds.map((id) => totalPaid[id] ?? 0)
  );
  const bearers = participantIds.filter(
    (id) => (totalPaid[id] ?? 0) === minPaid
  );

  const sign = diff > 0 ? 1 : -1;
  const units = Math.abs(diff);

  // 負担者の中は負担倍率で按分（倍率が全てゼロなら均等）
  const ratios = bearers.map((id) => Math.max(0, memberMap.get(id)?.ratio ?? 1));
  const ratioSum = ratios.reduce((a, b) => a + b, 0);
  const w = ratioSum > 0 ? ratios : bearers.map(() => 1);
  const wSum = ratioSum > 0 ? ratioSum : bearers.length;

  const alloc = bearers.map((_, i) => Math.floor((units * w[i]) / wSum));
  let rest = units - alloc.reduce((a, b) => a + b, 0);

  // 配分の端数は負担倍率の大きい順に1円ずつ
  const order = bearers.map((_, i) => i).sort((a, b) => w[b] - w[a]);
  for (const i of order) {
    if (rest <= 0) break;
    alloc[i] += 1;
    rest -= 1;
  }

  bearers.forEach((id, i) => {
    amounts[id] = (amounts[id] ?? 0) + sign * alloc[i];
  });
}

function calcExpenseBreakdown(
  expense: Expense,
  members: Member[],
  totalPaid: Record<string, number>
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
  }

  // 端数調整: 負担額の合計を必ず expense.amount に一致させる。
  // 余り（数円。個別指定額が立替額に満たない場合などはそれ以上）は、
  // 立替払額が最小の参加者へ寄せる（立替払いした人ほど負担しない＝立替の報酬）。
  const currentTotal = Object.values(amounts).reduce((a, b) => a + b, 0);
  const diff = expense.amount - currentTotal;
  if (diff !== 0) {
    allocateRemainder(amounts, expense.participantIds, diff, totalPaid, memberMap);
  }

  return { expense, amounts };
}

function optimizeSettlements(balance: Record<string, number>): Settlement[] {
  // 貪欲法で送金を最小化
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, bal] of Object.entries(balance)) {
    if (bal < 0) debtors.push({ id, amount: -bal });
    else if (bal > 0) creditors.push({ id, amount: bal });
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
    if (debtors[i].amount <= 0) i++;
    if (creditors[j].amount <= 0) j++;
  }

  return settlements;
}

export function calculate(members: Member[], expenses: Expense[]): CalcResult {
  // 立替払額（各メンバーの支払合計）を先に算出し、端数の比例配分に使う
  const totalPaid: Record<string, number> = {};
  for (const m of members) totalPaid[m.id] = 0;
  for (const e of expenses) {
    totalPaid[e.payerId] = (totalPaid[e.payerId] ?? 0) + e.amount;
  }

  const breakdowns = expenses.map((e) =>
    calcExpenseBreakdown(e, members, totalPaid)
  );

  const totalBurden: Record<string, number> = {};
  for (const m of members) totalBurden[m.id] = 0;

  for (const b of breakdowns) {
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
