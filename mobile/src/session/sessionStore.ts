import { useSyncExternalStore } from "react";

/**
 * Sessão atual (papel + cadastro), visível de qualquer tela — o menu lateral
 * da web precisa dela fora dos params de navegação. É preenchida ao entrar
 * (login, sessão restaurada, cadastro aprovado) e limpa no logout.
 */
export type Sessao = { role: "paciente" | "clinica" | "profissional" | "prefeitura"; user: any } | null;

let atual: Sessao = null;
const ouvintes = new Set<() => void>();

export const sessionStore = {
  get: () => atual,
  set(sessao: Sessao) {
    atual = sessao;
    ouvintes.forEach((ouvinte) => ouvinte());
  },
  clear() {
    sessionStore.set(null);
  },
  subscribe(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  },
};

export function useSession(): Sessao {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}
