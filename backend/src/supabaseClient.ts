import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Quais variáveis faltam. Em ambiente serverless, lançar erro aqui derruba a
// função inteira no import e a Vercel devolve apenas FUNCTION_INVOCATION_FAILED,
// sem dizer o motivo. Em vez disso, registramos a falta e deixamos o app subir
// para responder com uma mensagem clara (ver o guard em index.ts).
export const missingEnvVars: string[] = [
  ...(supabaseUrl ? [] : ["SUPABASE_URL"]),
  ...(supabaseKey ? [] : ["SUPABASE_KEY"]),
];

if (missingEnvVars.length > 0) {
  console.error(
    `[config] Variáveis de ambiente ausentes: ${missingEnvVars.join(", ")}. ` +
      `Defina-as no .env (local) ou em Settings > Environment Variables (Vercel).`
  );
}

// Node < 22 não tem WebSocket nativo; o realtime-js precisa do transport explícito
export const supabase: SupabaseClient =
  missingEnvVars.length > 0
    ? (null as unknown as SupabaseClient)
    : createClient(supabaseUrl!, supabaseKey!, {
        realtime: { transport: ws as any },
      });
