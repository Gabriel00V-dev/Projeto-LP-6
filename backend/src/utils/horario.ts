/**
 * As colunas de horário (consultas.data_hora, disponibilidades.hora_*) são
 * TIMESTAMP/TIME sem fuso: guardam o horário de parede da cidade, do jeito
 * que o paciente escolheu na tela. O servidor, por outro lado, roda em UTC na
 * Vercel. Para comparar "agora" com um horário de consulta, as duas pontas
 * precisam estar no mesmo relógio — por isso convertemos o "agora" para o
 * horário de parede do fuso da aplicação e tratamos ambos como se fossem UTC.
 */

const FUSO = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

/** "Agora" no horário de parede do fuso da aplicação, no formato YYYY-MM-DD HH:MM:SS. */
export function agoraLocal(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const p = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '00';
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`;
}

export function hojeLocal(): string {
  return agoraLocal().slice(0, 10);
}

/** Converte um horário de parede (com espaço ou "T") em milissegundos comparáveis entre si. */
export function paraMs(horario: string): number {
  return Date.parse(`${horario.replace(' ', 'T').slice(0, 19)}Z`);
}

/** Normaliza o que vem do Postgres ("2026-10-25T14:00:00") para "2026-10-25 14:00:00". */
export function normalizarDataHora(horario: string): string {
  return horario.replace('T', ' ').slice(0, 19);
}

export function validarData(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  // O Date "rola" datas inexistentes (30/02 vira 02/03); a ida e volta pega isso.
  const ms = Date.parse(`${data}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === data;
}

/** 0 = domingo, igual a disponibilidades.dia_semana. */
export function diaDaSemana(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay();
}

export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60).toString().padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function somarMinutos(horario: string, minutos: number): string {
  return new Date(paraMs(horario) + minutos * 60_000).toISOString().replace('T', ' ').slice(0, 19);
}
