import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAuth } from '../supabaseClient';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'paciente' | 'clinica';
  entityId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação não fornecido.', code: 'MISSING_TOKEN' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.', code: 'INVALID_TOKEN' });
      return;
    }

    const role = user.user_metadata?.role as 'paciente' | 'clinica' | undefined;

    if (!role || !['paciente', 'clinica'].includes(role)) {
      const { data: clinica } = await supabase.from('clinicas').select('codigo').eq('email', user.email!).maybeSingle();
      if (clinica) { req.user = { id: user.id, email: user.email!, role: 'clinica', entityId: clinica.codigo }; next(); return; }

      const { data: paciente } = await supabase.from('pacientes').select('codigo').eq('email', user.email!).maybeSingle();
      if (paciente) { req.user = { id: user.id, email: user.email!, role: 'paciente', entityId: paciente.codigo }; next(); return; }

      res.status(403).json({ error: 'Perfil de usuário não encontrado.', code: 'ENTITY_NOT_FOUND' });
      return;
    }

    const table = role === 'clinica' ? 'clinicas' : 'pacientes';
    const { data: entity, error: entityError } = await supabase.from(table).select('codigo').eq('email', user.email!).maybeSingle();

    if (entityError || !entity) {
      res.status(403).json({ error: 'Entidade vinculada ao token não encontrada.', code: 'ENTITY_NOT_FOUND' });
      return;
    }

    req.user = { id: user.id, email: user.email!, role, entityId: entity.codigo };
    next();
  } catch (err) {
    console.error('[authenticate] Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
}

export function requireClinica(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'clinica') { res.status(403).json({ error: 'Acesso restrito a clínicas.', code: 'FORBIDDEN_ROLE' }); return; }
  next();
}

export function requirePaciente(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'paciente') { res.status(403).json({ error: 'Acesso restrito a pacientes.', code: 'FORBIDDEN_ROLE' }); return; }
  next();
}