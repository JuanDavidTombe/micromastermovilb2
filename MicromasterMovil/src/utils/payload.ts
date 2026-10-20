import type { LoginResponse, User } from '@/types/models';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function pickToken(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const nested = isRecord(data.data) ? data.data : null;
  const token =
    data.token ??
    data.access_token ??
    data.accessToken ??
    nested?.token ??
    nested?.access_token ??
    nested?.accessToken;
  return typeof token === 'string' ? token : null;
}

export function pickUser(data: unknown): User | null {
  if (!isRecord(data)) return null;
  const nested = isRecord(data.data) ? data.data : null;
  const candidate =
    (isRecord(data.user) ? data.user : null) ??
    (nested && isRecord(nested.user) ? nested.user : null) ??
    nested ??
    data;

  if (!isRecord(candidate)) return null;
  if (candidate.id === undefined && candidate.email === undefined) return null;
  return candidate as unknown as User;
}

export function pickCollection(data: unknown, key: string): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  const nested = isRecord(data.data) ? data.data : null;
  const target = (Array.isArray(nested) ? nested : null) ?? nested?.[key] ?? data[key];
  if (Array.isArray(target)) return target;
  if (isRecord(target)) {
    const inner = target.data ?? target[key];
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

export function pickObject(data: unknown, ...keys: string[]): Record<string, unknown> | null {
  if (!isRecord(data)) return null;
  let cursor: unknown = data;
  for (const key of [...keys, 'data', 'summary']) {
    if (isRecord(cursor) && isRecord(cursor[key])) {
      cursor = cursor[key];
    }
  }
  return isRecord(cursor) ? cursor : null;
}

export type { LoginResponse };
