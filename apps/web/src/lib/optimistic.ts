import type { QueryClient } from '@tanstack/react-query';
import type { ApiResponse } from './api';

/**
 * Helpers for optimistic list mutations. Our list queries cache an
 * `ApiResponse<T[]>` envelope (from `api.get<T[]>()`), so these read/write the
 * `.data` array inside it.
 *
 * Pattern per mutation: onMutate → snapshotList (cancel in-flight refetches +
 * snapshot) then patchList (optimistic write); onError → restore the snapshot;
 * onSettled → invalidate so the server truth wins.
 */
export type ListCache<T> = ApiResponse<T[]> | undefined;

/** Cancel in-flight refetches (so they can't clobber the optimistic write) and snapshot the current cache. */
export async function snapshotList<T>(qc: QueryClient, key: readonly unknown[]): Promise<ListCache<T>> {
  await qc.cancelQueries({ queryKey: key });
  return qc.getQueryData<ListCache<T>>(key);
}

/** Apply `fn` to the list inside the cached ApiResponse envelope (no-op if the query isn't cached yet). */
export function patchList<T>(qc: QueryClient, key: readonly unknown[], fn: (list: T[]) => T[]): void {
  qc.setQueryData<ListCache<T>>(key, (old) => (old ? { ...old, data: fn(old.data ?? []) } : old));
}

/** Restore a snapshot taken by snapshotList (used in onError to roll back). */
export function restoreList<T>(qc: QueryClient, key: readonly unknown[], snapshot: ListCache<T>): void {
  if (snapshot !== undefined) qc.setQueryData<ListCache<T>>(key, snapshot);
}
