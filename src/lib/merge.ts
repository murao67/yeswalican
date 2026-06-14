import { AppData } from "./types";

/**
 * id を持つ配列の 3-way マージ。
 *
 * - base:   最後に同期した時点（読み込み or 直近の保存）のスナップショット = 共通祖先
 * - local:  手元（自分）の現在の状態
 * - remote: サーバー上の最新状態（他者の編集を含む）
 *
 * base と比較して「自分が変更した項目」と「他者が変更した項目」を判定し、
 * 片方だけが変更していればその変更を採用、両方が変更していれば下記の方針で解決する。
 *   - 双方削除: 削除
 *   - 片方削除 / 片方編集: データ保全のため編集を残す
 *   - 双方編集（内容が異なる）: 操作中の自分(local)を優先
 * これにより、丸ごと上書きで起きていた「他者の変更が消える」問題を防ぐ。
 */
export function mergeById<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[]
): T[] {
  const baseMap = new Map(base.map((x) => [x.id, x]));
  const localMap = new Map(local.map((x) => [x.id, x]));
  const remoteMap = new Map(remote.map((x) => [x.id, x]));

  const eq = (a?: T, b?: T) => JSON.stringify(a) === JSON.stringify(b);

  // id ごとに採用する値（null = 削除）を決める
  const resolved = new Map<string, T | null>();
  const allIds = new Set<string>([
    ...baseMap.keys(),
    ...localMap.keys(),
    ...remoteMap.keys(),
  ]);

  for (const id of allIds) {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    const inBase = baseMap.has(id);

    if (!inBase) {
      // base に無い = どちらかが新規追加した項目 → 追加を採用（local優先）
      resolved.set(id, (l ?? r) as T);
      continue;
    }

    const localDeleted = !localMap.has(id);
    const remoteDeleted = !remoteMap.has(id);
    const localModified = !localDeleted && !eq(l, b);
    const remoteModified = !remoteDeleted && !eq(r, b);

    if (localDeleted && remoteDeleted) {
      resolved.set(id, null);
    } else if (localDeleted) {
      // 自分が削除。相手が編集していたらデータ保全のため残す
      resolved.set(id, remoteModified ? (r as T) : null);
    } else if (remoteDeleted) {
      resolved.set(id, localModified ? (l as T) : null);
    } else if (localModified) {
      // 双方編集なら local 優先、それ以外は local の変更を採用
      resolved.set(id, l as T);
    } else if (remoteModified) {
      resolved.set(id, r as T);
    } else {
      // どちらも未変更
      resolved.set(id, b as T);
    }
  }

  // 並び順: remote の順を基本に生き残りを並べ、最後に local 側の項目（新規追加や
  // remote で削除されたが残した編集）を local の順で追加する。
  const result: T[] = [];
  const emitted = new Set<string>();
  const push = (id: string) => {
    if (emitted.has(id)) return;
    const v = resolved.get(id);
    if (v) {
      result.push(v);
      emitted.add(id);
    }
  };
  for (const x of remote) push(x.id);
  for (const x of local) push(x.id);
  return result;
}

export function mergeAppData(
  base: AppData,
  local: AppData,
  remote: AppData
): AppData {
  return {
    members: mergeById(base.members, local.members, remote.members),
    expenses: mergeById(base.expenses, local.expenses, remote.expenses),
  };
}
