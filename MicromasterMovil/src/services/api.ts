import {
  AxiosError,
  create,
  isAxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';

import { clearSessionStorage, serverUrlStorage, tokenStorage } from '@/services/storage';

// El backend Laravel de MicroMaster publica sus rutas en /api (sin prefijo v1).
const DEFAULT_BASE_URL = 'http://192.168.200.103:8080/api';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0 && !fromEnv.includes('192.168.200.102')) {
    return fromEnv.replace(/\/$/, '');
  }

  const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl;
  if (
    typeof fromConfig === 'string' &&
    fromConfig.length > 0 &&
    !fromConfig.includes('192.168.200.102')
  ) {
    return fromConfig.replace(/\/$/, '');
  }

  return DEFAULT_BASE_URL;
}

export const API_BASE_URL = resolveBaseUrl();

export interface ApiFailure {
  status: number;
  message: string;
  errors: Record<string, string[]>;
  raw: unknown;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function extractLaravelMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  // El AuthController de MicroMaster devuelve {'error': '...'} en 401/403.
  if (typeof record.error === 'string') return record.error;
  const firstError = Object.values(record.errors ?? {})[0];
  if (Array.isArray(firstError) && typeof firstError[0] === 'string') return firstError[0];
  return '';
}

function buildFailure(error: AxiosError<unknown>): ApiFailure {
  const status = error.response?.status ?? 0;
  const data = error.response?.data;
  const targetBase = error.config?.baseURL ?? API_BASE_URL;
  const message =
    extractLaravelMessage(data) ||
    (status === 0
      ? `No hay conexión con el servidor (${targetBase}). Verifica que el celular esté en la misma red Wi-Fi o ajusta la IP.`
      : error.message);

  const errors =
    data && typeof data === 'object' && (data as Record<string, unknown>).errors
      ? ((data as Record<string, Record<string, string[]>>).errors ?? {})
      : {};

  return { status, message, errors, raw: data };
}

export const api: AxiosInstance = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const customUrl = await serverUrlStorage.get();
  if (customUrl) {
    config.baseURL = customUrl.replace(/\/$/, '');
  }
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<unknown>) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      await clearSessionStorage();
      unauthorizedHandler?.();
    }
    return Promise.reject(buildFailure(error));
  },
);

export function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object' && value !== null && 'status' in value && 'message' in value;
}

const probe: AxiosInstance = create({
  timeout: 8000,
  headers: { Accept: 'text/html, application/json' },
});

export interface PingResult {
  ok: boolean;
  message: string;
}

export async function getActiveApiBaseUrl(): Promise<string> {
  const custom = await serverUrlStorage.get();
  return custom ? custom.replace(/\/$/, '') : API_BASE_URL;
}

export async function setCustomApiBaseUrl(newUrl: string): Promise<void> {
  const clean = newUrl.trim().replace(/\/$/, '');
  await serverUrlStorage.set(clean);
  api.defaults.baseURL = clean;
}

export async function resetCustomApiBaseUrl(): Promise<void> {
  await serverUrlStorage.clear();
  api.defaults.baseURL = API_BASE_URL;
}

/**
 * Comprueba que el servidor Laravel esté accesible desde el dispositivo.
 */
export async function pingBackend(overrideUrl?: string): Promise<PingResult> {
  const target = (overrideUrl ?? (await getActiveApiBaseUrl())).replace(/\/$/, '');
  const origin = target.replace(/\/api(\/.*)?$/, '');

  try {
    await probe.get(`${origin}/`);
    return { ok: true, message: `Conexión exitosa con ${target}` };
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      return {
        ok: true,
        message: `Servidor respondió en ${target} (HTTP ${error.response.status}).`,
      };
    }
    return {
      ok: false,
      message: `Sin respuesta en ${target}.`,
    };
  }
}
