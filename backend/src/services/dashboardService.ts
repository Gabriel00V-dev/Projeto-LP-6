import { supabase } from '../supabaseClient';
import { HttpError } from '../utils/httpError';
import { hojeLocal, paraMs, validarData } from '../utils/horario';

const FUSO = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
const DIAS_PADRAO = 30;
const DIAS_MAXIMO = 366;

function somarDias(data: string, dias: number): string {
  return new Date(paraMs(`${data} 00:00:00`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Indicadores da prefeitura (plano, seção 2), calculados pela função SQL
 * dashboard_prefeitura numa chamada só. Sem período, usa os últimos 30 dias.
 */
export async function indicadores(de?: string, ate?: string) {
  const fim = ate || hojeLocal();
  const inicio = de || somarDias(fim, -(DIAS_PADRAO - 1));

  if (!validarData(inicio) || !validarData(fim)) {
    throw new HttpError(400, 'de e ate devem estar no formato YYYY-MM-DD.');
  }
  if (inicio > fim) throw new HttpError(400, 'A data inicial deve ser anterior à final.');

  const dias = (paraMs(`${fim} 00:00:00`) - paraMs(`${inicio} 00:00:00`)) / 86_400_000 + 1;
  if (dias > DIAS_MAXIMO) throw new HttpError(400, `O período máximo é de ${DIAS_MAXIMO} dias.`);

  const { data, error } = await supabase.rpc('dashboard_prefeitura', { p_de: inicio, p_ate: fim, p_fuso: FUSO });

  if (error) {
    if (error.message.includes('dashboard_prefeitura')) {
      throw new HttpError(503, 'Dashboard indisponível: execute migrations/dashboard_prefeitura.sql no banco.');
    }
    throw new Error(error.message);
  }
  return data;
}
