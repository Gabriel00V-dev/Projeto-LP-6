import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { useClinic, ClinicAddons, Plano } from '../contexts/ClinicContexts';

// ============================================================
// CONFIG de cada add-on para o frontend
// ============================================================

interface AddonFrontendConfig {
  label: string;
  descricao: string;
  icone: string;           // nome do Ionicons
  plano_minimo: Plano;
  upgradeUrl: string;
  cor: string;             // cor do ícone desbloqueado
}

export const ADDON_CONFIG: Record<keyof ClinicAddons, AddonFrontendConfig> = {
  addon_telemedicina: {
    label: 'Telemedicina',
    descricao: 'Gere links de videoconsulta para seus pacientes',
    icone: 'videocam-outline',
    plano_minimo: 'profissional',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=telemedicina',
    cor: '#007AFF',
  },
  addon_pdf: {
    label: 'Geração de PDFs',
    descricao: 'Exporte laudos, receitas e atestados em PDF',
    icone: 'document-text-outline',
    plano_minimo: 'profissional',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=pdf',
    cor: '#FF3B30',
  },
  addon_relatorios: {
    label: 'Relatórios Avançados',
    descricao: 'Dashboards analíticos e exportação de dados',
    icone: 'bar-chart-outline',
    plano_minimo: 'enterprise',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=relatorios',
    cor: '#34C759',
  },
  addon_api_externa: {
    label: 'API Externa',
    descricao: 'Integre com sistemas HIS/PEP e webhooks',
    icone: 'code-slash-outline',
    plano_minimo: 'enterprise',
    upgradeUrl: 'https://app.suaclinica.com/planos?addon=api',
    cor: '#FF9500',
  },
};

// ============================================================
// HOOK: useAddonGuard
// ============================================================

export interface AddonGuardResult {
  isUnlocked: boolean;
  config: AddonFrontendConfig;
  subscription: any;

  // Chame em onPress — exibe o alerta de upsell se bloqueado, executa a ação se liberado
  guard: (action: () => void) => void;

  // Exibe o alerta de upsell manualmente
  showUpsell: () => void;
}

export function useAddonGuard(addon: keyof ClinicAddons): AddonGuardResult {
  const { hasAddon, subscription, startTrial } = useClinic();
  const isUnlocked = hasAddon(addon);
  const config = ADDON_CONFIG[addon];

  const showUpsell = useCallback(() => {
    const jaUsouTrial = subscription?.trial_ativo || subscription?.trial_expired;
    const trialOption = !jaUsouTrial ? [{
      text: 'Experimentar grátis (14 dias)',
      onPress: async () => {
        const { success, message } = await startTrial();
        Alert.alert(success ? 'Trial ativado!' : 'Erro', message);
      },
    }] : [];

    Alert.alert(
      `${config.label} (recurso bloqueado)`,
      `${config.descricao}\n\nDisponível a partir do plano ${config.plano_minimo}.`,
      [
        { text: 'Agora não', style: 'cancel' },
        ...trialOption,
        {
          text: 'Ver planos',
          onPress: () => Linking.openURL(config.upgradeUrl),
        },
      ]
    );
  }, [config, subscription, startTrial]);

  const guard = useCallback((action: () => void) => {
    if (isUnlocked) {
      action();
    } else {
      showUpsell();
    }
  }, [isUnlocked, showUpsell]);

  return { isUnlocked, config, subscription, guard, showUpsell };
}