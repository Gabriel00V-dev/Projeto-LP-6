import { Ionicons } from "@expo/vector-icons";
import { Sessao } from "../session/sessionStore";

/**
 * Menu lateral da web, no modelo do painel da Sellentt (menu-sellentt-v3):
 * um item de início e grupos que abrem/fecham. Cada item navega para uma rota
 * do stack com os params que a tela espera; `ativoEm` lista as telas filhas
 * que mantêm o item marcado (ex.: agendar consulta fica sob "Buscar clínicas").
 */
export type ItemMenu = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  rota: string;
  params?: Record<string, unknown>;
  ativoEm?: string[];
};

export type GrupoMenu = { titulo: string; icon: keyof typeof Ionicons.glyphMap; itens: ItemMenu[] };

export type Menu = { inicio: ItemMenu; grupos: GrupoMenu[] };

export function menuDaSessao(sessao: Sessao): Menu | null {
  if (!sessao) return null;
  const { role, user } = sessao;

  if (role === "paciente") {
    const p = { patient: user };
    return {
      inicio: { label: "Início", icon: "home-outline", rota: "PatientMenu", params: p },
      grupos: [
        {
          titulo: "Atendimento",
          icon: "medkit-outline",
          itens: [
            {
              label: "Serviços", icon: "grid-outline", rota: "ServicesHome", params: p,
              ativoEm: ["UpaService", "PsychologyService", "VeterinaryService", "TelemedicineService"],
            },
            { label: "Minhas consultas", icon: "calendar-outline", rota: "Appointments", params: p },
            { label: "Buscar clínicas", icon: "search-outline", rota: "ClinicList", params: p, ativoEm: ["ClinicDetails", "BookAppointment"] },
          ],
        },
        {
          titulo: "Meus dados",
          icon: "person-outline",
          itens: [
            { label: "Meus animais", icon: "paw-outline", rota: "Pets", params: p },
            { label: "Documentos", icon: "folder-open-outline", rota: "PatientDocuments", params: p },
            { label: "Notificações", icon: "notifications-outline", rota: "Notifications", params: p },
            { label: "Meu perfil", icon: "create-outline", rota: "PatientEdit", params: p },
          ],
        },
      ],
    };
  }

  if (role === "clinica") {
    const c = { clinic: user };
    const atendimento: ItemMenu[] = [
      { label: "Atendimentos do dia", icon: "pulse-outline", rota: "ProviderAgenda", params: c },
      { label: "Agenda", icon: "calendar-outline", rota: "ClinicAgenda", params: c },
      { label: "Pacientes", icon: "people-outline", rota: "ClinicPatients", params: c },
    ];
    if (user?.tipo === "upa") {
      atendimento.push({ label: "Fila da UPA", icon: "medkit-outline", rota: "UpaStaff", params: { unitId: user.codigo, unitName: user.nome, clinic: user } });
    }

    return {
      inicio: { label: "Painel da clínica", icon: "home-outline", rota: "ClinicMenu", params: c },
      grupos: [
        { titulo: "Atendimento", icon: "medkit-outline", itens: atendimento },
        {
          titulo: "Gestão",
          icon: "briefcase-outline",
          itens: [
            { label: "Equipe", icon: "id-card-outline", rota: "ClinicProfessionals", params: c },
            { label: "Horários", icon: "time-outline", rota: "Availability", params: c },
            { label: "Especialidades", icon: "medical-outline", rota: "SpecializationsScreen", params: { clinicCode: user?.codigo } },
            { label: "Documentos", icon: "document-text-outline", rota: "ClinicDocuments", params: c },
            { label: "Relatórios", icon: "bar-chart-outline", rota: "ClinicReports", params: c },
          ],
        },
        {
          titulo: "Conta",
          icon: "settings-outline",
          itens: [{ label: "Dados da clínica", icon: "create-outline", rota: "ClinicEdit", params: c }],
        },
      ],
    };
  }

  if (role === "profissional") {
    const pr = { professional: user };
    const itens: ItemMenu[] = [
      { label: "Agenda de atendimentos", icon: "calendar-outline", rota: "ProviderAgenda", params: pr },
      { label: "Meus horários", icon: "time-outline", rota: "Availability", params: pr },
    ];
    if (user?.clinica_tipo === "upa" && user?.codigo_clinica) {
      itens.push({ label: "Fila da UPA", icon: "medkit-outline", rota: "UpaStaff", params: { unitId: user.codigo_clinica, unitName: user.clinica_nome } });
    }
    return {
      inicio: { label: "Início", icon: "home-outline", rota: "ProfessionalMenu", params: pr },
      grupos: [{ titulo: "Atendimento", icon: "medkit-outline", itens }],
    };
  }

  // Prefeitura
  const a = { admin: user };
  return {
    inicio: { label: "Painel da prefeitura", icon: "stats-chart-outline", rota: "PrefeituraDashboard", params: a },
    grupos: [
      {
        titulo: "Gestão municipal",
        icon: "business-outline",
        itens: [{ label: "Aprovação de cadastros", icon: "shield-checkmark-outline", rota: "Approvals", params: a }],
      },
    ],
  };
}

export function itemAtivo(item: ItemMenu, rotaAtual?: string): boolean {
  return !!rotaAtual && (item.rota === rotaAtual || (item.ativoEm ?? []).includes(rotaAtual));
}
