import { Response } from 'express';

/**
 * Erro com status HTTP, lançado pelos services dos serviços municipais para
 * que o controller não precise adivinhar o código a partir da mensagem.
 */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function responderErro(res: Response, error: any, contexto: string) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }

  // 23505 = unique_violation. Aparece quando duas requisições disputam o mesmo
  // horário ou a mesma vaga na fila ao mesmo tempo.
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'Este registro já existe ou o horário acabou de ser ocupado.', code: 'CONFLICT' });
  }

  console.error(`[${contexto}]`, error?.message ?? error);
  return res.status(500).json({ error: error?.message || 'Erro interno.' });
}
