import {
  AppointmentStatus,
  ProfessionalType,
  RiskLevel,
  TipoAtendimento,
  UpaQueueStatus,
} from "../types";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Data local do aparelho em YYYY-MM-DD (o formato que a API espera). */
export function dataIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function proximosDias(quantidade = 14) {
  const hoje = new Date();
  return Array.from({ length: quantidade }, (_, i) => {
    const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    const prefixo = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : DIAS_CURTOS[dia.getDay()];
    return { iso: dataIso(dia), rotulo: `${prefixo}, ${dia.getDate()}` };
  });
}

/**
 * consultas.data_hora é horário de parede, sem fuso ("2026-10-25 14:00:00").
 * Lido como horário local do aparelho, sem conversão.
 */
export function parseDataHoraLocal(valor: string): Date {
  const [data, hora = "00:00"] = valor.replace("T", " ").split(" ");
  const [y, m, d] = data.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi);
}

export function formatarDataHora(valor: string): string {
  const date = parseDataHoraLocal(valor);
  const dia = date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const hora = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

export function formatarHora(valor: string): string {
  return valor.replace("T", " ").slice(11, 16);
}

/**
 * Carimbos gravados pelo servidor (entrada_em, chamado_em...) estão em UTC,
 * sem sufixo de fuso e às vezes com microssegundos — que nem todo motor JS
 * aceita. Normaliza para "YYYY-MM-DDTHH:MM:SS.mmmZ" antes de converter.
 */
export function parseUtc(valor: string): Date {
  const [base, fracao = ""] = valor.replace(" ", "T").replace(/([zZ]|[+-]\d{2}:?\d{2})$/, "").split(".");
  return new Date(`${base.slice(0, 19)}.${fracao.slice(0, 3).padEnd(3, "0")}Z`);
}

export function formatarHoraUtc(valor?: string | null): string {
  if (!valor) return "--:--";
  return parseUtc(valor).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatarDataUtc(valor?: string | null): string {
  if (!valor) return "";
  return parseUtc(valor).toLocaleDateString("pt-BR");
}

export function minutosDesde(valorUtc: string): number {
  return Math.max(0, Math.round((Date.now() - parseUtc(valorUtc).getTime()) / 60_000));
}

export function formatarEspera(minutos?: number | null): string {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export const ROTULO_PROFISSIONAL: Record<ProfessionalType, string> = {
  psicologo: "Psicólogo(a)",
  medico: "Médico(a)",
  enfermeiro: "Enfermeiro(a)",
  veterinario: "Veterinário(a)",
  profissional_sus: "Profissional SUS",
};

export const ROTULO_ATENDIMENTO: Record<TipoAtendimento, string> = {
  consulta: "Consulta",
  vacinacao: "Vacinação",
  castracao: "Castração",
  retorno: "Retorno",
  orientacao_online: "Orientação online",
  emergencia: "Emergência",
};

export const STATUS_CONSULTA: Record<AppointmentStatus, { label: string; color: string; icon: string }> = {
  agendada: { label: "Agendada", color: "#FF9500", icon: "time-outline" },
  confirmada: { label: "Confirmada", color: "#34C759", icon: "checkmark-circle-outline" },
  em_atendimento: { label: "Em atendimento", color: "#007AFF", icon: "pulse-outline" },
  cancelada: { label: "Cancelada", color: "#FF3B30", icon: "close-circle-outline" },
  concluida: { label: "Concluída", color: "#8E8E93", icon: "checkmark-done-outline" },
  faltou: { label: "Ausente", color: "#8E8E93", icon: "remove-circle-outline" },
};

export const STATUS_FILA: Record<UpaQueueStatus, string> = {
  aguardando_triagem: "Aguardando triagem",
  em_triagem: "Em triagem",
  aguardando_atendimento: "Aguardando atendimento",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

// Cores do protocolo de classificação de risco, validadas como conjunto
// (dataviz/validate_palette, fundo branco): amarelo mais claro e verde mais
// escuro para se separarem na protanopia. O amarelo fica abaixo de 3:1 de
// contraste: nunca usar como cor de texto, e sempre acompanhar do rótulo.
export const RISCO: Record<RiskLevel, { label: string; color: string }> = {
  vermelho: { label: "Emergência", color: "#DC2626" },
  amarelo: { label: "Urgência", color: "#DDA000" },
  verde: { label: "Pouco urgente", color: "#15803D" },
  azul: { label: "Não urgente", color: "#2563EB" },
};
