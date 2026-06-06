import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// Vercel Cron から定期的に叩いて Supabase の無料プランが
// 7日間の無アクティビティで一時停止（pause）されるのを防ぐ。
// Route Handler は Next.js 16 ではデフォルト非キャッシュで、本ハンドラは
// request.headers と DB クエリにアクセスするため毎回リクエスト時に実行される。
export async function GET(request: NextRequest) {
  // CRON_SECRET が設定されている場合のみ認証を要求する。
  // Vercel Cron は自動で Authorization: Bearer <CRON_SECRET> を付与する。
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // 実テーブルへの軽いクエリで DB アクティビティを発生させる。
  const { error } = await supabase.from("events").select("id").limit(1);
  if (error) {
    console.error("keep-alive error:", error);
    return Response.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, at: new Date().toISOString() });
}
