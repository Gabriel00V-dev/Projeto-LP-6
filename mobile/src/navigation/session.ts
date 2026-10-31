import { getStoredToken, SessionRole } from "../api/client";
import { sessionStore } from "../session/sessionStore";

/**
 * Para onde vai cada usuário logado. Usado no login, ao reabrir o app com a
 * sessão salva e quando um cadastro é aprovado.
 */
export function destinoDaSessao(role: SessionRole, user: any): { name: string; params?: any } {
  if (role === "paciente") return { name: "PatientMenu", params: { patient: user } };
  if (role === "prefeitura") return { name: "PrefeituraDashboard", params: { admin: user } };

  // Clínica e profissional só entram no painel depois da aprovação da prefeitura.
  if (user?.status_cadastro && user.status_cadastro !== "aprovado") {
    return { name: "AwaitingApproval", params: { role, user } };
  }

  return role === "clinica"
    ? { name: "ClinicMenu", params: { clinic: user } }
    : { name: "ProfessionalMenu", params: { professional: user } };
}

/**
 * Leva o usuário para a tela inicial dele, trocando a pilha inteira (o
 * "voltar" não deve retornar ao login). Prestador aprovado carrega a
 * assinatura antes, para os add-ons já estarem certos no menu.
 */
export async function entrarNaSessao(
  navigation: any,
  role: SessionRole,
  user: any,
  loadClinicSession: (user: any, token: string) => Promise<void>
) {
  const destino = destinoDaSessao(role, user);

  if ((role === "clinica" || role === "profissional") && destino.name !== "AwaitingApproval") {
    await loadClinicSession(user, (await getStoredToken()) ?? "");
  }

  sessionStore.set({ role, user });
  navigation.reset({ index: 0, routes: [destino] });
}
