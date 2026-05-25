"use client";

import { useState, useEffect, useCallback } from "react";
import { Member, Expense, AppData, CustomAmount } from "@/lib/types";
import { calculate, CalcResult } from "@/lib/calc";
import { encodeData, decodeData } from "@/lib/url";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// --- メンバー管理 ---
function MemberSection({
  members,
  setMembers,
}: {
  members: Member[];
  setMembers: (m: Member[]) => void;
}) {
  const [name, setName] = useState("");
  const [ratio, setRatio] = useState("1");

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMembers([
      ...members,
      { id: genId(), name: trimmed, ratio: parseFloat(ratio) || 1 },
    ]);
    setName("");
    setRatio("1");
  };

  const remove = (id: string) => setMembers(members.filter((m) => m.id !== id));

  const updateRatio = (id: string, val: string) => {
    setMembers(
      members.map((m) =>
        m.id === id ? { ...m, ratio: parseFloat(val) || 1 } : m
      )
    );
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">メンバー</h2>
      <div className="flex gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-[120px]"
          placeholder="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <input
          className="input w-20"
          type="number"
          step="0.1"
          min="0.1"
          placeholder="倍率"
          value={ratio}
          onChange={(e) => setRatio(e.target.value)}
        />
        <button className="btn-primary" onClick={add}>
          追加
        </button>
      </div>
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <div key={m.id} className="tag">
              <span>{m.name}</span>
              {m.ratio !== 1 && (
                <span className="text-xs text-gray-500">x{m.ratio}</span>
              )}
              <input
                className="w-14 text-xs border rounded px-1 py-0.5"
                type="number"
                step="0.1"
                min="0.1"
                value={m.ratio}
                onChange={(e) => updateRatio(m.id, e.target.value)}
              />
              <button
                className="text-red-400 hover:text-red-600 text-sm"
                onClick={() => remove(m.id)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- 支払い登録 ---
function ExpenseSection({
  members,
  expenses,
  setExpenses,
}: {
  members: Member[];
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [useCustom, setUseCustom] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<CustomAmount[]>([]);

  // メンバーが変わったら参加者リセット
  useEffect(() => {
    setParticipantIds(members.map((m) => m.id));
    if (!payerId && members.length > 0) setPayerId(members[0].id);
  }, [members, payerId]);

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
    // カスタム額から除外
    if (participantIds.includes(id)) {
      setCustomAmounts((prev) => prev.filter((c) => c.memberId !== id));
    }
  };

  const setCustomAmount = (memberId: string, val: string) => {
    const num = parseInt(val) || 0;
    setCustomAmounts((prev) => {
      const filtered = prev.filter((c) => c.memberId !== memberId);
      if (num > 0) return [...filtered, { memberId, amount: num }];
      return filtered;
    });
  };

  const add = () => {
    const amt = parseInt(amount);
    if (!title.trim() || !amt || !payerId || participantIds.length === 0) return;
    setExpenses([
      ...expenses,
      {
        id: genId(),
        title: title.trim(),
        amount: amt,
        payerId,
        participantIds: [...participantIds],
        customAmounts: customAmounts.filter((c) =>
          participantIds.includes(c.memberId)
        ),
      },
    ]);
    setTitle("");
    setAmount("");
    setUseCustom(false);
    setCustomAmounts([]);
  };

  const remove = (id: string) =>
    setExpenses(expenses.filter((e) => e.id !== id));

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "?";

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">支払い</h2>
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[120px]"
            placeholder="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="input w-28"
            type="number"
            placeholder="金額"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="input w-28"
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-600">
          負担者:
          <div className="flex flex-wrap gap-1 mt-1">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={participantIds.includes(m.id)}
                  onChange={() => toggleParticipant(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-1 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
          />
          個別に負担額を指定
        </label>

        {useCustom && (
          <div className="space-y-1 pl-2">
            {participantIds.map((id) => (
              <div key={id} className="flex items-center gap-2 text-sm">
                <span className="w-20">{memberName(id)}</span>
                <input
                  className="input w-24"
                  type="number"
                  placeholder="未指定=按分"
                  value={
                    customAmounts.find((c) => c.memberId === id)?.amount ?? ""
                  }
                  onChange={(e) => setCustomAmount(id, e.target.value)}
                />
                <span className="text-xs text-gray-400">
                  空欄=残額を倍率按分
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn-primary" onClick={add}>
          追加
        </button>
      </div>

      {expenses.length > 0 && (
        <div className="space-y-1">
          {expenses.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{e.title}</span>
                <span className="text-gray-500 ml-2">
                  ¥{e.amount.toLocaleString()} ({memberName(e.payerId)}払い)
                </span>
              </div>
              <button
                className="text-red-400 hover:text-red-600"
                onClick={() => remove(e.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- 精算結果 ---
function ResultSection({
  members,
  result,
}: {
  members: Member[];
  result: CalcResult;
}) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  const ratio = (id: string) => members.find((m) => m.id === id)?.ratio ?? 1;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">精算結果</h2>

      {/* 精算アクション */}
      {result.settlements.length > 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <h3 className="font-bold text-blue-800">送金リスト</h3>
          {result.settlements.map((s, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{name(s.fromId)}</span>
              <span className="mx-1">→</span>
              <span className="font-medium">{name(s.toId)}</span>
              <span className="ml-2 font-bold">
                ¥{s.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">精算は不要です</p>
      )}

      {/* 計算過程テーブル */}
      <div className="overflow-x-auto">
        <h3 className="font-bold text-sm mb-2">計算過程</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">支出</th>
              <th className="border px-2 py-1 text-right">合計</th>
              {members.map((m) => (
                <th key={m.id} className="border px-2 py-1 text-right">
                  {m.name}
                  {m.ratio !== 1 && (
                    <span className="text-xs text-gray-400 block">
                      x{m.ratio}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.breakdowns.map((b) => (
              <tr key={b.expense.id}>
                <td className="border px-2 py-1">
                  {b.expense.title}
                  <span className="text-xs text-gray-400 ml-1">
                    ({name(b.expense.payerId)}払)
                  </span>
                </td>
                <td className="border px-2 py-1 text-right">
                  ¥{b.expense.amount.toLocaleString()}
                </td>
                {members.map((m) => {
                  const amt = b.amounts[m.id];
                  const isCustom = b.expense.customAmounts.some(
                    (c) => c.memberId === m.id
                  );
                  return (
                    <td
                      key={m.id}
                      className={`border px-2 py-1 text-right ${
                        isCustom ? "bg-yellow-50" : ""
                      }`}
                    >
                      {amt != null ? `¥${amt.toLocaleString()}` : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* 負担合計 */}
            <tr className="bg-gray-50 font-medium">
              <td className="border px-2 py-1">負担合計</td>
              <td className="border px-2 py-1"></td>
              {members.map((m) => (
                <td key={m.id} className="border px-2 py-1 text-right">
                  ¥{(result.totalBurden[m.id] ?? 0).toLocaleString()}
                </td>
              ))}
            </tr>
            {/* 支払合計 */}
            <tr className="bg-gray-50 font-medium">
              <td className="border px-2 py-1">支払済</td>
              <td className="border px-2 py-1"></td>
              {members.map((m) => (
                <td key={m.id} className="border px-2 py-1 text-right">
                  ¥{(result.totalPaid[m.id] ?? 0).toLocaleString()}
                </td>
              ))}
            </tr>
            {/* 差額 */}
            <tr className="font-bold">
              <td className="border px-2 py-1">差額</td>
              <td className="border px-2 py-1"></td>
              {members.map((m) => {
                const bal = result.balance[m.id] ?? 0;
                return (
                  <td
                    key={m.id}
                    className={`border px-2 py-1 text-right ${
                      bal > 0
                        ? "text-green-600"
                        : bal < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {bal >= 0 ? "+" : ""}¥{bal.toLocaleString()}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-1">
          黄色セル = 個別指定額、それ以外は倍率に基づく按分
        </p>
      </div>
    </section>
  );
}

// --- メインApp ---
export default function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // URL からデータ復元
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const data = decodeData(hash);
      if (data) {
        setMembers(data.members);
        setExpenses(data.expenses);
      }
    }
  }, []);

  const data: AppData = { members, expenses };
  const result =
    members.length > 0 && expenses.length > 0
      ? calculate(members, expenses)
      : null;

  const share = useCallback(() => {
    const encoded = encodeData(data);
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">YesWaliCan</h1>
        <p className="text-sm text-gray-500">
          立替払い精算アプリ - 倍率・個別負担額に対応
        </p>
      </header>

      <MemberSection members={members} setMembers={setMembers} />

      {members.length >= 2 && (
        <ExpenseSection
          members={members}
          expenses={expenses}
          setExpenses={setExpenses}
        />
      )}

      {result && <ResultSection members={members} result={result} />}

      {(members.length > 0 || expenses.length > 0) && (
        <section className="space-y-2">
          <button className="btn-secondary" onClick={share}>
            {copied ? "コピーしました!" : "共有URLをコピー"}
          </button>
          {shareUrl && (
            <p className="text-xs text-gray-400 break-all">{shareUrl}</p>
          )}
        </section>
      )}
    </div>
  );
}
