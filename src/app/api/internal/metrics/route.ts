import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  checkMetricsAuthorization,
  getPeriodEnd,
  getWindow,
  MetricsWindow,
} from "@/lib/metrics";

// Route Handler は Next.js 16 ではデフォルト非キャッシュだが、
// 集計の数字が古いまま返らないよう明示しておく。
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// 利用状況の集計（p4apps の統合ダッシュボード・n8n の週次レポートが読む）。
// 認証: Authorization: Bearer <METRICS_API_TOKEN>。未設定なら 503 で何も返さない。
// 応答の形は p4portal の docs/usage-metrics-api.md（schema_version 1）。
// ログインが無いアプリなので users・activity は null で、events の件数だけを extra に入れる。
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

  try {
    const now = new Date();
    const periodEnd = getPeriodEnd(now);
    const w7 = getWindow(periodEnd, 7);
    const w30 = getWindow(periodEnd, 30);

    const [total, created7d, created30d, updated7d, updated30d] =
      await Promise.all([
        countEvents(),
        countEvents("created_at", w7),
        countEvents("created_at", w30),
        countEvents("updated_at", w7),
        countEvents("updated_at", w30),
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
