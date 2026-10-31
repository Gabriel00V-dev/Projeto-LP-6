import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getClinicById } from '../api/client';
import { Clinic } from '../types';
import { colors, spacing, fontSize, borderRadius } from '../styles/theme';
import ModernButton from '../components/ModernButton';

type Props = {
  navigation: any;
  route: {
    params: {
      clinicId: number;
      patient?: any;
    };
  };
};

export default function ClinicDetailsScreen({ route, navigation }: Props) {
  const { clinicId, patient } = route.params;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClinicDetails();
  }, []);

  const fetchClinicDetails = async () => {
    try {
      const clinicData = await getClinicById(clinicId);
      setClinic(clinicData);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes da clínica');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!clinic) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Clínica não encontrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Image
            source={clinic.imagem ? { uri: clinic.imagem } : require('../../assets/appstore.png')}
            style={styles.clinicImage}
          />
          <Text style={styles.clinicName}>{clinic.nome}</Text>
          <Text style={styles.clinicAddress}>{clinic.endereco}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailsContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações de Contato</Text>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Telefone:</Text>
              <Text style={styles.infoValue}>{clinic.fone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{clinic.email}</Text>
            </View>
          </View>

          {clinic.especializacoes && clinic.especializacoes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Especializações</Text>
              <View style={styles.specializationsContainer}>
                {clinic.especializacoes.map((spec, index) => (
                  <View key={index} style={styles.specializationTag}>
                    <Text style={styles.specializationText}>{spec}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ModernButton
          title="Agendar Consulta"
          onPress={() => {
            if (!patient || !patient.codigo) {
              Alert.alert(
                'Atenção',
                'É necessário estar logado como paciente para agendar consultas.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
              return;
            }
            navigation.navigate('BookAppointment', { clinic, patient });
          }}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.error,
  },
  header: {
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  clinicImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  clinicName: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.onPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  clinicAddress: {
    fontSize: fontSize.md,
    color: colors.onPrimary,
    textAlign: 'center',
    opacity: 0.9,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100, // Space for the footer button
  },
  detailsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoIcon: {
    marginRight: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text,
    flex: 1,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specializationTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  specializationText: {
    color: colors.onPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
