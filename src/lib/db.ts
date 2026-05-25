import { supabase } from "./supabase";
import { AppData } from "./types";

export interface EventRow {
  id: string;
  name: string;
  data: AppData;
  created_at: string;
  updated_at: string;
}

export async function createEvent(
  name: string,
  data: AppData
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("events")
    .insert({ name, data })
    .select("id")
    .single();
  if (error) {
    console.error("createEvent error:", error);
    return null;
  }
  return row.id;
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

export async function updateEvent(
  id: string,
  name: string,
  data: AppData
): Promise<boolean> {
  const { error } = await supabase
    .from("events")
    .update({ name, data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("updateEvent error:", error);
    return false;
  }
  return true;
}
