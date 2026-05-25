"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Member, Expense, AppData, CustomAmount } from "@/lib/types";
import { calculate, CalcResult } from "@/lib/calc";
import { createEvent, getEvent, updateEvent } from "@/lib/db";
import {
  membersToCSV,
  csvToMembers,
  expensesToCSV,
  csvToExpenses,
  downloadCSV,
  readCSVFile,
} from "@/lib/csv";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

type TabId = "settings" | "expenses" | "result";

// --- CSV Buttons ---
function CSVButtons({
  onExport,
  onImport,
}: {
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        className="btn-secondary text-xs !px-2.5 !py-1"
        onClick={onExport}
      >
        CSV出力
      </button>
      <label className="btn-secondary text-xs !px-2.5 !py-1 cursor-pointer">
        CSV読込
        <input
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

// --- 基本設定 ---
function SettingsSection({
  eventName,
  setEventName,
  members,
  setMembers,
}: {
  eventName: string;
  setEventName: (n: string) => void;
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

  const remove = (id: string) =>
    setMembers(members.filter((m) => m.id !== id));

  const updateRatio = (id: string, val: string) => {
    setMembers(
      members.map((m) =>
        m.id === id ? { ...m, ratio: parseFloat(val) || 1 } : m
      )
    );
  };

  const handleExport = () => downloadCSV(membersToCSV(members), "members.csv");
  const handleImport = async (file: File) => {
    const csv = await readCSVFile(file);
    const imported = csvToMembers(csv, genId);
    if (imported.length > 0) setMembers([...members, ...imported]);
  };

  return (
    <section className="space-y-4 animate-in">
      <div>
        <label className="section-label mb-1.5 block">イベント名</label>
        <input
          className="input w-full"
          placeholder="例: 沖縄旅行 2026"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <hr className="border-[var(--border)]" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">参加者と負担倍率を設定</p>
        <CSVButtons onExport={handleExport} onImport={handleImport} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-[120px]"
          placeholder="名前を入力"
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
      <p className="text-xs text-[var(--muted)]">
        倍率: 大人=1.0、子ども=0.5 など。負担額が倍率に比例します
      </p>
      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="tag">
              <span className="font-medium flex-1">{m.name}</span>
              <span className="text-xs text-[var(--muted)]">x</span>
              <input
                className="w-12 text-xs border border-[var(--border)] rounded-md px-1.5 py-0.5 text-center focus:border-[var(--accent)] outline-none"
                type="number"
                step="0.1"
                min="0.1"
                value={m.ratio}
                onChange={(e) => updateRatio(m.id, e.target.value)}
              />
              <button className="btn-danger-sm" onClick={() => remove(m.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- 立替登録 ---
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

  useEffect(() => {
    setParticipantIds(members.map((m) => m.id));
    if (!payerId && members.length > 0) setPayerId(members[0].id);
  }, [members, payerId]);

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
    if (participantIds.includes(id)) {
      setCustomAmounts((prev) => prev.filter((c) => c.memberId !== id));
    }
  };

  const setCustomAmount = (memberId: string, val: string) => {
    setCustomAmounts((prev) => {
      const filtered = prev.filter((c) => c.memberId !== memberId);
      if (val === "") return filtered;
      return [...filtered, { memberId, amount: parseInt(val) || 0 }];
    });
  };

  const add = () => {
    const amt = parseInt(amount);
    if (!title.trim() || !amt || !payerId || participantIds.length === 0)
      return;
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

  const handleExport = () =>
    downloadCSV(expensesToCSV(expenses, members), "expenses.csv");
  const handleImport = async (file: File) => {
    const csv = await readCSVFile(file);
    const imported = csvToExpenses(csv, members, genId);
    if (imported.length > 0) setExpenses([...expenses, ...imported]);
  };

  return (
    <section className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">立替えた支払いを記録</p>
        <CSVButtons onExport={handleExport} onImport={handleImport} />
      </div>

      {members.length < 2 ? (
        <div className="text-center py-8 text-[var(--muted)] text-sm">
          基本設定でメンバーを2人以上追加してください
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-[120px]"
              placeholder="例: 夕食代"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)] pointer-events-none">
                ¥
              </span>
              <input
                className="input w-28 pl-7"
                type="number"
                placeholder="金額"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="section-label mb-1.5 block">支払った人</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button
                  key={m.id}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                    payerId === m.id
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                      : "bg-white border-[var(--border)] hover:border-[var(--accent-light)]"
                  }`}
                  onClick={() => setPayerId(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="section-label mb-1.5 block">負担する人</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                    participantIds.includes(m.id)
                      ? "bg-[var(--accent-bg)] border-[var(--accent-light)]"
                      : "bg-white border-[var(--border)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={participantIds.includes(m.id)}
                    onChange={() => toggleParticipant(m.id)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs transition-all ${
                      participantIds.includes(m.id)
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {participantIds.includes(m.id) && "✓"}
                  </span>
                  {m.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`w-9 h-5 rounded-full relative transition-all ${
                  useCustom ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    useCustom ? "left-4" : "left-0.5"
                  }`}
                />
              </span>
              個別に負担額を指定する
            </label>
          </div>

          {useCustom && (
            <div className="space-y-2 bg-[#fffbeb] border border-[#fde68a] rounded-xl p-3 animate-in">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--warning)] font-medium">
                  金額を指定した人は固定額、空欄の人は残額を倍率で按分します
                </p>
                <button
                  className="btn-secondary text-xs !px-2.5 !py-1 whitespace-nowrap"
                  onClick={() => {
                    const filled = participantIds
                      .filter(
                        (id) =>
                          !customAmounts.some((c) => c.memberId === id)
                      )
                      .map((id) => ({ memberId: id, amount: 0 }));
                    setCustomAmounts([...customAmounts, ...filled]);
                  }}
                >
                  空欄に0を入力
                </button>
              </div>
              {participantIds.map((id) => (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <span className="w-20 font-medium">{memberName(id)}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] pointer-events-none">
                      ¥
                    </span>
                    <input
                      className="input w-28 pl-7 text-sm"
                      type="number"
                      placeholder="自動按分"
                      value={
                        customAmounts.find((c) => c.memberId === id)?.amount ??
                        ""
                      }
                      onChange={(e) => setCustomAmount(id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn-primary w-full" onClick={add}>
            + 立替を追加
          </button>
        </div>
      )}

      {expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="expense-item animate-in">
              <div>
                <span className="font-medium">{e.title}</span>
                <span className="text-[var(--muted)] text-sm ml-2">
                  ¥{e.amount.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--muted)] ml-1.5 bg-[var(--background)] px-1.5 py-0.5 rounded">
                  {memberName(e.payerId)} が支払い
                </span>
              </div>
              <button className="btn-danger-sm" onClick={() => remove(e.id)}>
                ✕
              </button>
            </div>
          ))}
          <div className="text-right text-sm font-medium text-[var(--muted)] pt-1">
            合計: ¥
            {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
          </div>
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
  result: CalcResult | null;
}) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  if (!result) {
    return (
      <section className="animate-in">
        <div className="text-center py-12 text-[var(--muted)] text-sm">
          基本設定と立替を登録すると精算結果が表示されます
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 animate-in">
      {result.settlements.length > 0 ? (
        <div className="space-y-2">
          {result.settlements.map((s, i) => (
            <div key={i} className="settlement-card animate-in">
              <span className="font-semibold">{name(s.fromId)}</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-[var(--accent)] shrink-0"
              >
                <path
                  d="M4 10h12m0 0l-4-4m4 4l-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-semibold">{name(s.toId)}</span>
              <span className="ml-auto text-lg font-bold text-[var(--accent)]">
                ¥{s.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-[var(--muted)] text-sm">
          精算は不要です
        </div>
      )}

      <div>
        <h3 className="section-label mb-2">計算過程</h3>
        <div className="overflow-x-auto -mx-1.5">
          <table className="result-table">
            <thead>
              <tr>
                <th className="!text-left">支出</th>
                <th>合計</th>
                {members.map((m) => (
                  <th key={m.id}>
                    <span className="block">{m.name}</span>
                    {m.ratio !== 1 && (
                      <span className="text-[10px] font-normal text-[var(--muted)]">
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
                  <td>
                    <div className="font-medium">{b.expense.title}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {name(b.expense.payerId)} が支払い
                    </div>
                  </td>
                  <td className="font-medium">
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
                        className={isCustom ? "!bg-[#fffbeb]" : ""}
                      >
                        {amt != null ? (
                          <span>
                            ¥{amt.toLocaleString()}
                            {isCustom && (
                              <span className="text-[10px] text-[var(--warning)] ml-0.5">
                                *
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="row-summary">
                <td>負担合計</td>
                <td></td>
                {members.map((m) => (
                  <td key={m.id}>
                    ¥{(result.totalBurden[m.id] ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr className="row-summary">
                <td>支払済</td>
                <td></td>
                {members.map((m) => (
                  <td key={m.id}>
                    ¥{(result.totalPaid[m.id] ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr className="row-balance">
                <td>差額</td>
                <td></td>
                {members.map((m) => {
                  const bal = result.balance[m.id] ?? 0;
                  return (
                    <td
                      key={m.id}
                      className={
                        bal > 0
                          ? "!text-[var(--success)]"
                          : bal < 0
                          ? "!text-[var(--danger)]"
                          : ""
                      }
                    >
                      {bal >= 0 ? "+" : ""}¥{bal.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--muted)] mt-2">
          <span className="inline-block w-2 h-2 bg-[#fffbeb] border border-[#fde68a] rounded-sm mr-1" />
          * = 個別指定額 / それ以外は倍率に基づく自動按分
        </p>
      </div>
    </section>
  );
}

// --- ステップ ---
const STEPS: { id: TabId; label: string; step: number }[] = [
  { id: "settings", label: "基本設定", step: 1 },
  { id: "expenses", label: "立替登録", step: 2 },
  { id: "result", label: "精算結果", step: 3 },
];

// --- メインApp ---
export default function EventApp({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const [id, setId] = useState<string | undefined>(eventId);
  const [eventName, setEventName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("settings");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!eventId);
  const [copied, setCopied] = useState(false);

  // 既存イベント読み込み
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const event = await getEvent(eventId);
      if (event) {
        setEventName(event.name);
        setMembers(event.data.members);
        setExpenses(event.data.expenses);
      }
      setLoading(false);
    })();
  }, [eventId]);

  const data: AppData = { members, expenses };
  const result =
    members.length > 0 && expenses.length > 0
      ? calculate(members, expenses)
      : null;

  const save = useCallback(
    async (nextTab: TabId) => {
      setSaving(true);
      try {
        if (id) {
          await updateEvent(id, eventName, data);
        } else {
          const newId = await createEvent(eventName, data);
          if (newId) {
            setId(newId);
            router.replace(`/e/${newId}`);
          }
        }
      } finally {
        setSaving(false);
      }
      setActiveTab(nextTab);
    },
    [id, eventName, data, router]
  );

  const saveAndCopyUrl = useCallback(async () => {
    setSaving(true);
    try {
      let eventId = id;
      if (eventId) {
        await updateEvent(eventId, eventName, data);
      } else {
        const newId = await createEvent(eventName, data);
        if (newId) {
          eventId = newId;
          setId(newId);
          router.replace(`/e/${newId}`);
        }
      }
      if (eventId) {
        const url = `${window.location.origin}/e/${eventId}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [id, eventName, data, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted)]">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-[var(--accent)]">Yes</span>WaliCan
            </h1>
            {eventName ? (
              <p className="text-[11px] text-[var(--foreground)] font-medium -mt-0.5">
                {eventName}
              </p>
            ) : (
              <p className="text-[11px] text-[var(--muted)] -mt-0.5">
                立替精算をかんたんに
              </p>
            )}
          </div>
          <button
            className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
              copied
                ? "bg-[var(--success)] text-white border-[var(--success)]"
                : "border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            }`}
            disabled={saving}
            onClick={saveAndCopyUrl}
          >
            {copied ? "✓ コピー!" : saving ? "保存中..." : "🔗 保存してURLをコピー"}
          </button>
        </div>

        {/* Stepper */}
        <div className="max-w-lg mx-auto px-6 pt-2 pb-3">
          <nav className="flex items-center">
            {STEPS.map((step, i) => {
              const stepIndex = STEPS.findIndex((s) => s.id === activeTab);
              const isActive = step.id === activeTab;
              const isDone = i < stepIndex;
              const count =
                step.id === "settings"
                  ? members.length
                  : step.id === "expenses"
                  ? expenses.length
                  : 0;
              return (
                <div
                  key={step.id}
                  className="flex items-center flex-1 last:flex-none"
                >
                  <button
                    className="flex flex-col items-center gap-1 group"
                    onClick={() => setActiveTab(step.id)}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        isActive
                          ? "bg-[var(--accent)] text-white shadow-md"
                          : isDone
                          ? "bg-[var(--accent)] text-white opacity-60"
                          : "bg-[var(--border)] text-[var(--muted)] group-hover:bg-[var(--accent-bg)] group-hover:text-[var(--accent)]"
                      }`}
                    >
                      {isDone ? "✓" : step.step}
                    </span>
                    <span
                      className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "text-[var(--accent)]"
                          : isDone
                          ? "text-[var(--foreground)]"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {step.label}
                      {count > 0 && (
                        <span className="ml-1 text-[10px] bg-[var(--accent-bg)] text-[var(--accent)] px-1 py-0.5 rounded-full">
                          {count}
                        </span>
                      )}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-18px] rounded transition-colors ${
                        i < stepIndex
                          ? "bg-[var(--accent)] opacity-60"
                          : "bg-[var(--border)]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <div className="card">
          {activeTab === "settings" && (
            <SettingsSection
              eventName={eventName}
              setEventName={setEventName}
              members={members}
              setMembers={setMembers}
            />
          )}

          {activeTab === "expenses" && (
            <ExpenseSection
              members={members}
              expenses={expenses}
              setExpenses={setExpenses}
            />
          )}

          {activeTab === "result" && (
            <ResultSection members={members} result={result} />
          )}
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex gap-3">
          {activeTab !== "settings" && (
            <button
              className="btn-secondary flex-1"
              onClick={() =>
                setActiveTab(activeTab === "result" ? "expenses" : "settings")
              }
            >
              ← 戻る
            </button>
          )}
          {activeTab !== "result" && (
            <button
              className="btn-primary flex-1"
              disabled={saving}
              onClick={() =>
                save(activeTab === "settings" ? "expenses" : "result")
              }
            >
              {saving
                ? "保存中..."
                : `保存して次へ →`}
            </button>
          )}
          {activeTab === "result" && (
            <button
              className="btn-primary flex-1"
              disabled={saving}
              onClick={() => save("result")}
            >
              {saving ? "保存中..." : "保存する"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
