import { isApiFailure } from '@/services/api';

export function getApiErrorMessage(error: unknown): string {
  if (isApiFailure(error)) {
    if (error.status === 422 && Object.keys(error.errors).length > 0) {
      return Object.values(error.errors)[0]?.[0] ?? error.message;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function getApiValidationErrors(error: unknown): Record<string, string> {
  if (!isApiFailure(error)) return {};
  return Object.fromEntries(
    Object.entries(error.errors).map(([field, messages]) => [field, messages[0] ?? '']),
  );
}
