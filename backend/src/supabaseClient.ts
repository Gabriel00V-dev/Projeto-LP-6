import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/**
 * O painel da Vercel guarda o valor literal da variável, incluindo aspas e
 * espaços que venham junto na hora de colar — o dotenv, por outro lado, remove
 * as aspas ao ler o .env. Normalizamos aqui para que os dois ambientes se
 * comportem igual.
 */
function readEnv(name: string): string {
  const raw = (process.env[name] ?? "").trim();
  return raw.replace(/^(['"])(.*)\1$/s, "$2").trim();
}

const supabaseUrl = readEnv("SUPABASE_URL");
const supabaseKey = readEnv("SUPABASE_KEY");

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Problemas de configuração são coletados, não lançados. Em ambiente
// serverless, um erro durante o import derruba a função antes de qualquer rota
// existir, e a Vercel responde só FUNCTION_INVOCATION_FAILED, sem a causa.
export const configErrors: string[] = [];

if (!supabaseUrl) {
  configErrors.push("SUPABASE_URL não definida");
} else if (!isHttpUrl(supabaseUrl)) {
  // A URL do projeto Supabase não é segredo — ela viaja em todo request do app.
  // Mostrá-la aqui (com JSON.stringify, que torna aspas e espaços visíveis) é o
  // que permite descobrir o que de fato está guardado na variável.
  configErrors.push(
    `SUPABASE_URL não é uma URL http(s) válida; valor recebido: ${JSON.stringify(
      process.env.SUPABASE_URL ?? null
    )}`
  );
}

if (!supabaseKey) {
  configErrors.push("SUPABASE_KEY não definida");
}

if (configErrors.length > 0) {
  console.error(
    `[config] ${configErrors.join("; ")}. Defina as variáveis no .env (local) ` +
      `ou em Settings > Environment Variables (Vercel), sem aspas em volta do valor.`
  );
}

// Node < 22 não tem WebSocket nativo; o realtime-js precisa do transport explícito
export const supabase: SupabaseClient =
  configErrors.length > 0
    ? (null as unknown as SupabaseClient)
    : createClient(supabaseUrl, supabaseKey, {
        realtime: { transport: ws as any },
      });
