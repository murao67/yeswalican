import { supabase } from "./supabase";
import { AppData } from "./types";

export interface EventRow {
  id: string;
  name: string;
  data: AppData;
  created_at: string;
  updated_at: string;
}

// 楽観ロックの結果。conflict=true は他者が先に更新していたことを表す。
export type UpdateEventResult =
  | { ok: true; updatedAt: string }
  | { ok: false; conflict: boolean };

export async function createEvent(
  name: string,
  data: AppData
): Promise<{ id: string; updatedAt: string } | null> {
  const { data: row, error } = await supabase
    .from("events")
    .insert({ name, data })
    .select("id, updated_at")
    .single();
  if (error) {
    console.error("createEvent error:", error);
    return null;
  }
  return { id: row.id, updatedAt: row.updated_at };
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const { data: row, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("getEvent error:", error);
    return null;
  }
  return row;
}

/**
 * 楽観ロック付きの更新。
 * expectedUpdatedAt に読み込み時点の updated_at を渡すと、
 * その後に他者が更新していた場合は書き込まずに conflict を返す（上書き防止）。
 * null を渡した場合はロックなしで更新する（互換用）。
 */
export async function updateEvent(
  id: string,
  name: string,
  data: AppData,
  expectedUpdatedAt: string | null
): Promise<UpdateEventResult> {
  const nextUpdatedAt = new Date().toISOString();
  let query = supabase
    .from("events")
    .update({ name, data, updated_at: nextUpdatedAt })
    .eq("id", id);
  if (expectedUpdatedAt !== null) {
    // 読み込み時点から updated_at が変わっていない行だけを更新する
    query = query.eq("updated_at", expectedUpdatedAt);
  }
  const { data: rows, error } = await query.select("updated_at");
  if (error) {
    console.error("updateEvent error:", error);
    return { ok: false, conflict: false };
  }
  if (!rows || rows.length === 0) {
    // 条件に一致する行がない = 他者が先に更新した（競合）
    return { ok: false, conflict: true };
  }
  return { ok: true, updatedAt: rows[0].updated_at };
}
