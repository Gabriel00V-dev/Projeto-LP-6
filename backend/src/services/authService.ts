import { supabase, supabaseAuth, usandoServiceRole, novoClienteAuth } from '../supabaseClient';
import { AuthenticatedUser, Papel, PAPEIS, TABELA_POR_PAPEL } from '../middlewares/authMiddleware';
import { TIPOS_PROFISSIONAL } from './professionalService';
import { TIPOS_CLINICA } from './clinicService';
import { cnpjValido, cpfValido, emailValido, somenteDigitos } from '../utils/documentos';

function isMissingAtendeUnimedColumnError(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return text.includes('atende_unimed') && (text.includes('column') || text.includes('schema cache'));
}

function isMissingUnimedColumnError(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return text.includes('unimed') && (text.includes('column') || text.includes('schema cache'));
}

export interface LoginData {
  email: string;
  senha: string;
  role: Papel;
}

export interface RegisterData {
  role: Papel;
  payload: any;
}

/**
 * Campos aceitos no cadastro público, por papel. Lista fechada: sem ela,
 * bastaria mandar status_cadastro: 'aprovado' no corpo para pular a análise
 * da prefeitura.
 */
function camposDoCadastro(role: Papel, informado: any) {
  if (role === 'paciente') {
    const { datan, fone, ende } = informado;
    return { datan, fone, ende };
  }

  if (role === 'clinica') {
    const { endereco, fone, imagem, atende_unimed, tipo, cnpj, responsavel_tecnico, registro_responsavel } = informado;

    if (tipo !== undefined && !TIPOS_CLINICA.includes(tipo)) {
      throw new Error(`Tipo de estabelecimento inválido. Use: ${TIPOS_CLINICA.join(', ')}`);
    }
    if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido.');
    if (!endereco?.trim() || !fone?.trim()) throw new Error('Endereço e telefone são obrigatórios.');
    if (!responsavel_tecnico?.trim() || !registro_responsavel?.trim()) {
      throw new Error('Informe o responsável técnico e o registro profissional dele.');
    }

    return {
      endereco, fone, imagem, atende_unimed, tipo,
      cnpj: somenteDigitos(cnpj),
      responsavel_tecnico: responsavel_tecnico.trim(),
      registro_responsavel: registro_responsavel.trim(),
    };
  }

  // O cadastro público de profissional cria sempre um profissional
  // independente: o vínculo com uma clínica só é feito pela própria clínica
  // (POST /professionals), senão qualquer um poderia se declarar dela.
  const { fone, registro_profissional, tipo, bio, imagem, codigo_especializacao, cpf } = informado;

  if (!TIPOS_PROFISSIONAL.includes(tipo)) {
    throw new Error(`Tipo de profissional inválido. Use: ${TIPOS_PROFISSIONAL.join(', ')}`);
  }
  if (!cpfValido(cpf)) throw new Error('CPF inválido.');
  if (!registro_profissional?.trim()) throw new Error('O registro profissional é obrigatório.');
  if (!fone?.trim()) throw new Error('O telefone é obrigatório.');

  return {
    fone, tipo, bio, imagem, codigo_especializacao,
    registro_profissional: registro_profissional.trim(),
    cpf: somenteDigitos(cpf),
    codigo_clinica: null,
  };
}

/** CNPJ/CPF repetido é checado antes de criar a conta, para não sobrar usuário órfão no Auth. */
async function garantirDocumentoLivre(role: Papel, campos: any, email: string) {
  if (role === 'clinica') {
    const { data } = await supabase.from('clinicas').select('codigo').eq('cnpj', campos.cnpj).maybeSingle();
    if (data) throw new Error('Já existe um estabelecimento cadastrado com este CNPJ.');
  }
  if (role === 'profissional') {
    const { data } = await supabase.from('profissionais').select('email').eq('cpf', campos.cpf).maybeSingle();
    if (data && data.email !== email) throw new Error('Já existe um profissional cadastrado com este CPF.');
  }
}

function sessaoPublica(session: { access_token: string; refresh_token: string; expires_in: number } | null) {
  return session
    ? { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in }
    : null;
}

export class AuthService {
  async login(loginData: LoginData) {
    const { email, senha, role } = loginData;

    if (!email || !senha || !PAPEIS.includes(role)) {
      throw new Error('Dados de login inválidos');
    }

    // 1. Autentica via Supabase Auth — gera o JWT real
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (authError || !authData.user) {
      throw new Error('Credenciais inválidas');
    }

    // 2. Verifica se o role bate com o cadastro
    const storedRole = authData.user.user_metadata?.role as string | undefined;

    // Se o usuário foi cadastrado com role nos metadados, valida
    if (storedRole && storedRole !== role) {
      await supabaseAuth.auth.signOut();
      throw new Error(`Credenciais inválidas`);
    }

    // 3. Busca os dados completos na tabela correspondente
    const table = TABELA_POR_PAPEL[role];
    const { data: entity, error: entityError } = await supabase
      .from(table)
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (entityError || !entity) {
      throw new Error('Credenciais inválidas');
    }

    // 4. Remove senha antes de retornar
    const safeUser = { ...entity };
    delete (safeUser as any).senha;

    return {
      user: safeUser,
      // session contém o access_token JWT que o frontend vai usar
      session: {
        access_token: authData.session?.access_token ?? '',
        refresh_token: authData.session?.refresh_token ?? '',
        expires_in: authData.session?.expires_in ?? 3600,
      },
    };
  }

