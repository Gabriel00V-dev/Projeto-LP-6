import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabaseClient'; // mesmo cliente do resto do projeto
import { AuthenticatedUser } from './authMiddleware';

// ============================================================
// TIPOS
// ============================================================

export type AddonKey =
  | 'addon_telemedicina'
  | 'addon_pdf'
  | 'addon_relatorios'
  | 'addon_api_externa';

export type Plano = 'basico' | 'profissional' | 'enterprise';

/**
 * Quem assina: uma clínica ou um profissional independente. Profissional
 * vinculado a uma clínica usa a assinatura da clínica — o add-on é do
 * prestador, não de cada pessoa que atende nele.
 */
export type TipoPrestador = 'clinica' | 'profissional';

export interface Prestador {
  tipo: TipoPrestador;
  codigo: number;
}

export interface Assinatura {
  codigo: number;
  tipo_prestador: TipoPrestador;
  codigo_prestador: number;
  plano: Plano;
  addon_telemedicina: boolean;
  addon_pdf: boolean;
  addon_relatorios: boolean;
  addon_api_externa: boolean;
  trial_ativo: boolean;
  trial_expira_em: string | null;
  ativo: boolean;
  expira_em: string | null;
}

// Registro centralizado de add-ons
const ADDON_REGISTRY: Record<string, {
  key: AddonKey;
  label: string;
  descricao: string;
  plano_minimo: 'profissional' | 'enterprise';
  upgradeUrl: string;
}> = {
  telemedicina: {
    key: 'addon_telemedicina',
    label: 'Telemedicina',
    descricao: 'Agenda online e salas de videoconsulta para pacientes',
    plano_minimo: 'profissional',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=telemedicina',
  },
  pdf: {
    key: 'addon_pdf',
    label: 'Geração de PDFs',
    descricao: 'Exportação de laudos, receitas e relatórios em PDF',
    plano_minimo: 'profissional',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=pdf',
  },
  relatorios: {
    key: 'addon_relatorios',
    label: 'Relatórios Avançados',
    descricao: 'Dashboards analíticos e exportação de dados',
    plano_minimo: 'enterprise',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=relatorios',
  },
  api_externa: {
    key: 'addon_api_externa',
    label: 'API Externa',
    descricao: 'Integração com sistemas HIS/PEP e webhooks',
    plano_minimo: 'enterprise',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=api',
  },
};

// ============================================================
// QUEM É O PRESTADOR
// ============================================================

/** Prestador cuja assinatura vale para o usuário logado (paciente não tem). */
export function prestadorDoUsuario(user?: AuthenticatedUser): Prestador | null {
  if (!user) return null;
  if (user.role === 'clinica') return { tipo: 'clinica', codigo: user.entityId };
  if (user.role === 'profissional') {
    return user.codigoClinica
      ? { tipo: 'clinica', codigo: user.codigoClinica }
      : { tipo: 'profissional', codigo: user.entityId };
  }
  return null;
}

/**
 * Prestador que o próprio usuário pode assinar/alterar. Um profissional
 * vinculado enxerga a assinatura da clínica, mas não pode mexer nela.
 */
export function prestadorProprio(user?: AuthenticatedUser): Prestador | null {
  if (!user) return null;
  if (user.role === 'clinica') return { tipo: 'clinica', codigo: user.entityId };
  if (user.role === 'profissional' && !user.codigoClinica) return { tipo: 'profissional', codigo: user.entityId };
  return null;
}

/** Prestador que responde por um profissional (a clínica dele, ou ele mesmo). */
export function prestadorDoProfissional(profissional: { codigo: number; codigo_clinica?: number | null }): Prestador {
  return profissional.codigo_clinica
    ? { tipo: 'clinica', codigo: profissional.codigo_clinica }
    : { tipo: 'profissional', codigo: profissional.codigo };
}

// ============================================================
// CACHE EM MEMÓRIA (evita query a cada request — TTL: 60s)
// ============================================================

interface CacheEntry {
  data: Assinatura | null;
  expiresAt: number;
}

const subscriptionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

const chave = (p: Prestador) => `${p.tipo}:${p.codigo}`;

export function invalidateSubscriptionCache(prestador: Prestador): void {
  subscriptionCache.delete(chave(prestador));
}

// ============================================================
// BUSCA A ASSINATURA (com cache)
// ============================================================

async function getAssinatura(prestador: Prestador): Promise<Assinatura | null> {
  const entry = subscriptionCache.get(chave(prestador));
  if (entry && Date.now() <= entry.expiresAt) return entry.data;

  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .eq('tipo_prestador', prestador.tipo)
    .eq('codigo_prestador', prestador.codigo)
    .eq('ativo', true)
    .maybeSingle(); // maybeSingle não lança erro se não encontrar linha

  if (error) throw new Error(error.message);

  subscriptionCache.set(chave(prestador), { data: (data as Assinatura) ?? null, expiresAt: Date.now() + CACHE_TTL_MS });
  return (data as Assinatura) ?? null;
}

/** O add-on vale agora? Considera assinatura ativa, expiração e trial vencido. */
export function addonAtivo(assinatura: Assinatura | null, key: AddonKey): boolean {
  if (!assinatura || !assinatura.ativo || !assinatura[key]) return false;
  const agora = new Date();
  if (assinatura.expira_em && new Date(assinatura.expira_em) < agora) return false;
  if (assinatura.trial_ativo && assinatura.trial_expira_em && new Date(assinatura.trial_expira_em) < agora) return false;
  return true;
}

export async function prestadorTemAddon(prestador: Prestador, key: AddonKey): Promise<boolean> {
  return addonAtivo(await getAssinatura(prestador), key);
}

