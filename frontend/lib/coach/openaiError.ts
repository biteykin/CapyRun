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
  ): "REGION" | "QUOTA" | "RATE" | "AUTH" | "OTHER" {
    if (!n) return "OTHER";
  
    if (
      n.status === 403 &&
      (n.code?.includes("unsupported_country") ||
        n.code?.includes("region") ||
        /country/i.test(n.message))
    ) {
      return "REGION";
    }
  
    if (
      n.status === 429 &&
      (n.code?.includes("insufficient_quota") ||
        /quota/i.test(n.message))
    ) {
      return "QUOTA";
    }
  
    if (n.status === 429) {
      return "RATE";
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
        return "AI временно недоступен в текущем регионе или сети. Попробуйте сменить сеть или VPN.";
  
      case "QUOTA":
        return "AI временно недоступен: исчерпан лимит проекта. Проверьте биллинг OpenAI.";
  
      case "RATE":
        return "AI перегружен (rate limit). Попробуйте ещё раз через минуту.";
  
      case "AUTH":
        return "Ошибка авторизации AI. Проверьте API-ключ.";
  
      default:
        return "Сейчас у нас временная ошибка при генерации ответа тренера — попробуйте отправить ещё раз.";
    }
  }