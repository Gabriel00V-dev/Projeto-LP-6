import { supabase } from '../supabaseClient';
import { AuthenticatedUser } from '../middlewares/authMiddleware';
import { HttpError } from '../utils/httpError';
import { validarData } from '../utils/horario';

const CAMPOS_EDITAVEIS = ['nome', 'especie', 'raca', 'data_nascimento', 'peso', 'observacoes'];

function camposValidos(dados: any, exigirObrigatorios: boolean) {
  const campos: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (dados?.[campo] !== undefined) campos[campo] = dados[campo] === '' ? null : dados[campo];
  }

  if (exigirObrigatorios && (!campos.nome || !campos.especie)) {
    throw new HttpError(400, 'Nome e espécie são obrigatórios.');
  }
  if (campos.data_nascimento && !validarData(String(campos.data_nascimento))) {
    throw new HttpError(400, 'data_nascimento deve estar no formato YYYY-MM-DD.');
  }
  if (campos.peso !== undefined && campos.peso !== null && (Number.isNaN(Number(campos.peso)) || Number(campos.peso) <= 0)) {
    throw new HttpError(400, 'Peso inválido.');
  }
  return campos;
}

async function buscarAnimal(codigo: number) {
  if (!Number.isInteger(codigo)) throw new HttpError(400, 'Código inválido');

  const { data, error } = await supabase.from('animais').select('*').eq('codigo', codigo).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, 'Animal não encontrado');
  return data;
}

/** A clínica ou o profissional que já tem (ou teve) consulta com este animal. */
async function prestadorAtendeAnimal(user: AuthenticatedUser, codigoAnimal: number): Promise<boolean> {
  if (user.role !== 'clinica' && user.role !== 'profissional') return false;

  const coluna = user.role === 'clinica' ? 'codigo_clinica' : 'codigo_profissional';
  const { data } = await supabase
    .from('consultas')
    .select('codigo')
    .eq('codigo_animal', codigoAnimal)
    .eq(coluna, user.entityId)
    .limit(1);

  return (data ?? []).length > 0;
}

async function obterComAcesso(user: AuthenticatedUser, codigo: number) {
  const animal = await buscarAnimal(codigo);
  const ehDono = user.role === 'paciente' && animal.codigo_paciente === user.entityId;
  if (!ehDono && !(await prestadorAtendeAnimal(user, codigo))) {
    throw new HttpError(403, 'Você não tem acesso a este animal.');
  }
  return { animal, ehDono };
}

async function obterComoDono(user: AuthenticatedUser, codigo: number) {
  const animal = await buscarAnimal(codigo);
  if (user.role !== 'paciente' || animal.codigo_paciente !== user.entityId) {
    throw new HttpError(403, 'Apenas o tutor pode alterar o cadastro do animal.');
  }
  return animal;
}

export async function listarAnimais(user: AuthenticatedUser) {
  if (user.role !== 'paciente') throw new HttpError(403, 'Apenas pacientes têm animais cadastrados.');

  const { data, error } = await supabase
    .from('animais')
    .select('*, vacinas_animais(codigo, nome, aplicada_em, proxima_dose)')
    .eq('codigo_paciente', user.entityId)
    .order('nome');

  if (error) throw new Error(error.message);
  return (data ?? []).map(({ vacinas_animais, ...animal }: any) => ({ ...animal, vacinas: vacinas_animais ?? [] }));
}

export async function obterAnimal(user: AuthenticatedUser, codigo: number) {
  const { animal } = await obterComAcesso(user, codigo);
  return { ...animal, vacinas: await listarVacinas(user, codigo, true) };
}

export async function criarAnimal(user: AuthenticatedUser, dados: any) {
  if (user.role !== 'paciente') throw new HttpError(403, 'Apenas pacientes cadastram animais.');

  const { data, error } = await supabase
    .from('animais')
    .insert({ ...camposValidos(dados, true), codigo_paciente: user.entityId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ...data, vacinas: [] };
}

export async function atualizarAnimal(user: AuthenticatedUser, codigo: number, dados: any) {
  await obterComoDono(user, codigo);

  const { data, error } = await supabase
    .from('animais')
    .update(camposValidos(dados, false))
    .eq('codigo', codigo)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removerAnimal(user: AuthenticatedUser, codigo: number) {
  await obterComoDono(user, codigo);
  const { error } = await supabase.from('animais').delete().eq('codigo', codigo);
  if (error) throw new Error(error.message);
  return { message: 'Animal removido.' };
}

export async function listarVacinas(user: AuthenticatedUser, codigoAnimal: number, acessoJaVerificado = false) {
  if (!acessoJaVerificado) await obterComAcesso(user, codigoAnimal);

  const { data, error } = await supabase
    .from('vacinas_animais')
    .select('codigo, nome, aplicada_em, proxima_dose, registrada_por')
    .eq('codigo_animal', codigoAnimal)
    .order('aplicada_em', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function registrarVacina(user: AuthenticatedUser, codigoAnimal: number, dados: any) {
  await obterComAcesso(user, codigoAnimal);

  const { nome, aplicada_em, proxima_dose } = dados ?? {};
  if (!nome || !validarData(aplicada_em ?? '')) {
    throw new HttpError(400, 'Informe o nome da vacina e a data de aplicação (YYYY-MM-DD).');
  }
  if (proxima_dose && !validarData(proxima_dose)) {
    throw new HttpError(400, 'proxima_dose deve estar no formato YYYY-MM-DD.');
  }

  const { data, error } = await supabase
    .from('vacinas_animais')
    .insert({ codigo_animal: codigoAnimal, nome, aplicada_em, proxima_dose: proxima_dose || null, registrada_por: user.role })
    .select('codigo, nome, aplicada_em, proxima_dose, registrada_por')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Histórico clínico: consultas do animal, com as evoluções registradas em cada uma. */
export async function historicoClinico(user: AuthenticatedUser, codigoAnimal: number) {
  await obterComAcesso(user, codigoAnimal);

  const { data, error } = await supabase
    .from('consultas')
    .select(`
      codigo, data_hora, status, modalidade, tipo_atendimento, observacoes,
      clinicas(nome), profissionais(nome),
      evolucoes(codigo, texto, criado_em)
    `)
    .eq('codigo_animal', codigoAnimal)
    .order('data_hora', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(({ clinicas, profissionais, evolucoes, ...consulta }: any) => ({
    ...consulta,
    clinica_nome: clinicas?.nome ?? null,
    profissional_nome: profissionais?.nome ?? null,
    evolucoes: evolucoes ?? [],
  }));
}
