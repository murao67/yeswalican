import { addDays, toJstDate } from "@/lib/metrics";

// 利用状況の集計 API の「日ごとの推移」（?series=N）を組み立てる、DB に触らない関数。
// 仕様は p4portal の docs/usage-metrics-api.md の「日ごとの推移（?series=N、任意）」。
// - series は古い日から新しい日の順で、長さは N、最後の要素の date は period_end（昨日）
// - 値はすべて「その日（日本時間）」の数。記録の無い項目は null（0 と区別する）

// ?series= に付けられる日数の上限
export const SERIES_MAX_DAYS = 180;

export interface SeriesItem {
  date: string;
  users_total: number | null;
  new: number | null;
  withdrawn: number | null;
  active: number | null;
  logins: number | null;
  extra: Record<string, number | null>;
}

// ?series= の値を日数にする。付いていなければ null、1〜180 の整数でなければ "invalid"
// （空文字・小数・"abc"・0・181 などはすべて "invalid"）
export function parseSeriesDays(raw: string | null): number | null | "invalid" {
  if (raw === null) return null;
  if (!/^[0-9]+$/.test(raw)) return "invalid";
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days < 1 || days > SERIES_MAX_DAYS) {
    return "invalid";
  }
  return days;
}

// period_end で終わる N 日の日付（YYYY-MM-DD）を、古い日から並べる
export function listSeriesDates(periodEnd: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    addDays(periodEnd, i - (days - 1))
  );
}

// 時刻を日本時間の日付ごとに数える。null・空・日付として読めない値は数えない
export function countByJstDate(
  timestamps: readonly (string | null | undefined)[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const timestamp of timestamps) {
    if (!timestamp) continue;
    const time = new Date(timestamp);
    if (Number.isNaN(time.getTime())) continue;
    const date = toJstDate(time);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

// yeswalican の日ごとの推移。ログインが無いので users_total〜logins はすべて null で、
// extra に、その日に作成されたイベント（created_at）・最後に更新されたイベント（updated_at）の数を入れる。
// createdAts・updatedAts には、少なくとも series の期間の値がすべて入っていること（期間の外の値は無視する）
export function buildYeswalicanSeries(input: {
  periodEnd: string;
  days: number;
  createdAts: readonly (string | null | undefined)[];
  updatedAts: readonly (string | null | undefined)[];
}): SeriesItem[] {
  const createdByDate = countByJstDate(input.createdAts);
  const updatedByDate = countByJstDate(input.updatedAts);
  return listSeriesDates(input.periodEnd, input.days).map((date) => ({
    date,
    users_total: null,
    new: null,
    withdrawn: null,
    active: null,
    logins: null,
    extra: {
      events_created: createdByDate.get(date) ?? 0,
      events_updated: updatedByDate.get(date) ?? 0,
    },
  }));
}
