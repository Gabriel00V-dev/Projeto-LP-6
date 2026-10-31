import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ModernButton from '../components/ModernButton';
import ModernCard from '../components/ModernCard';
import IconText from '../components/IconText';
import { PremiumActionCard } from '../components/PremiumGate';
import { useClinic } from '../contexts/ClinicContexts';
import { authLogout, getProfessional } from '../api/client';
import { Professional } from '../types';
import { ROTULO_PROFISSIONAL } from '../utils/serviceFormat';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../styles/theme';

type Props = {
  navigation: any;
  route: any;
};

/** Painel do profissional (independente ou vinculado a uma clínica/UPA). */
export default function ProfessionalMenu({ route, navigation }: Props) {
  const [professional, setProfessional] = useState<Professional | null>(route.params?.professional ?? null);
  const { subscription, clearSession } = useClinic();

  useEffect(() => {
    const codigo = route.params?.professional?.codigo;
    if (!codigo) return;
    // O login devolve só a linha da tabela; aqui vêm a clínica e a especialidade.
    getProfessional(codigo).then(setProfessional).catch((error) => {
      console.warn('Não foi possível recarregar os dados do profissional.', error);
    });
  }, [route.params?.professional?.codigo]);

  const handleLogout = async () => {
    await authLogout();
    clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const atuaEmUpa = professional?.clinica_tipo === 'upa' && professional.codigo_clinica;

  const acoes = [
    {
      icone: 'calendar-outline' as const,
      titulo: 'Agenda de atendimentos',
      descricao: 'Consultas do dia, confirmação, evolução e teleconsulta',
      botao: 'Abrir',
      onPress: () => navigation.navigate('ProviderAgenda', { professional }),
    },
    {
      icone: 'time-outline' as const,
      titulo: 'Meus horários',
      descricao: 'Horários presenciais e online da semana',
      botao: 'Configurar',
      onPress: () => navigation.navigate('Availability', { professional }),
    },
    ...(atuaEmUpa
      ? [{
          icone: 'medkit-outline' as const,
          titulo: 'Fila da UPA',
          descricao: `Triagem e chamada de pacientes — ${professional?.clinica_nome}`,
          botao: 'Abrir',
          onPress: () => navigation.navigate('UpaStaff', { unitId: professional!.codigo_clinica, unitName: professional!.clinica_nome }),
        }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.headerGradient}>
        <Ionicons name="medkit-outline" size={50} color={colors.onPrimary} />
        <Text style={styles.headerTitle}>{professional?.nome || 'Profissional'}</Text>
        <Text style={styles.headerSubtitle}>
          {professional ? ROTULO_PROFISSIONAL[professional.tipo] : ''}
          {professional?.registro_profissional ? ` · ${professional.registro_profissional}` : ''}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.formContainer}>
          <ModernCard variant="elevated" style={styles.infoCard}>
            <Text style={styles.cardTitle}>
              {professional?.codigo_clinica ? `Equipe de ${professional.clinica_nome ?? 'clínica'}` : 'Atendimento independente'}
            </Text>
            {professional?.especializacao_nome ? <IconText icon="medical-outline" style={styles.infoText}>{professional.especializacao_nome}</IconText> : null}
            {professional?.email ? <IconText icon="mail-outline" style={styles.infoText}>{professional.email}</IconText> : null}
            {professional?.fone ? <IconText icon="call-outline" style={styles.infoText}>{professional.fone}</IconText> : null}
          </ModernCard>

          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Atendimento</Text>
            {acoes.map((acao) => (
              <ModernCard key={acao.titulo} variant="outlined" style={styles.actionCard}>
                <View style={styles.actionContent}>
                  <View style={styles.actionInfo}>
                    <IconText icon={acao.icone} color={colors.primary} size={18} style={styles.actionTitle}>{acao.titulo}</IconText>
                    <Text style={styles.actionDescription}>{acao.descricao}</Text>
                  </View>
                  <ModernButton title={acao.botao} onPress={acao.onPress} size="small" />
                </View>
              </ModernCard>
            ))}
          </View>

          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Telemedicina</Text>
            <Text style={styles.sectionSubtitle}>
              {professional?.codigo_clinica
                ? 'O add-on é contratado pela sua clínica.'
                : subscription?.addons.addon_telemedicina
                  ? 'Add-on ativo: crie horários online em "Meus horários".'
                  : 'Assine o add-on para atender por vídeo.'}
            </Text>
            <PremiumActionCard
              addon="addon_telemedicina"
              onPress={() => navigation.navigate('Availability', { professional })}
            />
          </View>

          <View style={styles.logoutContainer}>
            <ModernButton title="Sair da Conta" onPress={handleLogout} variant="outline" size="medium" fullWidth />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.onPrimary, marginTop: spacing.md, textAlign: 'center' },
  headerSubtitle: { fontSize: fontSize.md, color: colors.onPrimary, marginTop: spacing.xs, opacity: 0.9 },
  contentContainer: { flexGrow: 1, padding: spacing.lg },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: -spacing.xl,
    ...Platform.select({
      ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  infoCard: { marginBottom: spacing.md, gap: spacing.xs },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.xs },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  actionsContainer: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 2 },
  sectionSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  actionCard: { marginBottom: spacing.md },
  actionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionInfo: { flex: 1, marginRight: spacing.md },
  actionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.xs },
  actionDescription: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  logoutContainer: { marginTop: spacing.lg },
});
