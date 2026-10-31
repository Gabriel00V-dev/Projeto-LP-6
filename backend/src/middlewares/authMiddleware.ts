import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAuth } from '../supabaseClient';

export type Papel = 'paciente' | 'clinica' | 'profissional' | 'prefeitura';

export type TipoProfissional = 'psicologo' | 'medico' | 'enfermeiro' | 'veterinario' | 'profissional_sus';

export type StatusCadastro = 'pendente' | 'aprovado' | 'reprovado';

export const TABELA_POR_PAPEL: Record<Papel, string> = {
  paciente: 'pacientes',
  clinica: 'clinicas',
  profissional: 'profissionais',
  prefeitura: 'administradores',
};

export const PAPEIS: Papel[] = ['paciente', 'clinica', 'profissional', 'prefeitura'];

/** Papéis cujo cadastro passa pela aprovação da prefeitura. */
export const PAPEIS_COM_APROVACAO: Papel[] = ['clinica', 'profissional'];

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Papel;
  entityId: number;
  // Só para clínica e profissional
  statusCadastro?: StatusCadastro;
  // Só para role === 'profissional'
  tipoProfissional?: TipoProfissional;
  codigoClinica?: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const COLUNAS: Record<Papel, string> = {
  paciente: 'codigo',
  clinica: 'codigo, status_cadastro',
  profissional: 'codigo, tipo, codigo_clinica, ativo, status_cadastro',
  prefeitura: 'codigo, ativo',
};

async function carregarEntidade(papel: Papel, email: string): Promise<AuthenticatedUser | null> {
  let { data, error } = await supabase
    .from(TABELA_POR_PAPEL[papel])
    .select(COLUNAS[papel])
    .eq('email', email)
    .maybeSingle();

  // Banco ainda sem a migration de aprovação: o login de quem já existia não
  // pode parar por causa disso. Sem a coluna, o cadastro conta como aprovado.
  if (error && papel === 'clinica' && error.message.includes('status_cadastro')) {
    ({ data, error } = await supabase.from('clinicas').select('codigo').eq('email', email).maybeSingle());
  }

  if (error || !data) return null;
  const row = data as any;
  if ((papel === 'profissional' || papel === 'prefeitura') && row.ativo === false) return null;

  return {
    id: '',
    email,
    role: papel,
    entityId: row.codigo,
    ...(PAPEIS_COM_APROVACAO.includes(papel) ? { statusCadastro: row.status_cadastro ?? 'aprovado' } : {}),
    ...(papel === 'profissional'
      ? { tipoProfissional: row.tipo, codigoClinica: row.codigo_clinica ?? null }
      : {}),
  };
}

type Falha = { status: number; error: string; code: string };

async function identificar(req: Request): Promise<AuthenticatedUser | Falha> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, error: 'Token de autenticação não fornecido.', code: 'MISSING_TOKEN' };
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    return { status: 401, error: 'Token inválido ou expirado. Faça login novamente.', code: 'INVALID_TOKEN' };
  }

  const role = user.user_metadata?.role as Papel | undefined;

  if (!role || !PAPEIS.includes(role)) {
    // Contas sem role nos metadados (antigas, ou criadas pelo painel do
    // Supabase, como as da prefeitura): descobre pela tabela.
    for (const papel of ['clinica', 'paciente', 'profissional', 'prefeitura'] as Papel[]) {
      const entidade = await carregarEntidade(papel, user.email!);
      if (entidade) return { ...entidade, id: user.id };
    }
    return { status: 403, error: 'Perfil de usuário não encontrado.', code: 'ENTITY_NOT_FOUND' };
  }

  const entidade = await carregarEntidade(role, user.email!);
  if (!entidade) {
    return { status: 403, error: 'Entidade vinculada ao token não encontrada.', code: 'ENTITY_NOT_FOUND' };
  }

  return { ...entidade, id: user.id };
}

function cadastroLiberado(user: AuthenticatedUser): boolean {
  return !PAPEIS_COM_APROVACAO.includes(user.role) || user.statusCadastro === 'aprovado';
}

function falhaDeCadastro(user: AuthenticatedUser): Falha {
  return user.statusCadastro === 'reprovado'
    ? { status: 403, error: 'Seu cadastro foi reprovado pela prefeitura. Corrija os dados e reenvie para análise.', code: 'CADASTRO_REPROVADO' }
    : { status: 403, error: 'Seu cadastro ainda está em análise pela prefeitura.', code: 'CADASTRO_PENDENTE' };
}

/**
 * Autentica e exige cadastro aprovado: clínica ou profissional em análise (ou
 * reprovado) não opera nada além das rotas de acompanhamento do cadastro.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resultado = await identificar(req);
    if ('error' in resultado) {
      res.status(resultado.status).json({ error: resultado.error, code: resultado.code });
      return;
    }

    if (!cadastroLiberado(resultado)) {
      const falha = falhaDeCadastro(resultado);
      res.status(falha.status).json({ error: falha.error, code: falha.code });
      return;
    }

    req.user = resultado;
    next();
  } catch (err) {
    console.error('[authenticate] Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
}

/** Como o authenticate, mas aceita cadastro pendente/reprovado (acompanhar e reenviar). */
export async function authenticateIncluindoPendentes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resultado = await identificar(req);
    if ('error' in resultado) {
      res.status(resultado.status).json({ error: resultado.error, code: resultado.code });
      return;
    }
    req.user = resultado;
    next();
  } catch (err) {
    console.error('[authenticate] Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
}

/**
 * Para rotas públicas que mostram mais dados a quem está logado (ex.: lotação
 * da UPA para o cidadão x fila completa para a equipe). Token ausente,
 * inválido ou de cadastro não aprovado: segue como visitante.
 */
export async function authenticateOptional(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.headers.authorization) {
    try {
      const resultado = await identificar(req);
      if (!('error' in resultado) && cadastroLiberado(resultado)) req.user = resultado;
    } catch (err) {
      console.error('[authenticateOptional] Erro inesperado:', err);
    }
  }
  next();
}

export function requireClinica(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'clinica') { res.status(403).json({ error: 'Acesso restrito a clínicas.', code: 'FORBIDDEN_ROLE' }); return; }
  next();
}

export function requirePaciente(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'paciente') { res.status(403).json({ error: 'Acesso restrito a pacientes.', code: 'FORBIDDEN_ROLE' }); return; }
  next();
}

export function requireProfissional(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'profissional') { res.status(403).json({ error: 'Acesso restrito a profissionais.', code: 'FORBIDDEN_ROLE' }); return; }
  next();
}

/** Prestador = clínica ou profissional (vinculado ou independente). */
export function requirePrestador(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'clinica' && req.user?.role !== 'profissional') {
    res.status(403).json({ error: 'Acesso restrito a clínicas e profissionais.', code: 'FORBIDDEN_ROLE' });
    return;
  }
  next();
}

/**
 * Prefeitura: analisa cadastros e libera add-ons depois do pagamento. As
 * contas ficam na tabela `administradores` (ver migrations/aprovacao_cadastros.sql).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'prefeitura') {
    res.status(403).json({ error: 'Acesso restrito à prefeitura.', code: 'FORBIDDEN_ROLE' });
    return;
  }
  next();
}