/** Todos os prestadores com o add-on valendo agora (ex.: vitrine de telemedicina). */
export async function prestadoresComAddon(key: AddonKey): Promise<Prestador[]> {
  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .eq(key, true)
    .eq('ativo', true);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Assinatura[])
    .filter((a) => addonAtivo(a, key))
    .map((a) => ({ tipo: a.tipo_prestador, codigo: a.codigo_prestador }));
}

// ============================================================
// MIDDLEWARE PRINCIPAL: checkAddon
// ============================================================

/**
 * Verifica se o prestador do usuário autenticado possui o add-on ativo.
 *
 * Uso:
 *   router.post('/gerar-link',
 *     authenticate,
 *     requirePrestador,
 *     checkAddon('telemedicina'),
 *     controller
 *   )
 */
export function checkAddon(addonName: string) {
  return async function addonGuard(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const addonConfig = ADDON_REGISTRY[addonName];

    if (!addonConfig) {
      res.status(500).json({
        error: `Add-on '${addonName}' não está registrado no servidor.`,
        code: 'ADDON_NOT_REGISTERED',
      });
      return;
    }

    const prestador = prestadorDoUsuario(req.user);

    if (!prestador) {
      res.status(403).json({
        error: 'Apenas clínicas e profissionais podem acessar esta funcionalidade.',
        code: 'FORBIDDEN_ROLE',
      });
      return;
    }

    try {
      const assinatura = await getAssinatura(prestador);

      if (assinatura?.trial_ativo && assinatura.trial_expira_em && new Date(assinatura.trial_expira_em) < new Date()) {
        res.status(403).json({
          error: 'Seu período de trial expirou.',
          code: 'TRIAL_EXPIRED',
          upgradeUrl: addonConfig.upgradeUrl,
        });
        return;
      }

      if (!addonAtivo(assinatura, addonConfig.key)) {
        res.status(403).json({
          error: `O add-on "${addonConfig.label}" não está ativo no seu plano.`,
          code: 'ADDON_NOT_ACTIVE',
          addon: {
            key: addonName,
            label: addonConfig.label,
            descricao: addonConfig.descricao,
            plano_minimo: addonConfig.plano_minimo,
          },
          plano_atual: assinatura?.plano ?? 'basico',
          message: `Para usar ${addonConfig.label}, faça upgrade para o plano ${addonConfig.plano_minimo}.`,
          upgradeUrl: addonConfig.upgradeUrl,
        });
        return;
      }

      // Add-on ativo: injeta assinatura no req e segue para o controller
      (req as any).assinatura = assinatura;
      next();
    } catch (err) {
      console.error('[checkAddon] Erro ao verificar add-on:', err);
      res.status(500).json({ error: 'Erro interno ao verificar permissões.' });
    }
  };
}

// ============================================================
// SERVICE: Gerenciamento de add-ons (usado em rotas admin)
// ============================================================

const ADDONS_POR_PLANO: Record<Plano, Pick<Assinatura, AddonKey>> = {
  basico:        { addon_telemedicina: false, addon_pdf: false, addon_relatorios: false, addon_api_externa: false },
  profissional:  { addon_telemedicina: true,  addon_pdf: true,  addon_relatorios: false, addon_api_externa: false },
  enterprise:    { addon_telemedicina: true,  addon_pdf: true,  addon_relatorios: true,  addon_api_externa: true  },
};

export class AddonService {
  async getSubscription(prestador: Prestador): Promise<Assinatura | null> {
    return getAssinatura(prestador);
  }

  /**
   * Profissionais independentes e clínicas novas não têm linha em
   * `assinaturas` até alguém mexer no plano; aqui a linha básica é criada sob
   * demanda, para que update/trial sempre tenham onde gravar.
   */
  private async garantirAssinatura(prestador: Prestador): Promise<Assinatura> {
    const existente = await getAssinatura(prestador);
    if (existente) return existente;

    const { data, error } = await supabase
      .from('assinaturas')
      .insert({ tipo_prestador: prestador.tipo, codigo_prestador: prestador.codigo, plano: 'basico' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    invalidateSubscriptionCache(prestador);
    return data as Assinatura;
  }

  private async atualizar(prestador: Prestador, campos: Partial<Assinatura>): Promise<Assinatura> {
    const atual = await this.garantirAssinatura(prestador);

    const { data, error } = await supabase
      .from('assinaturas')
      .update(campos)
      .eq('codigo', atual.codigo)
      .select()
      .single();

    if (error) throw new Error(error.message);
    invalidateSubscriptionCache(prestador);
    return data as Assinatura;
  }

  async setAddon(prestador: Prestador, addonKey: AddonKey, value: boolean): Promise<Assinatura> {
    return this.atualizar(prestador, { [addonKey]: value });
  }

  async upgradePlan(prestador: Prestador, plano: Plano): Promise<Assinatura> {
    return this.atualizar(prestador, { plano, ...ADDONS_POR_PLANO[plano] });
  }

  async startTrial(prestador: Prestador): Promise<Assinatura> {
    const trialExpira = new Date();
    trialExpira.setDate(trialExpira.getDate() + 14);

    return this.atualizar(prestador, {
      trial_ativo: true,
      trial_expira_em: trialExpira.toISOString(),
      addon_telemedicina: true,
      addon_pdf: true,
    });
  }

  async endTrial(prestador: Prestador): Promise<void> {
    await this.atualizar(prestador, { trial_ativo: false, addon_telemedicina: false, addon_pdf: false });
  }
}

export const addonService = new AddonService();
