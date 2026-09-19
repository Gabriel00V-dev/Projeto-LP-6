import { supabase, usandoServiceRole } from '../supabaseClient';

/**
 * Senha e e-mail de login vivem no Supabase Auth, não nas tabelas de domínio.
 * As tabelas se ligam ao Auth pelo e-mail (ver authService.login), então
 * alterar um sem o outro quebra o login de forma silenciosa: a autenticação
 * passa e a busca da linha correspondente falha.
 *
 * Estas funções exigem a service_role, que é o que permite alterar a conta de
 * outro usuário a partir do servidor.
 */

function garantirPrivilegio(authUserId?: string): asserts authUserId is string {
  if (!usandoServiceRole) {
    throw new Error(
      'Alteração de credenciais indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
    );
  }
  if (!authUserId) {
    throw new Error('Não foi possível identificar a conta a ser alterada.');
  }
}

export async function alterarSenhaNoAuth(authUserId: string | undefined, senha: string) {
  garantirPrivilegio(authUserId);

  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password: senha,
  });

  if (error) {
    throw new Error(`Não foi possível alterar a senha: ${error.message}`);
  }
}

export async function alterarEmailNoAuth(authUserId: string | undefined, email: string) {
  garantirPrivilegio(authUserId);

  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    email,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Não foi possível alterar o e-mail de login: ${error.message}`);
  }
}
