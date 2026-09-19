/**
 * Normaliza qualquer erro (axios, fetch, Supabase, Error) em uma string.
 *
 * O Alert.alert nativo do Android quebra com
 * "Value for message cannot be cast from ReadableNativeMap to String"
 * quando recebe um objeto como mensagem — o que acontece sempre que o backend
 * responde algo como { error: { message, code } } em vez de { error: "texto" }.
 */
export function getErrorMessage(err: any, fallback: string): string {
  const candidates = [
    err?.response?.data?.error,
    err?.response?.data?.message,
    err?.response?.data,
    err?.error,
    err?.message,
  ];

  for (const candidate of candidates) {
    const text = toText(candidate);
    if (text) return text;
  }

  return fallback;
}

function toText(value: any): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Respostas HTML (páginas de erro de proxy/CDN) não servem como mensagem
    if (!trimmed || trimmed.startsWith("<")) return null;
    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    // Erros do Supabase/PostgREST: { message, code, details, hint }
    if (typeof value.message === "string" && value.message.trim()) {
      return value.message.trim();
    }
    if (typeof value.error === "string" && value.error.trim()) {
      return value.error.trim();
    }
  }

  return null;
}
