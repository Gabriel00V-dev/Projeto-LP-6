import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, getStoredToken } from '../api/client';
import { getErrorMessage } from '../utils/errorMessage';

export type Plano = 'basico' | 'profissional' | 'enterprise';

export interface ClinicAddons {
  addon_telemedicina: boolean;
  addon_pdf: boolean;
  addon_relatorios: boolean;
  addon_api_externa: boolean;
}

export interface ClinicSubscription {
  plano: Plano;
  addons: ClinicAddons;
  trial_ativo: boolean;
  trial_expira_em: string | null;
  trial_expired?: boolean;
}

interface ClinicContextData {
  clinic: any | null;
  subscription: ClinicSubscription | null;
  loading: boolean;
  hasAddon: (addon: keyof ClinicAddons) => boolean;
  loadClinicSession: (clinicData: any, accessToken: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  startTrial: () => Promise<{ success: boolean; message: string }>;
  clearSession: () => void;
}

const SUBSCRIPTION_STORAGE_KEY = '@clinica:subscription';

const DEFAULT_SUBSCRIPTION: ClinicSubscription = {
  plano: 'basico',
  addons: { addon_telemedicina: false, addon_pdf: false, addon_relatorios: false, addon_api_externa: false },
  trial_ativo: false,
  trial_expira_em: null,
};

const ClinicContext = createContext<ClinicContextData>({} as ClinicContextData);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<any | null>(null);
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const clinicIdRef = useRef<number | null>(null);

  const fetchSubscription = useCallback(async (): Promise<ClinicSubscription> => {
    try {
      // Pega o token do AsyncStorage (salvo pelo authLogin no client.ts)
      const token = await getStoredToken();
      if (!token) throw new Error('Sem token');

      const response = await fetch(`${BASE_URL}/addons/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Falha ao buscar assinatura');

      const data = await response.json();

      const parsed: ClinicSubscription = {
        plano: data.plano ?? 'basico',
        addons: {
          addon_telemedicina: data.addon_telemedicina ?? false,
          addon_pdf: data.addon_pdf ?? false,
          addon_relatorios: data.addon_relatorios ?? false,
          addon_api_externa: data.addon_api_externa ?? false,
        },
        trial_ativo: data.trial_ativo ?? false,
        trial_expira_em: data.trial_expira_em ?? null,
        trial_expired: data.trial_expired ?? false,
      };

      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {
      const cached = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (cached) return JSON.parse(cached) as ClinicSubscription;
      return DEFAULT_SUBSCRIPTION;
    }
  }, []);

  // Chamado no LoginScreen após authLogin bem-sucedido
  // accessToken já foi salvo pelo client.ts — passamos só para conveniência
  const loadClinicSession = useCallback(async (clinicData: any, _accessToken: string) => {
    setLoading(true);
    setClinic(clinicData);
    clinicIdRef.current = clinicData.codigo;

    const sub = await fetchSubscription();
    setSubscription(sub);
    setLoading(false);
  }, [fetchSubscription]);

  const refreshSubscription = useCallback(async () => {
    if (!clinicIdRef.current) return;
    setLoading(true);
    const sub = await fetchSubscription();
    setSubscription(sub);
    setLoading(false);
  }, [fetchSubscription]);

  const startTrial = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      const token = await getStoredToken();
      if (!token) return { success: false, message: 'Não autenticado.' };

      const response = await fetch(`${BASE_URL}/addons/trial`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setSubscription(prev => prev ? {
          ...prev,
          trial_ativo: true,
          addons: { ...prev.addons, addon_telemedicina: true, addon_pdf: true },
        } : prev);
        return { success: true, message: getErrorMessage(data, 'Trial ativado com sucesso.') };
      }

      return { success: false, message: getErrorMessage(data, 'Erro ao ativar trial.') };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  }, []);

  const hasAddon = useCallback((addon: keyof ClinicAddons): boolean => {
    return subscription?.addons[addon] ?? false;
  }, [subscription]);

  const clearSession = useCallback(async () => {
    setClinic(null);
    setSubscription(null);
    clinicIdRef.current = null;
    await AsyncStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
    // O token é removido pelo authLogout() no client.ts — chamado no logout do ClinicMenu
  }, []);

  return (
    <ClinicContext.Provider value={{ clinic, subscription, loading, hasAddon, loadClinicSession, refreshSubscription, startTrial, clearSession }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error('useClinic deve ser usado dentro de <ClinicProvider>');
  return context;
}