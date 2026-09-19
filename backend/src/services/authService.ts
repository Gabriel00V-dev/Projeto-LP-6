import { supabase, supabaseAuth, usandoServiceRole } from '../supabaseClient';

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
  role: 'paciente' | 'clinica';
}

export interface RegisterData {
  role: 'paciente' | 'clinica';
  payload: any;
}

export class AuthService {
  async login(loginData: LoginData) {
    const { email, senha, role } = loginData;

    if (!email || !senha || !['paciente', 'clinica'].includes(role)) {
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
    const table = role === 'paciente' ? 'pacientes' : 'clinicas';
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

    if (!role || !payload) {
      throw new Error('Dados inválidos');
    }

    const { nome, email, senha, ...rest } = payload;

    if (!email || !senha) {
      throw new Error('Email e senha são obrigatórios');
    }

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

    // 2. Insere na tabela de domínio (pacientes ou clinicas)
    const table = role === 'paciente' ? 'pacientes' : 'clinicas';
    let { data: entity, error: entityError } = await supabase
      .from(table)
      .insert({ nome, email, senha, ...rest })
      .select()
      .single();

    if (entityError && role === 'clinica' && isMissingAtendeUnimedColumnError(entityError.message)) {
      const payload = { nome, email, senha, ...rest } as any;
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
}

export const authService = new AuthService();