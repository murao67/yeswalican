"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Member, Expense, AppData, CustomAmount } from "@/lib/types";
import { calculate, CalcResult } from "@/lib/calc";
import { createEvent, getEvent, updateEvent } from "@/lib/db";
import { mergeAppData } from "@/lib/merge";
import {
  membersToCSV,
  csvToMembers,
  expensesToCSV,
  csvToExpenses,
  downloadCSV,
  readCSVFile,
} from "@/lib/csv";
import DisclaimerFooter from "./DisclaimerFooter";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// 画面下部に表示するコピー完了トースト
function CopyToast({ label }: { label: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1.5 bg-[var(--foreground)] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none animate-in">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </div>
  );
}

// 共有アイコンのみのコピーボタン（コピー後はトーストで結果を表示）
function CopyIconButton({
  label,
  copiedLabel,
  copied,
  disabled,
  onClick,
}: {
  label: string;
  copiedLabel: string;
  copied: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          copied
            ? "bg-[var(--success)] text-white border-[var(--success)]"
            : "border-[var(--border)] text-[var(--muted)] enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)]"
        }`}
      >
        {copied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
      </button>
      {copied && <CopyToast label={copiedLabel} />}
    </>
  );
}

const IconPencil = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

// --- 初回アクセス時のイベント名登録画面 ---
function OnboardingScreen({
  onCreate,
  saving,
}: {
  onCreate: (name: string) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm card space-y-4 animate-in">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-[var(--accent)]">¥es</span>WaliCan
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              立替精算をかんたんに
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="section-label block">イベント名</label>
            <input
              autoFocus
              className="input w-full"
              placeholder="例: キャンプ in館山 202605"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
              }}
            />
          </div>
          <button
            className="btn-primary w-full"
            disabled={saving || !name.trim()}
            onClick={submit}
          >
            {saving ? "作成中..." : "イベントを作成"}
          </button>
          <p className="text-[11px] text-[var(--muted)] text-center leading-relaxed">
            作成すると、このイベント専用のURLが発行されます。
            <br />
            URLを共有すれば、みんなで立替を登録できます。
          </p>
          <p className="text-[11px] text-[var(--warning)] text-center leading-relaxed">
            URLを知っている人は誰でもアクセスできるようになります。
            <br />
            個人情報などの秘密情報は登録しないようご注意ください。
          </p>
        </div>
      </main>
      <DisclaimerFooter />
    </div>
  );
}

const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

type TabId = "settings" | "expenses" | "result";

// --- 一括登録メニュー（CSV出力／読込） ---
function BulkRegisterMenu({
  onExport,
  onImport,
  hint,
}: {
  onExport: () => void;
  onImport: (file: File) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary text-xs !px-2.5 !py-1 inline-flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
      >
        一括登録
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          {/* 背景クリックで閉じる */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-white border border-[var(--border)] rounded-xl shadow-lg p-3 animate-in text-left">
            <p className="text-xs font-bold mb-1">CSVで一括登録</p>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mb-2.5">
              はじめは<span className="text-[var(--foreground)] font-medium">出力</span>して空のテンプレートを入手し、Excelなどで編集してから<span className="text-[var(--foreground)] font-medium">読込</span>すると一括登録できます。すでに内容があれば、その内容を書き出せます。
            </p>
            {hint && (
              <p className="text-[11px] text-[var(--warning)] leading-relaxed mb-2.5">
                {hint}
              </p>
            )}
            <button
              className="btn-secondary w-full text-xs !py-1.5 mb-1.5 flex items-center justify-center gap-1.5"
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              CSVを出力
            </button>
            <label className="btn-secondary w-full text-xs !py-1.5 flex items-center justify-center gap-1.5 cursor-pointer">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              CSVを読み込む
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                  setOpen(false);
                }}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

// --- 参加者登録 ---
function SettingsSection({
  members,
  setMembers,
}: {
  members: Member[];
  setMembers: (m: Member[]) => void;
}) {
  const [name, setName] = useState("");
  const [ratio, setRatio] = useState("1");
  // 編集中の倍率は文字列のまま保持し、空欄を許容する
  const [ratioDrafts, setRatioDrafts] = useState<Record<string, string>>({});

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
    // 入力中の文字列を保持（空欄や入力途中も許容）
    setRatioDrafts((d) => ({ ...d, [id]: val }));
    const parsed = parseFloat(val);
    // 有効な数値が入力されたときのみメンバーへ反映する
    if (val !== "" && !Number.isNaN(parsed)) {
      setMembers(members.map((m) => (m.id === id ? { ...m, ratio: parsed } : m)));
    }
  };

  const commitRatio = (id: string) => {
    // 編集終了時にドラフトを破棄し、空欄・無効値は確定済みの値（最低1）へ戻す
    setRatioDrafts((d) => {
      if (!(id in d)) return d;
      const rest = { ...d };
      delete rest[id];
      return rest;
    });
    setMembers(members.map((m) => (m.id === id ? { ...m, ratio: m.ratio || 1 } : m)));
  };

  const handleExport = () => downloadCSV(membersToCSV(members), "members.csv");
  const handleImport = async (file: File) => {
    const csv = await readCSVFile(file);
    const imported = csvToMembers(csv, genId);
    if (imported.length > 0) setMembers([...members, ...imported]);
  };

  return (
    <section className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">参加者を登録</p>
        <BulkRegisterMenu onExport={handleExport} onImport={handleImport} />
      </div>
      <div className="card space-y-4">
        <label className="section-label block">参加者名と負担倍率</label>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[120px]"
            placeholder="名前を入力"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
            }}
          />
          <div className="flex items-center gap-1">
            <input
              className="input w-16"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="倍率"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
            />
            <span className="text-sm text-[var(--muted)]">倍</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-accent-soft flex-1" onClick={add}>
            + 参加者を追加
          </button>
        </div>
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
                  value={ratioDrafts[m.id] ?? m.ratio}
                  onChange={(e) => updateRatio(m.id, e.target.value)}
                  onBlur={() => commitRatio(m.id)}
                />
                <span className="text-xs text-[var(--muted)]">倍</span>
                <button
                  className="btn-danger-sm"
                  aria-label="削除"
                  onClick={() => remove(m.id)}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// --- 立替入力フォーム（新規・編集で共通） ---
function ExpenseForm({
  members,
  initial,
  submitLabel,
  submitClassName = "btn-accent-soft",
  onSubmit,
  onCancel,
}: {
  members: Member[];
  initial?: Expense;
  submitLabel: string;
  submitClassName?: string;
  onSubmit: (data: Omit<Expense, "id">) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [payerId, setPayerId] = useState(
    initial?.payerId ?? members[0]?.id ?? ""
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    initial ? [...initial.participantIds] : members.map((m) => m.id)
  );
  const [specifyBearers, setSpecifyBearers] = useState(
    initial ? initial.participantIds.length < members.length : false
  );
  const [useCustom, setUseCustom] = useState(
    initial ? initial.customAmounts.length > 0 : false
  );
  const [customAmounts, setCustomAmounts] = useState<CustomAmount[]>(
    initial ? [...initial.customAmounts] : []
  );

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

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "?";

  const submit = () => {
    const amt = parseInt(amount);
    if (!title.trim() || !amt || !payerId || participantIds.length === 0)
      return;
    onSubmit({
      title: title.trim(),
      amount: amt,
      payerId,
      participantIds: [...participantIds],
      customAmounts: customAmounts.filter((c) =>
        participantIds.includes(c.memberId)
      ),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="section-label mb-1.5 block">支払った人</label>
        <select
          className="input w-full cursor-pointer"
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

      <div>
        <label className="section-label mb-1.5 block">支払った内容</label>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[120px]"
            placeholder="例: 夕食代"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex items-center gap-1">
            <input
              className="input w-28"
              type="number"
              placeholder="金額"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="text-sm text-[var(--muted)]">円</span>
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          <input
            type="checkbox"
            checked={specifyBearers}
            onChange={(e) => {
              const on = e.target.checked;
              setSpecifyBearers(on);
              // オンにしたら全員チェックなし、オフに戻したら全員を負担対象に
              setParticipantIds(on ? [] : members.map((m) => m.id));
            }}
            className="sr-only"
          />
          <span
            className={`w-9 h-5 rounded-full relative transition-all ${
              specifyBearers ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                specifyBearers ? "left-4" : "left-0.5"
              }`}
            />
          </span>
          特定の負担者を指定する
        </label>
      </div>

      {specifyBearers && (
        <div className="animate-in">
          <p className="text-xs text-[var(--muted)] mb-1.5">
            チェックした人で負担します（チェックを外した人は負担しません）
          </p>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <label
                key={m.id}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                  participantIds.includes(m.id)
                    ? "bg-[var(--accent-bg)] border-[var(--accent-light)]"
                    : "bg-white border-[var(--border)] text-[var(--muted)]"
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
      )}

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
          <p className="text-xs text-[var(--warning)] font-medium">
            金額を指定した人は固定額、空欄の人は残額を倍率で按分します
          </p>
          {participantIds.map((id) => (
            <div key={id} className="flex items-center gap-2 text-sm">
              <span className="w-20 font-medium">{memberName(id)}</span>
              <div className="flex items-center gap-1">
                <input
                  className="input w-24 text-sm"
                  type="number"
                  placeholder="自動按分"
                  value={
                    customAmounts.find((c) => c.memberId === id)?.amount ?? ""
                  }
                  onChange={(e) => setCustomAmount(id, e.target.value)}
                />
                <span className="text-xs text-[var(--muted)]">円</span>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <button
              className="btn-secondary text-xs !px-2.5 !py-1 whitespace-nowrap"
              onClick={() => {
                const filled = participantIds
                  .filter((id) => !customAmounts.some((c) => c.memberId === id))
                  .map((id) => ({ memberId: id, amount: 0 }));
                setCustomAmounts([...customAmounts, ...filled]);
              }}
            >
              空欄に0を入力
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button className="btn-secondary flex-1" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button className={`${submitClassName} flex-1`} onClick={submit}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// --- 立替登録 ---
function ExpenseSection({
  members,
  expenses,
  setExpenses,
  onCopyRequest,
  copied,
  saving,
}: {
  members: Member[];
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  onCopyRequest: () => void;
  copied: boolean;
  saving: boolean;
}) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formKey, setFormKey] = useState(0);

  const addExpense = (data: Omit<Expense, "id">) => {
    setExpenses([...expenses, { id: genId(), ...data }]);
    setFormKey((k) => k + 1); // 入力フォームをリセット
  };

  const updateExpense = (data: Omit<Expense, "id">) => {
    if (!editing) return;
    setExpenses(
      expenses.map((e) => (e.id === editing.id ? { ...data, id: editing.id } : e))
    );
    setEditing(null);
  };

  const remove = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    if (editing?.id === id) setEditing(null);
  };

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
        <div className="flex items-center gap-2">
          <p className="text-sm text-[var(--muted)]">立替えた支払いを登録</p>
          <CopyIconButton
            label="登録依頼用の文章をコピー"
            copiedLabel="依頼文をコピーしました！"
            copied={copied}
            disabled={saving || members.length < 2}
            onClick={onCopyRequest}
          />
        </div>
        <BulkRegisterMenu
          onExport={handleExport}
          onImport={handleImport}
          hint="※ 支払者・負担者の列には、参加者登録で登録済みの参加者名を入力してください。"
        />
      </div>

      <div className="card space-y-4">
        {members.length < 2 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">
            「参加者登録」で参加者を2人以上追加してください
          </div>
        ) : (
          <ExpenseForm
            key={formKey}
            members={members}
            submitLabel="+ 立替を追加"
            onSubmit={addExpense}
          />
        )}

        {expenses.length > 0 && (
          <div className="space-y-2">
            {expenses.map((e) => (
            <div
              key={e.id}
              className={`expense-item animate-in ${
                editing?.id === e.id ? "!border-[var(--accent)]" : ""
              }`}
            >
              <div>
                <span className="font-medium">{e.title}</span>
                <span className="text-[var(--muted)] text-sm ml-2">
                  ¥{e.amount.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--muted)] ml-1.5 bg-[var(--background)] px-1.5 py-0.5 rounded">
                  {memberName(e.payerId)} が支払い
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="btn-danger-sm !text-[var(--accent)]"
                  onClick={() => setEditing(e)}
                >
                  編集
                </button>
                <button
                  className="btn-danger-sm"
                  aria-label="削除"
                  onClick={() => remove(e.id)}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
          <div className="text-right text-sm font-medium text-[var(--muted)] pt-1">
            合計: ¥
            {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
          </div>
        </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto p-5 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">立替を編集</h3>
              <button
                className="btn-secondary text-sm !px-3 !py-1"
                onClick={() => setEditing(null)}
              >
                閉じる
              </button>
            </div>
            <ExpenseForm
              members={members}
              initial={editing}
              submitLabel="更新する"
              submitClassName="btn-primary"
              onSubmit={updateExpense}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// --- 精算表テーブル ---
function BreakdownTableInner({
  members,
  result,
  name,
  full,
}: {
  members: Member[];
  result: CalcResult;
  name: (id: string) => string;
  full?: boolean;
}) {
  const truncateTitle = (s: string) =>
    full ? s : s.length > 10 ? s.slice(0, 10) + "..." : s;
  const truncateName = (s: string) =>
    full ? s : s.length > 5 ? s.slice(0, 5) + "..." : s;

  return (
    <table className="result-table">
      <thead>
        <tr>
          <th className="!text-left" rowSpan={2}></th>
          <th rowSpan={2}></th>
          <th
            colSpan={members.length}
            className="!text-center text-xs font-bold"
          >
            あるべき負担額
          </th>
        </tr>
        <tr>
          {members.map((m) => (
            <th key={m.id} className={full ? "" : "max-w-[60px]"}>
              <span className="block truncate" title={m.name}>
                {truncateName(m.name)}
              </span>
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
            <td className={full ? "" : "max-w-[120px]"}>
              <div className="font-medium truncate" title={b.expense.title}>
                {truncateTitle(b.expense.title)}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">
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
                <td key={m.id} className={isCustom ? "!bg-[#fffbeb]" : ""}>
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
          <td>合計</td>
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
        {result.settlements.map((s, i) => (
          <tr key={`settle-${i}`} className="text-[var(--accent)]">
            <td className="text-xs">
              精算: {name(s.fromId)}→{name(s.toId)}
            </td>
            <td></td>
            {members.map((m) => (
              <td key={m.id}>
                {m.id === s.fromId
                  ? `+¥${s.amount.toLocaleString()}`
                  : m.id === s.toId
                  ? `−¥${s.amount.toLocaleString()}`
                  : ""}
              </td>
            ))}
          </tr>
        ))}
        {result.settlements.length > 0 && (
          <tr className="row-balance">
            <td>精算後</td>
            <td></td>
            {members.map((m) => {
              const bal = result.balance[m.id] ?? 0;
              const adj = result.settlements.reduce((sum, s) => {
                if (s.fromId === m.id) return sum + s.amount;
                if (s.toId === m.id) return sum - s.amount;
                return sum;
              }, 0);
              return (
                <td key={m.id} className="!text-[var(--foreground)]">
                  ¥{Math.round(bal + adj).toLocaleString()}
                </td>
              );
            })}
          </tr>
        )}
      </tbody>
    </table>
  );
}

function BreakdownTable({
  members,
  result,
  name,
  exportResultCSV,
}: {
  members: Member[];
  result: CalcResult;
  name: (id: string) => string;
  exportResultCSV: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="section-label">精算表</h3>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs !px-2.5 !py-1"
            onClick={() => setShowModal(true)}
          >
            大きく表示
          </button>
          <button
            className="btn-secondary text-xs !px-2.5 !py-1"
            onClick={exportResultCSV}
          >
            CSV出力
          </button>
        </div>
      </div>
      <div className="overflow-x-auto -mx-1.5">
        <BreakdownTableInner
          members={members}
          result={result}
          name={name}
        />
      </div>
      <p className="text-[11px] text-[var(--muted)] mt-2">
        <span className="inline-block w-2 h-2 bg-[#fffbeb] border border-[#fde68a] rounded-sm mr-1" />
        * = 個別指定額 / それ以外は倍率に基づく自動按分
      </p>

      {/* モーダル */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[90vh] overflow-auto p-6 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">精算表</h3>
              <button
                className="btn-secondary text-sm !px-3 !py-1"
                onClick={() => setShowModal(false)}
              >
                閉じる
              </button>
            </div>
            <BreakdownTableInner
              members={members}
              result={result}
              name={name}
              full
            />
            <p className="text-xs text-[var(--muted)] mt-3">
              <span className="inline-block w-2 h-2 bg-[#fffbeb] border border-[#fde68a] rounded-sm mr-1" />
              * = 個別指定額 / それ以外は倍率に基づく自動按分
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 精算結果 ---
function CopySettlementsButton({
  settlements,
  name,
  eventUrl,
  eventName,
}: {
  settlements: { fromId: string; toId: string; amount: number }[];
  name: (id: string) => string;
  eventUrl?: string;
  eventName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const lines = settlements
      .map((s) => `${name(s.fromId)} → ${name(s.toId)}: ¥${s.amount.toLocaleString()}`);
    if (eventName?.trim()) lines.unshift(`【${eventName.trim()}】`, "");
    if (eventUrl) lines.push("", eventUrl);
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <CopyIconButton
      label="精算方法をテキストでコピー"
      copiedLabel="精算方法をコピーしました！"
      copied={copied}
      onClick={copy}
    />
  );
}

function ResultSection({
  members,
  result,
  eventUrl,
  eventName,
}: {
  members: Member[];
  result: CalcResult | null;
  eventUrl?: string;
  eventName?: string;
}) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max) + "..." : s;

  const exportResultCSV = () => {
    if (!result) return;
    const header = ["支出", "支払者", "合計", ...members.map((m) => m.name)];
    const rows = result.breakdowns.map((b) => [
      b.expense.title,
      name(b.expense.payerId),
      String(b.expense.amount),
      ...members.map((m) => String(b.amounts[m.id] ?? "")),
    ]);
    rows.push([
      "合計", "", "",
      ...members.map((m) => String(result.totalBurden[m.id] ?? 0)),
    ]);
    rows.push([
      "支払済", "", "",
      ...members.map((m) => String(result.totalPaid[m.id] ?? 0)),
    ]);
    rows.push([
      "差額", "", "",
      ...members.map((m) => String(result.balance[m.id] ?? 0)),
    ]);
    for (const s of result.settlements) {
      rows.push([
        `精算: ${name(s.fromId)}→${name(s.toId)}`, "", "",
        ...members.map((m) =>
          m.id === s.fromId
            ? String(s.amount)
            : m.id === s.toId
            ? String(-s.amount)
            : ""
        ),
      ]);
    }
    if (result.settlements.length > 0) {
      rows.push([
        "精算後", "", "",
        ...members.map((m) => {
          const bal = result.balance[m.id] ?? 0;
          const adj = result.settlements.reduce((sum, s) => {
            if (s.fromId === m.id) return sum + s.amount;
            if (s.toId === m.id) return sum - s.amount;
            return sum;
          }, 0);
          return String(Math.round(bal + adj));
        }),
      ]);
    }
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    downloadCSV(csv, "settlement.csv");
  };

  if (!result) {
    return (
      <section className="space-y-4 animate-in">
        <p className="text-sm text-[var(--muted)]">精算結果を確認</p>
        <div className="card">
          <div className="text-center py-12 text-[var(--muted)] text-sm">
            参加者と立替を登録すると精算結果が表示されます
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 animate-in">
      <div className="flex items-center gap-2">
        <p className="text-sm text-[var(--muted)]">精算結果を確認</p>
        {result.settlements.length > 0 && (
          <CopySettlementsButton
            settlements={result.settlements}
            name={name}
            eventUrl={eventUrl}
            eventName={eventName}
          />
        )}
      </div>
      <div className="card space-y-5">
      <div>
        <h3 className="section-label mb-2">精算方法</h3>
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
      </div>

        <BreakdownTable
          members={members}
          result={result}
          name={name}
          exportResultCSV={exportResultCSV}
        />
      </div>
    </section>
  );
}

// --- ステップ ---
const IconPeople = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconExpense = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 10v.01M18 14v.01" />
  </svg>
);

const IconResult = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const STEPS: {
  id: TabId;
  label: string;
  Icon: () => React.ReactElement;
  step: number;
}[] = [
  { id: "settings", label: "参加者登録", Icon: IconPeople, step: 1 },
  { id: "expenses", label: "立替登録", Icon: IconExpense, step: 2 },
  { id: "result", label: "精算結果", Icon: IconResult, step: 3 },
];

// --- メインApp ---
export default function EventApp({ eventId }: { eventId?: string }) {
  const [id, setId] = useState<string | undefined>(eventId);
  const [eventName, setEventName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash === "settings" || hash === "expenses" || hash === "result")
        return hash;
    }
    return "settings";
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!eventId);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  // 楽観ロック用。読み込み or 最後に保存した時点の updated_at を保持する。
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  // 3-wayマージの共通祖先。読み込み or 最後に保存した時点のデータを保持する。
  const [baseData, setBaseData] = useState<AppData>({
    members: [],
    expenses: [],
  });
  // マージでも解決できず保存できなかったときに true（再読み込みを促す）。
  const [conflict, setConflict] = useState(false);

  // 既存イベント読み込み
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const event = await getEvent(eventId);
      if (event) {
        setEventName(event.name);
        setMembers(event.data.members);
        setExpenses(event.data.expenses);
        setBaseUpdatedAt(event.updated_at);
        setBaseData(event.data);
      }
      setLoading(false);
    })();
  }, [eventId]);

  // 現在のタブをURLのハッシュに同期（保存後はページごとに固有のURLになる）
  useEffect(() => {
    if (loading || !id) return;
    window.history.replaceState(null, "", `/e/${id}#${activeTab}`);
  }, [activeTab, id, loading]);

  const data: AppData = { members, expenses };
  const result =
    members.length > 0 && expenses.length > 0
      ? calculate(members, expenses)
      : null;

  // 既存イベントへの保存。楽観ロックで競合を検出し、競合したら最新を取得して
  // 3-wayマージ → 再試行することで、他者の編集を消さずに保存を成立させる。
  // マージ後の内容は画面にも反映する。数回再試行しても保存できなければ false。
  const commitData = useCallback(
    async (
      targetId: string,
      name: string,
      current: AppData
    ): Promise<boolean> => {
      let toSave = current;
      let ancestor = baseData;
      let expected = baseUpdatedAt;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await updateEvent(targetId, name, toSave, expected);
        if (res.ok) {
          setBaseUpdatedAt(res.updatedAt);
          setBaseData(toSave);
          return true;
        }
        if (!res.conflict) return false;
        // 競合: サーバーの最新を取得し、共通祖先・自分・最新の3-wayマージ
        const latest = await getEvent(targetId);
        if (!latest) return false;
        toSave = mergeAppData(ancestor, toSave, latest.data);
        ancestor = latest.data;
        expected = latest.updated_at;
        // マージ結果（他者の編集を含む）を画面へ反映
        setMembers(toSave.members);
        setExpenses(toSave.expenses);
      }
      return false;
    },
    [baseData, baseUpdatedAt]
  );

  const save = useCallback(
    async (nextTab: TabId) => {
      setSaving(true);
      try {
        if (id) {
          const ok = await commitData(id, eventName, data);
          if (!ok) {
            // マージでも解決できなかった場合はタブ遷移せず再読み込みを促す
            setConflict(true);
            return;
          }
        } else {
          const created = await createEvent(eventName, data);
          if (created) {
            setId(created.id);
            setBaseUpdatedAt(created.updatedAt);
            setBaseData(data);
            // 同一コンポーネントを保ったままURLだけ更新（ルート遷移＝再マウントを避ける）
            window.history.replaceState(null, "", `/e/${created.id}#${nextTab}`);
          }
        }
      } finally {
        setSaving(false);
      }
      setActiveTab(nextTab);
    },
    [id, eventName, data, commitData]
  );

  const saveAndCopyUrl = useCallback(
    async (hash?: TabId, message?: string) => {
      setSaving(true);
      // 保存（DB通信）を await してから clipboard.writeText を呼ぶと、
      // iOS Safari などではユーザー操作の許可（transient activation）が
      // 切れて書き込みが無言で失敗し、共有ボタンが無反応になる。
      // そこで保存＋共有文の生成を Promise にまとめ、クリップボードへの
      // 書き込み自体はクリック直後に同期的に開始する。
      const buildShareText = async () => {
        let eventId = id;
        if (eventId) {
          const ok = await commitData(eventId, eventName, data);
          if (!ok) {
            // マージでも解決できなければ共有を中止し、再読み込みを促す
            setConflict(true);
            throw new Error("イベントの保存に失敗しました");
          }
        } else {
          const created = await createEvent(eventName, data);
          if (created) {
            eventId = created.id;
            setId(created.id);
            setBaseUpdatedAt(created.updatedAt);
            setBaseData(data);
            window.history.replaceState(null, "", `/e/${created.id}`);
          }
        }
        if (!eventId) throw new Error("イベントの保存に失敗しました");
        const url = `${window.location.origin}/e/${eventId}${
          hash ? `#${hash}` : ""
        }`;
        const prefix = eventName.trim() ? `【${eventName.trim()}】\n\n` : "";
        return message ? `${prefix}${message}\n${url}` : `${prefix}${url}`;
      };

      try {
        if (typeof ClipboardItem !== "undefined") {
          // write() をクリック直後に同期的に呼ぶことで許可を維持する。
          // テキストは保存完了後に解決される Promise として渡す。
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": buildShareText().then(
                (t) => new Blob([t], { type: "text/plain" })
              ),
            }),
          ]);
        } else {
          await navigator.clipboard.writeText(await buildShareText());
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // 保存またはコピーに失敗した場合はトーストを出さない
      } finally {
        setSaving(false);
      }
    },
    [id, eventName, data, commitData]
  );

  // 初回: イベント名を登録して専用URLを発行 → 参加者登録へ
  const createAndStart = useCallback(async (name: string) => {
    setSaving(true);
    try {
      const created = await createEvent(name, { members: [], expenses: [] });
      if (created) {
        setEventName(name);
        setId(created.id);
        setBaseUpdatedAt(created.updatedAt);
        setBaseData({ members: [], expenses: [] });
        window.history.replaceState(null, "", `/e/${created.id}#settings`);
        setActiveTab("settings");
      }
    } finally {
      setSaving(false);
    }
  }, []);

  // ヘッダーのイベント名を編集して保存
  const commitEventName = useCallback(async () => {
    setEditingName(false);
    if (!id) return;
    const ok = await commitData(id, eventName, data);
    if (!ok) setConflict(true);
  }, [id, eventName, data, commitData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted)]">
        読み込み中...
      </div>
    );
  }

  // 未作成（初回アクセス）はイベント名登録画面を表示
  if (!id) {
    return <OnboardingScreen onCreate={createAndStart} saving={saving} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 競合バナー: 他者が先に更新していて保存できなかったとき */}
      {conflict && (
        <div className="z-20 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <span className="min-w-0">
              他の人がこのイベントを更新しました。最新の内容を読み込んでから操作してください。
            </span>
            <button
              className="shrink-0 underline font-medium"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="block shrink-0"
            >
              <h1 className="text-2xl font-extrabold tracking-tight hover:opacity-80 transition-opacity">
                <span className="text-[var(--accent)]">¥es</span>WaliCan
              </h1>
            </a>
            {editingName ? (
              <input
                autoFocus
                className="text-sm font-medium border border-[var(--border)] rounded px-1.5 py-1 outline-none focus:border-[var(--accent)] min-w-0 flex-1 max-w-[12rem]"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                onBlur={commitEventName}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing)
                    commitEventName();
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                title="クリックして編集"
                className="group inline-flex items-center gap-1 min-w-0 text-sm text-[var(--foreground)] font-medium hover:text-[var(--accent)] transition-colors"
              >
                <span className="truncate">
                  {eventName || "（イベント名未設定）"}
                </span>
                <span className="shrink-0 text-[var(--muted)] opacity-50 group-hover:opacity-100 group-hover:text-[var(--accent)] transition-all">
                  <IconPencil />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Step tabs */}
        <div className="max-w-lg mx-auto px-4">
          <nav className="flex items-stretch">
            {STEPS.map((step, i) => {
              const stepIndex = STEPS.findIndex((s) => s.id === activeTab);
              const isActive = step.id === activeTab;
              const isDone = i < stepIndex;
              return (
                <Fragment key={step.id}>
                  <button
                    className={`flex-1 py-3 text-sm font-bold border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${
                      isActive
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : isDone
                        ? "border-[var(--accent)]/40 text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                    onClick={() => setActiveTab(step.id)}
                  >
                    <step.Icon />
                    {step.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className="flex items-center text-xs text-[var(--muted)] px-0.5 select-none">
                      ›
                    </span>
                  )}
                </Fragment>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-lg mx-auto w-full px-4 pt-5 space-y-4 flex-1">
        {activeTab === "settings" && (
          <SettingsSection members={members} setMembers={setMembers} />
        )}

        {activeTab === "expenses" && (
          <ExpenseSection
            members={members}
            expenses={expenses}
            setExpenses={setExpenses}
            copied={copied}
            saving={saving}
            onCopyRequest={() =>
              saveAndCopyUrl(
                "expenses",
                "ご自身が立替えた支払いを登録してください"
              )
            }
          />
        )}

        {activeTab === "result" && (
          <ResultSection members={members} result={result} eventName={eventName} eventUrl={id ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${id}#result` : undefined} />
        )}

        {/* ナビゲーションボタン */}
        <div className="flex gap-3">
          {activeTab !== "settings" && (
            <button
              className="btn-secondary flex-1"
              onClick={() =>
                setActiveTab(activeTab === "result" ? "expenses" : "settings")
              }
            >
              戻る
            </button>
          )}
          {activeTab !== "result" && (
            <button
              className="btn-accent-soft flex-1 inline-flex items-center justify-center"
              disabled={saving}
              onClick={() => save(activeTab)}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          )}
          {activeTab !== "result" && (
            <button
              className="btn-primary flex-1"
              onClick={() =>
                setActiveTab(activeTab === "settings" ? "expenses" : "result")
              }
            >
              次へ
            </button>
          )}
        </div>
      </main>

      <DisclaimerFooter />
    </div>
  );
}
