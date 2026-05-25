import { Member, Expense } from "./types";

// --- メンバー CSV ---
// 形式: 名前,倍率
export function membersToCSV(members: Member[]): string {
  const header = "名前,倍率";
  const rows = members.map((m) => `${m.name},${m.ratio}`);
  return [header, ...rows].join("\n");
}

export function csvToMembers(csv: string, genId: () => string): Member[] {
  const lines = csv
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // ヘッダー行をスキップ（日本語 or 英語）
  const start = /^名前|^name/i.test(lines[0]) ? 1 : 0;

  return lines.slice(start).map((line) => {
    const parts = line.split(",").map((s) => s.trim());
    return {
      id: genId(),
      name: parts[0] || "???",
      ratio: parseFloat(parts[1]) || 1,
    };
  });
}

// --- 支払い CSV ---
// 形式: タイトル,金額,支払者,負担者(;区切り),個別指定(名前:金額;区切り)
export function expensesToCSV(
  expenses: Expense[],
  members: Member[]
): string {
  const nameMap = new Map(members.map((m) => [m.id, m.name]));
  const header = "タイトル,金額,支払者,負担者,個別指定額";
  const rows = expenses.map((e) => {
    const payer = nameMap.get(e.payerId) ?? "?";
    const participants = e.participantIds
      .map((id) => nameMap.get(id) ?? "?")
      .join(";");
    const custom = e.customAmounts
      .map((c) => `${nameMap.get(c.memberId) ?? "?"}:${c.amount}`)
      .join(";");
    return `${e.title},${e.amount},${payer},${participants},${custom}`;
  });
  return [header, ...rows].join("\n");
}

export function csvToExpenses(
  csv: string,
  members: Member[],
  genId: () => string
): Expense[] {
  const nameToId = new Map(members.map((m) => [m.name, m.id]));
  const lines = csv
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const start = /^タイトル|^title/i.test(lines[0]) ? 1 : 0;

  return lines.slice(start).flatMap((line) => {
    const parts = line.split(",").map((s) => s.trim());
    const title = parts[0];
    const amount = parseInt(parts[1]) || 0;
    const payerId = nameToId.get(parts[2] ?? "");
    if (!title || !amount || !payerId) return [];

    const participantIds = (parts[3] ?? "")
      .split(";")
      .map((n) => nameToId.get(n.trim()))
      .filter((id): id is string => !!id);

    const customAmounts = (parts[4] ?? "")
      .split(";")
      .filter(Boolean)
      .flatMap((pair) => {
        const [name, amt] = pair.split(":");
        const memberId = nameToId.get(name?.trim() ?? "");
        const amount = parseInt(amt) || 0;
        if (!memberId || !amount) return [];
        return [{ memberId, amount }];
      });

    return [
      {
        id: genId(),
        title,
        amount,
        payerId,
        participantIds:
          participantIds.length > 0
            ? participantIds
            : members.map((m) => m.id),
        customAmounts,
      },
    ];
  });
}

// --- ファイル操作ヘルパー ---
export function downloadCSV(content: string, filename: string) {
  const bom = "\uFEFF"; // Excel対応BOM
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
