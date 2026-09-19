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
const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

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
const clientOptions = { realtime: { transport: ws as any } };

function build(key: string): SupabaseClient {
  return configErrors.length > 0
    ? (null as unknown as SupabaseClient)
    : createClient(supabaseUrl, key, clientOptions);
}

/**
 * Cliente com a chave anon, usado apenas nas operações de autenticação
 * (signUp, signInWithPassword, getUser). São justamente as que devem rodar com
 * a chave pública: quem cria a conta é o usuário final, não o servidor.
 */
export const supabaseAuth: SupabaseClient = build(supabaseKey);

/**
 * Cliente usado para acessar as tabelas. Com a service_role ele passa pelo RLS,
 * que é o esperado de um servidor confiável — o controle de acesso aqui é feito
 * pelo authMiddleware, não pelas policies. Sem a service_role, cai na chave
 * anon e qualquer INSERT barrado pelo RLS vai falhar.
 */
export const supabase: SupabaseClient = supabaseServiceRoleKey
  ? build(supabaseServiceRoleKey)
  : supabaseAuth;

export const usandoServiceRole = Boolean(supabaseServiceRoleKey);

if (!usandoServiceRole && configErrors.length === 0) {
  console.warn(
    "[config] SUPABASE_SERVICE_ROLE_KEY não definida: as tabelas serão acessadas " +
      "com a chave anon e o RLS pode barrar escritas (cadastro, agendamento, upload)."
  );
}