  async register(registerData: RegisterData) {
    const { role, payload } = registerData;

    // Contas da prefeitura não têm cadastro público (ver aprovacao_cadastros.sql).
    if (!role || !payload || !PAPEIS.includes(role) || role === 'prefeitura') {
      throw new Error('Dados inválidos');
    }

    const { nome, email, senha, ...informado } = payload;

    if (!email || !senha) {
      throw new Error('Email e senha são obrigatórios');
    }
    if (!nome?.trim()) throw new Error('O nome é obrigatório.');
    if (!emailValido(email)) throw new Error('E-mail inválido.');
    if (String(senha).length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');

    // Valida antes de criar a conta no Auth, para não sobrar usuário órfão.
    const rest = camposDoCadastro(role, informado);
    await garantirDocumentoLivre(role, rest, email);

    // Profissional que a clínica já cadastrou na equipe: a conta é criada e
    // ligada à linha existente (pelo e-mail), mantendo o vínculo com a clínica.
    const { data: profissionalExistente } = role === 'profissional'
      ? await supabase.from('profissionais').select('*').eq('email', email).maybeSingle()
      : { data: null };

    // 1. Cria o usuário no Supabase Auth com o role nos metadados
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          role,      // salvo nos user_metadata para o middleware poder ler
          nome,
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    // 2. Insere na tabela de domínio (pacientes, clinicas ou profissionais). A
    // senha não entra aqui: quem a guarda é o Supabase Auth.
    const table = TABELA_POR_PAPEL[role];
    let { data: entity, error: entityError } = profissionalExistente
      ? { data: profissionalExistente, error: null }
      : await supabase
          .from(table)
          .insert({ nome, email, ...rest })
          .select()
          .single();

    if (entityError && role === 'clinica' && isMissingAtendeUnimedColumnError(entityError.message)) {
      const payload = { nome, email, ...rest } as any;
      const { atende_unimed, ...legacyPayload } = payload;
      const fallbackPayload = {
        ...legacyPayload,
        ...(atende_unimed !== undefined ? { unimed: atende_unimed } : {}),
      };

      const fallbackResult = await supabase
        .from(table)
        .insert(fallbackPayload)
        .select()
        .single();

      entity = fallbackResult.data;
      entityError = fallbackResult.error;

      if (entityError && isMissingUnimedColumnError(entityError.message)) {
        const secondFallbackPayload = {
          ...legacyPayload,
          ...(atende_unimed !== undefined ? { trabalha_com_horario: atende_unimed } : {}),
        };

        const secondFallbackResult = await supabase
          .from(table)
          .insert(secondFallbackPayload)
          .select()
          .single();

        entity = secondFallbackResult.data;
        entityError = secondFallbackResult.error;
      }
    }

    if (entityError) {
      // Rollback: sem isto, o usuário fica criado no Auth sem linha na tabela, e
      // a próxima tentativa falha com "User already registered" — escondendo o
      // erro real, que foi o insert. deleteUser exige a service_role.
      if (authData.user) {
        if (!usandoServiceRole) {
          console.error(
            '[register] Insert falhou e o rollback não pôde ser feito sem a ' +
              `SUPABASE_SERVICE_ROLE_KEY. Usuário órfão no Auth: ${authData.user.email}`
          );
        } else {
          const { error: rollbackError } = await supabase.auth.admin.deleteUser(
            authData.user.id
          );
          if (rollbackError) {
            console.error(
              `[register] Falha ao remover o usuário órfão ${authData.user.email}:`,
              rollbackError.message
            );
          }
        }
      }
      throw new Error(entityError.message);
    }

    const safeUser = { ...entity };
    delete (safeUser as any).senha;

    return {
      user: safeUser,
      session: authData.session ? {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
      } : null,
    };
  }

  /**
   * Dados atuais de quem está logado. É o que o app chama ao abrir, para
   * retomar a sessão salva sem pedir login de novo.
   */
  async me(user: AuthenticatedUser) {
    const { data, error } = await supabase
      .from(TABELA_POR_PAPEL[user.role])
      .select('*')
      .eq('codigo', user.entityId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Cadastro não encontrado');

    const safeUser = { ...data };
    delete (safeUser as any).senha;
    return { role: user.role, user: safeUser };
  }

  /** Troca o refresh_token por uma sessão nova (o access_token dura ~1h). */
  async refresh(refreshToken: string) {
    if (!refreshToken) throw new Error('refresh_token é obrigatório');

    const { data, error } = await novoClienteAuth().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) throw new Error('Sessão expirada. Faça login novamente.');

    return { session: sessaoPublica(data.session) };
  }
}

export const authService = new AuthService();