import { createHash, timingSafeEqual } from "crypto";

// 利用状況の集計 API（/api/internal/metrics）で使う、期間の計算と認証の小さなヘルパー。
// 仕様は p4portal の docs/usage-metrics-api.md（schema_version 1）。
// - 日付は日本時間（UTC+9）で区切る
// - period_end は「昨日（日本時間）」。集計は period_end で終わる、欠けの無い日で数える
// - N 日の期間は period_end の (N-1) 日前から period_end まで

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MetricsWindow {
  start: string; // 含む
  end: string; // 含まない（period_end の翌日 0:00 JST）
}

// 日本時間での日付（YYYY-MM-DD）
export function toJstDate(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// YYYY-MM-DD に日数を足す（負の数で引く）
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// period_end（日本時間の昨日）
export function getPeriodEnd(now: Date): string {
  return addDays(toJstDate(now), -1);
}

// period_end までの N 日間を、timestamptz と比べられる時刻の範囲にする
export function getWindow(periodEnd: string, days: number): MetricsWindow {
  const startDate = addDays(periodEnd, -(days - 1));
  return {
    start: `${startDate}T00:00:00+09:00`,
    end: `${addDays(periodEnd, 1)}T00:00:00+09:00`,
  };
}

// Authorization ヘッダーを METRICS_API_TOKEN と照合する。
// トークンが未設定なら "disabled"（設定し忘れで数字が公開されないように）。
// 比較は長さの違いも漏らさないよう、ハッシュを取ってから timingSafeEqual で行う。
export function checkMetricsAuthorization(
  header: string | null,
  token: string | undefined
): "ok" | "disabled" | "unauthorized" {
  if (!token) return "disabled";
  if (!header) return "unauthorized";
  const expected = createHash("sha256").update(`Bearer ${token}`).digest();
  const actual = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, actual) ? "ok" : "unauthorized";
}
