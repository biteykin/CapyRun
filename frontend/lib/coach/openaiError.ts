// lib/coach/openaiError.ts

export type NormalizedAIError = {
  status?: number;
  code?: string;
  message: string;
  stack?: string;
  raw?: {
    code?: string;
    name?: string;
    status?: number;
    message?: string;
  };
};

/**
 * Приводим любую ошибку OpenAI / Fetch / SDK к единому формату.
 * Без внешних зависимостей.
 */
export function normalizeAIError(err: unknown): NormalizedAIError {
  const anyErr = err as any;

  const status =
    anyErr?.status ??
    anyErr?.response?.status ??
    anyErr?.extra?.status ??
    anyErr?.error?.status ??
    undefined;

  const code =
    anyErr?.code ??
    anyErr?.error?.code ??
    anyErr?.name ??
    anyErr?.error?.name ??
    undefined;

  const message =
    anyErr?.message ??
    anyErr?.error?.message ??
    anyErr?.cause?.message ??
    (typeof anyErr === "string" ? anyErr : "Unknown AI error");

  const stack = anyErr?.stack ?? anyErr?.error?.stack ?? undefined;

  return {
    status,
    code,
    message,
    stack,
    raw: {
      code,
      name: anyErr?.name ?? anyErr?.error?.name,
      status,
      message,
    },
  };
}

/**
 * Классификация типов ошибок
 */
export function classifyAIError(
  n: NormalizedAIError
): "REGION" | "QUOTA" | "RATE" | "AUTH" | "TIMEOUT" | "NETWORK" | "OTHER" {
  if (!n) return "OTHER";

  const msg = String(n.message ?? "").toLowerCase();
  const code = String(n.code ?? "").toLowerCase();

  if (
    n.status === 403 &&
    (code.includes("unsupported_country") ||
      code.includes("region") ||
      /country|region|territory/i.test(msg))
  ) {
    return "REGION";
  }

  if (
    n.status === 429 &&
    (code.includes("insufficient_quota") || /quota|billing/i.test(msg))
  ) {
    return "QUOTA";
  }

  if (n.status === 429) {
    return "RATE";
  }

  if (
    code.includes("timeout") ||
    /timeout|timed out|etimedout|request timeout/i.test(msg)
  ) {
    return "TIMEOUT";
  }

  if (
    code.includes("fetcherror") ||
    code.includes("econnreset") ||
    code.includes("enotfound") ||
    code.includes("eai_again") ||
    /fetch failed|network|socket hang up|connection/i.test(msg)
  ) {
    return "NETWORK";
  }

  if (n.status === 401 || n.status === 403) {
    return "AUTH";
  }

  return "OTHER";
}

/**
 * Текст для пользователя
 */
export function userFacingAIErrorText(
  n?: NormalizedAIError | null
): string {
  if (!n) {
    return "Сейчас у нас временная ошибка при генерации ответа тренера — попробуйте отправить ещё раз.";
  }

  const kind = classifyAIError(n);

  switch (kind) {
    case "REGION":
      return "Тренер временно недоступен в текущем регионе или сети. Попробуйте другую сеть или VPN.";

    case "QUOTA":
      return "Тренер временно недоступен из-за лимита AI-сервиса.";

    case "RATE":
      return "Сейчас AI-сервис перегружен. Попробуйте ещё раз чуть позже.";

    case "TIMEOUT":
      return "Тренер не успел ответить вовремя. Попробуйте ещё раз.";

    case "NETWORK":
      return "Сейчас есть проблема с соединением к AI-сервису. Попробуйте ещё раз.";

    case "AUTH":
      return "Сейчас есть проблема с доступом к AI-сервису.";

    default:
      return "Сейчас у нас временная ошибка при генерации ответа тренера — попробуйте отправить ещё раз.";
  }
}
