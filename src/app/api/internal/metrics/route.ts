import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  checkMetricsAuthorization,
  getPeriodEnd,
  getWindow,
  MetricsWindow,
} from "@/lib/metrics";
import { buildYeswalicanSeries, parseSeriesDays } from "@/lib/metricsSeries";

// Route Handler は Next.js 16 ではデフォルト非キャッシュだが、
// 集計の数字が古いまま返らないよう明示しておく。
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Supabase（PostgREST）が 1 回に返す行数の上限
const PAGE_SIZE = 1000;

// 利用状況の集計（p4apps の統合ダッシュボード・n8n の週次レポートが読む）。
// 認証: Authorization: Bearer <METRICS_API_TOKEN>。未設定なら 503 で何も返さない。
// 応答の形は p4portal の docs/usage-metrics-api.md（schema_version 1）。
// ログインが無いアプリなので users・activity は null で、events の件数だけを extra に入れる。
// ?series=N（1〜180）を付けると、period_end で終わる N 日の日ごとの推移（series）も返す。
export async function GET(request: NextRequest) {
  const auth = checkMetricsAuthorization(
    request.headers.get("authorization"),
    process.env.METRICS_API_TOKEN
  );
  if (auth === "disabled") {
    return Response.json(
      { error: "metrics_disabled" },
      { status: 503, headers: NO_STORE }
    );
  }
  if (auth === "unauthorized") {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  // 認証のあとで ?series= を確かめる（トークンを知らない人に API の形を見せない）
  const seriesDays = parseSeriesDays(request.nextUrl.searchParams.get("series"));
  if (seriesDays === "invalid") {
    return Response.json(
      { error: "invalid_series" },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const now = new Date();
    const periodEnd = getPeriodEnd(now);
    const w7 = getWindow(periodEnd, 7);
    const w30 = getWindow(periodEnd, 30);

    const seriesWindow =
      seriesDays === null ? null : getWindow(periodEnd, seriesDays);

    const [
      total,
      created7d,
      created30d,
      updated7d,
      updated30d,
      seriesCreatedAts,
      seriesUpdatedAts,
    ] = await Promise.all([
      countEvents(),
      countEvents("created_at", w7),
      countEvents("created_at", w30),
      countEvents("updated_at", w7),
      countEvents("updated_at", w30),
      seriesWindow ? listEventTimesInWindow("created_at", seriesWindow) : [],
      seriesWindow ? listEventTimesInWindow("updated_at", seriesWindow) : [],
    ]);

    return Response.json(
      {
        schema_version: 1,
        app: "yeswalican",
        generated_at: now.toISOString(),
        period_end: periodEnd,
        users: null,
        activity: null,
        extra: {
          events_total: total,
          events_created_7d: created7d,
          events_created_30d: created30d,
          events_updated_7d: updated7d,
          events_updated_30d: updated30d,
        },
        notes: [
          "ログインの機能が無いため、ユーザー数・利用者数（users・activity）は null。",
          "events_updated_* は、最後の更新（updated_at）がその期間にあったイベントの数（作成・編集されたイベント）。期間のあとにもう一度更新されたイベントは数えない。",
        ],
        ...(seriesDays === null
          ? {}
          : {
              series: buildYeswalicanSeries({
                periodEnd,
                days: seriesDays,
                createdAts: seriesCreatedAts,
                updatedAts: seriesUpdatedAts,
              }),
            }),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("[metrics] 利用状況の集計に失敗:", error);
    return Response.json(
      { error: "metrics_failed" },
      { status: 500, headers: NO_STORE }
    );
  }
}

// events の件数。column と window を渡すと、その列の時刻が期間内の行だけを数える
async function countEvents(
  column?: "created_at" | "updated_at",
  window?: MetricsWindow
): Promise<number> {
  let query = supabase.from("events").select("id", { count: "exact", head: true });
  if (column && window) {
    query = query.gte(column, window.start).lt(column, window.end);
  }
  const { count, error } = await query;
  if (error) throw new Error(`events の件数取得に失敗: ${error.message}`);
  return count ?? 0;
}

// 期間内に column の時刻があるイベントの、その時刻だけを取る（日ごとに数えるため）。
// 1 回に 1000 行までしか返らないので、尽きるまでページを進める
async function listEventTimesInWindow(
  column: "created_at" | "updated_at",
  window: MetricsWindow
): Promise<string[]> {
  const times: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("events")
      .select(column)
      .gte(column, window.start)
      .lt(column, window.end)
      // ページの切れ目で行が重複・欠落しないよう、一意な id まで含めて並びを固定する
      .order(column, { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`events の取得に失敗: ${error.message}`);
    const rows = (data ?? []) as Record<string, string | null>[];
    for (const row of rows) {
      const time = row[column];
      if (time) times.push(time);
    }
    if (rows.length < PAGE_SIZE) return times;
  }
}
