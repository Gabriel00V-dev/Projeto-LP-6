/**
 * Remove a coluna `senha` antes de devolver linhas de clinicas/pacientes.
 *
 * Essas consultas usam select('*'), então a coluna vem junto e ia parar na
 * resposta de endpoints públicos como GET /clinics. A senha de verdade vive no
 * Supabase Auth; esta coluna é resquício do modelo antigo e não tem por que
 * trafegar.
 */
export function semSenha<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const { senha, ...resto } = row as Record<string, unknown>;
  return resto as T;
}

export function semSenhaLista<T>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).map(semSenha);
}
