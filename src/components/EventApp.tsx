"use client";

import {
  Fragment,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Member, Expense, AppData, CustomAmount } from "@/lib/types";
import { calculate, CalcResult, customAmountsError } from "@/lib/calc";
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

// コピーアイコン（正方形が2つ重なった形）
const IconCopy = () => (
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
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

// 共有ボタン（text でボタン内ラベルを指定。コピー完了トーストはヘッダー直下で一元表示する）
function CopyIconButton({
  label,
  text = "ページを共有",
  copied,
  disabled,
  onClick,
}: {
  label: string;
  text?: string;
  copied: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-7 px-2.5 rounded-lg border inline-flex items-center justify-center gap-1 shrink-0 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        copied
          ? "bg-[var(--success)] text-white border-[var(--success)]"
          : "text-[var(--muted)] border-[var(--border)] enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)]"
      }`}
    >
      <IconCopy />
      {text}
    </button>
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

// --- 削除確認モーダル（参加者・立替の削除で共通利用） ---
function ConfirmModal({
  title,
  message,
  confirmLabel = "削除する",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-5 animate-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-bold text-base mb-2">{title}</h3>
        <div className="text-sm text-[var(--muted)] leading-relaxed mb-5">
          {message}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>
            キャンセル
          </button>
          <button className="btn-danger flex-1" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type TabId = "settings" | "expenses" | "result";

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
  // 削除確認の対象となる参加者（null のときはモーダル非表示）
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);

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

  return (
    <section className="space-y-4 animate-in">
      <p className="text-sm text-[var(--muted)]">参加者を登録</p>
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
                  onClick={() => setPendingDelete(m)}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmModal
          title="参加者を削除"
          message={
            <>
              「<span className="font-medium text-[var(--foreground)]">
                {pendingDelete.name}
              </span>
              」を削除しますか？
            </>
          }
          onConfirm={() => {
            remove(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
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
  const [payerId, setPayerId] = useState(initial?.payerId ?? "");
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

  // 個別指定額の整合性チェック（合わない場合は保存をブロック。CSV取り込みと同じ基準）
  const amt = parseInt(amount) || 0;
  const participantCustoms = customAmounts.filter((c) =>
    participantIds.includes(c.memberId)
  );
  const customError = useCustom
    ? customAmountsError(amt, participantIds, customAmounts)
    : null;

  const submit = () => {
    if (!title.trim() || !amt || !payerId || participantIds.length === 0)
      return;
    if (customError) return; // 個別指定額が立替額と整合しない場合は保存しない
    onSubmit({
      title: title.trim(),
      amount: amt,
      payerId,
      participantIds: [...participantIds],
      customAmounts: useCustom ? participantCustoms : [],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="section-label mb-1.5 block">支払った人</label>
        <select
          className={`input w-full cursor-pointer ${
            payerId === "" ? "text-[var(--muted)]" : ""
          }`}
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
        >
          <option value="" disabled>
            選択してください
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id} className="text-[var(--foreground)]">
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

      {customError && (
        <p className="text-xs text-[var(--danger)] font-medium">
          {customError}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button className="btn-secondary flex-1" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button
          className={`${submitClassName} flex-1 disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={submit}
          disabled={!!customError}
        >
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
  importError,
}: {
  members: Member[];
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  onCopyRequest: () => void;
  copied: boolean;
  saving: boolean;
  importError: string | null;
}) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formKey, setFormKey] = useState(0);
  // 削除確認の対象となる立替（null のときはモーダル非表示）
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

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

  return (
    <section className="space-y-4 animate-in">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">立替えた支払いを登録</p>
        <CopyIconButton
          label="登録依頼用の文章をコピー"
          text="登録を依頼"
          copied={copied}
          disabled={saving || members.length < 2}
          onClick={onCopyRequest}
        />
      </div>

      {importError && (
        <p className="text-xs text-[var(--danger)] font-medium">
          {importError}
        </p>
      )}

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
                  onClick={() => setPendingDelete(e)}
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

      {/* 削除確認モーダル */}
      {pendingDelete && (
        <ConfirmModal
          title="立替を削除"
          message={
            <>
              「<span className="font-medium text-[var(--foreground)]">
                {pendingDelete.title}
              </span>
              」（¥{pendingDelete.amount.toLocaleString()}）を削除しますか？
            </>
          }
          onConfirm={() => {
            remove(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
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

// DOM要素をPNG画像のBlobへ変換する（外部ライブラリ不要）。
// 計算済みスタイルをインライン化したクローンをSVGのforeignObjectに埋め込み、
// canvasへ描画してPNG化する。精算表は画像を含まないためcanvasはtaintされない。
async function elementToPngBlob(node: HTMLElement): Promise<Blob | null> {
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (!width || !height) return null;

  // 外部CSSはforeignObject内に適用されないため、計算済みスタイルを再帰的に
  // インライン化し、不要なclassは取り除いてシリアライズを安定させる。
  const inline = (src: Element, dst: Element) => {
    const cs = window.getComputedStyle(src);
    let css = "";
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      css += `${prop}:${cs.getPropertyValue(prop)};`;
    }
    dst.setAttribute("style", css);
    dst.removeAttribute("class");
    const sc = src.children;
    const dc = dst.children;
    for (let i = 0; i < sc.length; i++) {
      inline(sc[i], dc[i]);
    }
  };

  const clone = node.cloneNode(true) as HTMLElement;
  inline(node, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject>` +
    `</svg>`;
  // データURLを使う（blob:のSVGは一部ブラウザでcanvasをtaintするため）。
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG画像の読み込みに失敗しました"));
    img.src = dataUrl;
  });

  const scale = 2; // 高解像度（Retina相当）で書き出す
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0);

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
}

function BreakdownTable({
  members,
  result,
  name,
}: {
  members: Member[];
  result: CalcResult;
  name: (id: string) => string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  // モーダル内の精算表を画像としてクリップボードへコピー（不可ならダウンロード）
  const copyAsImage = useCallback(async () => {
    const target = captureRef.current;
    if (!target) return;
    let blob: Blob | null = null;
    try {
      blob = await elementToPngBlob(target);
    } catch {
      blob = null;
    }
    if (!blob) return;

    const clipboard = navigator.clipboard;
    try {
      if (
        typeof ClipboardItem !== "undefined" &&
        clipboard &&
        "write" in clipboard
      ) {
        await clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setImageCopied(true);
        setTimeout(() => setImageCopied(false), 2000);
        return;
      }
    } catch {
      // 画像のクリップボード書き込みに非対応／拒否された場合はダウンロードへ
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "精算表.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

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
            className="relative bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[90vh] flex flex-col animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 左上：画像としてコピー（スクロールに関わらず常時表示） */}
            <button
              type="button"
              className="btn-secondary text-xs !px-2.5 !py-1 absolute top-3 left-3 z-10"
              onClick={copyAsImage}
            >
              {imageCopied ? "コピーしました" : "画像としてコピー"}
            </button>
            {/* 右上：閉じる（×・スクロールに関わらず常時表示） */}
            <button
              type="button"
              aria-label="閉じる"
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--accent-bg)] hover:text-[var(--foreground)]"
              onClick={() => setShowModal(false)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {/* スクロール領域（上部のボタンは固定されたまま中身だけスクロール） */}
            <div className="overflow-auto px-6 pb-6 pt-14">
              <div ref={captureRef} className="w-fit bg-white">
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
          </div>
        </div>
      )}
    </div>
  );
}

// 精算方法の共有テキストを組み立てる（セクションのボタンと右上メニューで共用）
function buildSettlementsText({
  settlements,
  name,
  eventUrl,
  eventName,
}: {
  settlements: { fromId: string; toId: string; amount: number }[];
  name: (id: string) => string;
  eventUrl?: string;
  eventName?: string;
}): string {
  const lines = settlements.map(
    (s) => `${name(s.fromId)} → ${name(s.toId)}: ¥${s.amount.toLocaleString()}`
  );
  if (eventName?.trim()) lines.unshift(`【${eventName.trim()}】`, "");
  if (eventUrl) lines.push("", eventUrl);
  return lines.join("\n");
}

// --- 精算結果 ---
function CopySettlementsButton({
  settlements,
  name,
  eventUrl,
  eventName,
  onCopied,
}: {
  settlements: { fromId: string; toId: string; amount: number }[];
  name: (id: string) => string;
  eventUrl?: string;
  eventName?: string;
  onCopied: (label: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = buildSettlementsText({ settlements, name, eventUrl, eventName });
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopied("精算方法をコピーしました！");
    });
  };
  return (
    <CopyIconButton
      label="精算方法をテキストでコピー"
      text="結果を共有"
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
  onCopied,
}: {
  members: Member[];
  result: CalcResult | null;
  eventUrl?: string;
  eventName?: string;
  onCopied: (label: string) => void;
}) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

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
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">精算結果を確認</p>
        {result.settlements.length > 0 && (
          <CopySettlementsButton
            settlements={result.settlements}
            name={name}
            eventUrl={eventUrl}
            eventName={eventName}
            onCopied={onCopied}
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

// 三点リーダ（縦）アイコン。右上のメニューを開くボタンに使う。
const IconKebab = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="12" cy="5" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="12" cy="19" r="1.75" />
  </svg>
);

const IconPlus = () => (
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
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// CSV出力（ダウンロード）アイコン
const IconDownload = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// CSV読み込み（アップロード）アイコン
const IconUpload = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

// 右上メニューの各項目（無効時は理由を title で添える）
function MenuItem({
  icon,
  label,
  disabled,
  disabledHint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm text-[var(--foreground)] transition-colors enabled:hover:bg-[var(--accent-bg)] enabled:hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="shrink-0 text-[var(--muted)]">{icon}</span>
      {label}
    </button>
  );
}

// --- 右上のメニュー（共有文コピー・イベント名編集・CSV入出力・新規作成） ---
function HeaderMenu({
  activeTab,
  onEditName,
  onNewEvent,
  onExportMembers,
  onImportMembers,
  onExportExpenses,
  onImportExpenses,
  onExportResult,
  exportResultDisabled,
}: {
  activeTab: TabId;
  onEditName: () => void;
  onNewEvent: () => void;
  onExportMembers: () => void;
  onImportMembers: (file: File) => void;
  onExportExpenses: () => void;
  onImportExpenses: (file: File) => void;
  onExportResult: () => void;
  exportResultDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  // 選択後はメニューを閉じてから処理を実行する
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  // CSV読み込み用の隠しファイル入力。メニューを閉じても残るよう外側に置く。
  const membersInputRef = useRef<HTMLInputElement>(null);
  const expensesInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        ref={membersInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportMembers(f);
          e.target.value = "";
        }}
      />
      <input
        ref={expensesInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportExpenses(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label="メニュー"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)] transition-colors"
      >
        <IconKebab />
      </button>

      {open && (
        <>
          {/* 背景クリックで閉じる */}
          <div className="fixed inset-0 z-30" onClick={close} />
          <div
            className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-white border border-[var(--border)] rounded-xl shadow-lg p-1.5 animate-in"
            role="menu"
          >
            <MenuItem
              icon={<IconPencil />}
              label="イベント名を編集"
              onClick={run(onEditName)}
            />
            <div className="my-1 border-t border-[var(--border)]" />
            {/* CSV入出力は現在のタブに応じて切り替える */}
            {activeTab === "settings" && (
              <>
                <MenuItem
                  icon={<IconDownload />}
                  label="参加者をCSVで出力"
                  onClick={run(onExportMembers)}
                />
                <MenuItem
                  icon={<IconUpload />}
                  label="参加者をCSVで読み込み"
                  onClick={() => {
                    close();
                    membersInputRef.current?.click();
                  }}
                />
              </>
            )}
            {activeTab === "expenses" && (
              <>
                <MenuItem
                  icon={<IconDownload />}
                  label="立替をCSVで出力"
                  onClick={run(onExportExpenses)}
                />
                <MenuItem
                  icon={<IconUpload />}
                  label="立替をCSVで読み込み"
                  onClick={() => {
                    close();
                    expensesInputRef.current?.click();
                  }}
                />
              </>
            )}
            {activeTab === "result" && (
              <MenuItem
                icon={<IconDownload />}
                label="精算結果をCSVで出力"
                disabled={exportResultDisabled}
                disabledHint="精算結果がまだありません"
                onClick={run(onExportResult)}
              />
            )}
            <div className="my-1 border-t border-[var(--border)]" />
            <MenuItem
              icon={<IconPlus />}
              label="新しいイベントを作成"
              onClick={run(onNewEvent)}
            />
          </div>
        </>
      )}
    </div>
  );
}

// 自動保存の状態。ヘッダーに控えめに表示する。
type SaveStatus = "idle" | "saving" | "saved" | "error";

// 自動保存の要否判定: members/expenses の内容が同一なら保存不要
function sameAppData(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

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
  // コピー完了トースト（セクションのボタン・右上メニュー共通でここに表示）
  const [toast, setToast] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  // CSV取り込み時のエラー（立替の個別指定額が不整合な行があった等）。立替タブで表示する。
  const [importError, setImportError] = useState<string | null>(null);
  // 楽観ロック用。読み込み or 最後に保存した時点の updated_at を保持する。
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  // 3-wayマージの共通祖先。読み込み or 最後に保存した時点のデータを保持する。
  const [baseData, setBaseData] = useState<AppData>({
    members: [],
    expenses: [],
  });
  // マージでも解決できず保存できなかったときに true（再読み込みを促す）。
  const [conflict, setConflict] = useState(false);
  // 自動保存の進捗（ヘッダー表示用）。
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // 自動保存の同時実行を防ぐフラグと、クロージャの陳腐化を避けて
  // 常に最新値を参照するための ref（保存はイベント名＋データをまとめて送る）。
  const savingRef = useRef(false);
  // 保存中に届いた追加変更を取りこぼさないためのフラグ。
  const pendingRef = useRef(false);
  const dataRef = useRef<AppData>({ members: [], expenses: [] });
  const eventNameRef = useRef("");
  const baseDataRef = useRef<AppData>({ members: [], expenses: [] });

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

  const data: AppData = useMemo(
    () => ({ members, expenses }),
    [members, expenses]
  );
  // 自動保存が常に最新値を読めるよう、レンダー後に ref を同期する
  // （レンダー中の ref 書き込みは禁止されているため effect で行う）。
  useEffect(() => {
    dataRef.current = data;
    eventNameRef.current = eventName;
    baseDataRef.current = baseData;
  }, [data, eventName, baseData]);
  const result =
    members.length > 0 && expenses.length > 0
      ? calculate(members, expenses)
      : null;

  // コピー完了トーストを一定時間表示する
  const showToast = useCallback((label: string) => {
    setToast(label);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  // --- CSV入出力（右上メニューから利用） ---
  const exportMembers = () =>
    downloadCSV(membersToCSV(members), "members.csv");
  const importMembers = async (file: File) => {
    const csv = await readCSVFile(file);
    const imported = csvToMembers(csv, genId);
    if (imported.length > 0) {
      setMembers([...members, ...imported]);
      showToast(`${imported.length}人を読み込みました`);
    }
  };
  const exportExpenses = () =>
    downloadCSV(expensesToCSV(expenses, members), "expenses.csv");
  const importExpenses = async (file: File) => {
    const csv = await readCSVFile(file);
    const imported = csvToExpenses(csv, members, genId);
    // 個別指定額が立替額と整合しない行はフォームと同じ基準で弾く
    const invalid = imported.filter(
      (e) =>
        customAmountsError(e.amount, e.participantIds, e.customAmounts) !== null
    );
    if (invalid.length > 0) {
      setImportError(
        `個別指定額が立替額と一致しない立替が${invalid.length}件あります（${invalid
          .map((e) => e.title)
          .join("、")}）。CSVを修正してから取り込んでください。`
      );
      return;
    }
    setImportError(null);
    if (imported.length > 0) {
      setExpenses([...expenses, ...imported]);
      showToast(`${imported.length}件の立替を読み込みました`);
    }
  };
  const exportResultCSV = () => {
    if (!result) return;
    const name = (mid: string) =>
      members.find((m) => m.id === mid)?.name ?? "?";
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

  // 既存イベントへの保存。楽観ロックで競合を検出し、競合したら最新を取得して
  // 3-wayマージ → 再試行することで、他者の編集を消さずに保存を成立させる。
  // マージ後の内容は画面にも反映する。数回再試行しても保存できなければ false。
  const commitData = useCallback(
    async (
      targetId: string,
      name: string,
      current: AppData
    ): Promise<{ ok: boolean; conflict: boolean }> => {
      let toSave = current;
      let ancestor = baseData;
      let expected = baseUpdatedAt;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await updateEvent(targetId, name, toSave, expected);
        if (res.ok) {
          setBaseUpdatedAt(res.updatedAt);
          setBaseData(toSave);
          return { ok: true, conflict: false };
        }
        // 通信・DBエラー（競合ではない）。再試行に任せる。
        if (!res.conflict) return { ok: false, conflict: false };
        // 競合: サーバーの最新を取得し、共通祖先・自分・最新の3-wayマージ
        const latest = await getEvent(targetId);
        if (!latest) return { ok: false, conflict: false };
        toSave = mergeAppData(ancestor, toSave, latest.data);
        ancestor = latest.data;
        expected = latest.updated_at;
        // マージ結果（他者の編集を含む）を画面へ反映
        setMembers(toSave.members);
        setExpenses(toSave.expenses);
      }
      // 数回マージしても競合が解消しなかった。再読み込みを促す。
      return { ok: false, conflict: true };
    },
    [baseData, baseUpdatedAt]
  );

  // 自動保存の実体。イベント名＋データ（参加者・立替）をまとめて保存する。
  // 同時実行は savingRef で防ぎ、最新値は ref から読む。
  // 競合が解消できなかったときだけ再読み込みバナーを出す。通信エラーは
  // ステータスを error にして、次の変更や手動再試行で復帰させる。
  const flushSave = useCallback(async () => {
    if (!id) return;
    // 既に保存中なら、その保存が終わった後に再度保存させる（取りこぼし防止）。
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      do {
        pendingRef.current = false;
        const res = await commitData(id, eventNameRef.current, dataRef.current);
        if (!res.ok) {
          setSaveStatus("error");
          if (res.conflict) setConflict(true);
          break; // 失敗時はここで止め、次の変更／手動再試行に任せる
        }
        setSaveStatus("saved");
      } while (pendingRef.current); // 保存中に更に変更があれば続けて保存
    } finally {
      savingRef.current = false;
    }
  }, [id, commitData]);

  // 参加者・立替の追加/編集/削除を検知して自動保存する。
  // 入力中の連続変更（比率の打鍵など）をまとめるため少し待ってから保存。
  useEffect(() => {
    if (loading || !id) return;
    if (sameAppData(data, baseData)) return; // 変更なしなら何もしない
    const t = setTimeout(() => {
      void flushSave();
    }, 800);
    return () => clearTimeout(t);
  }, [data, baseData, id, loading, flushSave]);

  // debounce 待機中にタブを閉じる/離れると直前の変更が飛ぶため、
  // 離脱直前に未保存分を保存しておく。
  useEffect(() => {
    if (!id) return;
    const flushIfDirty = () => {
      if (!sameAppData(dataRef.current, baseDataRef.current)) void flushSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushIfDirty();
    };
    window.addEventListener("pagehide", flushIfDirty);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushIfDirty);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [id, flushSave]);

  const saveAndCopyUrl = useCallback(
    async (hash?: TabId, message?: string, toastLabel = "コピーしました！") => {
      setSaving(true);
      // 保存（DB通信）を await してから clipboard.writeText を呼ぶと、
      // iOS Safari などではユーザー操作の許可（transient activation）が
      // 切れて書き込みが無言で失敗し、共有ボタンが無反応になる。
      // そこで保存＋共有文の生成を Promise にまとめ、クリップボードへの
      // 書き込み自体はクリック直後に同期的に開始する。
      const buildShareText = async () => {
        let eventId = id;
        if (eventId) {
          const res = await commitData(eventId, eventName, data);
          if (!res.ok) {
            // 解決できなければ共有を中止。競合なら再読み込みを促す。
            if (res.conflict) setConflict(true);
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
        showToast(toastLabel);
      } catch {
        // 保存またはコピーに失敗した場合はトーストを出さない
      } finally {
        setSaving(false);
      }
    },
    [id, eventName, data, commitData, showToast]
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

  // ヘッダーのイベント名を編集して保存（参加者・立替と同じ自動保存に委ねる）
  const commitEventName = useCallback(() => {
    setEditingName(false);
    void flushSave();
  }, [flushSave]);

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
              <span className="truncate min-w-0 text-sm text-[var(--foreground)] font-medium">
                {eventName || "（イベント名未設定）"}
              </span>
            )}
          </div>
          {/* 自動保存ステータス＋メニュー */}
          <div className="shrink-0 flex items-center gap-1">
            <div className="text-xs" aria-live="polite">
              {saveStatus === "saving" && (
                <span className="text-[var(--muted)]">保存中…</span>
              )}
              {saveStatus === "saved" && (
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--success)]">
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
                  保存しました
                </span>
              )}
              {saveStatus === "error" &&
                (conflict ? (
                  <span className="text-red-600">保存できません</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void flushSave()}
                    className="text-red-600 underline"
                  >
                    保存に失敗 · 再試行
                  </button>
                ))}
            </div>
            <HeaderMenu
              activeTab={activeTab}
              onEditName={() => setEditingName(true)}
              onNewEvent={() => {
                window.location.href = "/";
              }}
              onExportMembers={exportMembers}
              onImportMembers={importMembers}
              onExportExpenses={exportExpenses}
              onImportExpenses={importExpenses}
              onExportResult={exportResultCSV}
              exportResultDisabled={!result}
            />
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
                    onClick={() => {
                      setActiveTab(step.id);
                      setImportError(null);
                    }}
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
            importError={importError}
            onCopyRequest={() =>
              saveAndCopyUrl(
                "expenses",
                "ご自身が立替えた支払いを登録してください",
                "依頼文をコピーしました！"
              )
            }
          />
        )}

        {activeTab === "result" && (
          <ResultSection members={members} result={result} eventName={eventName} eventUrl={id ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${id}#result` : undefined} onCopied={showToast} />
        )}
      </main>

      <DisclaimerFooter />

      {/* コピー完了トースト（セクションのボタン・右上メニュー共通） */}
      {toast && <CopyToast label={toast} />}
    </div>
  );
}
