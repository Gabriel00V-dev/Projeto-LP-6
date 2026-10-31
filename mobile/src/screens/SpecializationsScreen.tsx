import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ModernCard from '../components/ModernCard';
import ModernButton from '../components/ModernButton';
import ModernInput from '../components/ModernInput';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../styles/theme';
import { Specialization } from '../types';
import { 
  getSpecializations, 
  createSpecialization, 
  getClinicSpecializations, 
  addSpecializationToClinic, 
  removeSpecializationFromClinic 
} from '../api/client';

type Props = {
  navigation: any;
  route?: {
    params?: {
      clinicCode?: number;
    };
  };
};

export default function SpecializationsScreen({ navigation, route }: Props) {
  const { clinicCode } = route?.params || {};
  const [loading, setLoading] = useState(false);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [clinicSpecializations, setClinicSpecializations] = useState<Specialization[]>([]);
  const [newSpecName, setNewSpecName] = useState('');

  useEffect(() => {
    loadSpecializations();
    if (clinicCode) {
      loadClinicSpecializations();
    }
  }, [clinicCode]);

  const loadSpecializations = async () => {
    setLoading(true);
    try {
      const specs = await getSpecializations();
      setSpecializations(specs);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as especializações');
    } finally {
      setLoading(false);
    }
  };

  const loadClinicSpecializations = async () => {
    if (!clinicCode) return;
    
    try {
      const specs = await getClinicSpecializations(clinicCode);
      setClinicSpecializations(specs);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as especializações da clínica');
    }
  };

  const handleCreateSpecialization = async () => {
    if (!newSpecName.trim()) {
      Alert.alert('Erro', 'Digite o nome da especialização');
      return;
    }

    try {
      await createSpecialization(newSpecName.trim());
      setNewSpecName('');
      loadSpecializations();
      Alert.alert('Sucesso', 'Especialização criada com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível criar a especialização');
    }
  };

  const handleToggleSpecialization = async (spec: Specialization) => {
    if (!clinicCode || !spec.nome) return;

    const isSelected = clinicSpecializations.some(cs => cs.nome === spec.nome);
    
    try {
      if (isSelected) {
        await removeSpecializationFromClinic(clinicCode, spec.nome);
      } else {
        await addSpecializationToClinic(clinicCode, spec.nome);
      }
      loadClinicSpecializations();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível atualizar a especialização');
    }
  };

  const renderSpecializationItem = ({ item }: { item: Specialization }) => {
    const isSelected = clinicSpecializations.some(cs => cs.nome === item.nome);
    
    return (
      <ModernCard style={styles.specializationCard}>
        <View style={styles.specializationContent}>
          <Text style={styles.specializationName}>{item.nome}</Text>
          {clinicCode && (
            <TouchableOpacity
              style={[
                styles.selectButton,
                isSelected && styles.selectedButton
              ]}
              onPress={() => handleToggleSpecialization(item)}
            >
              <Ionicons
                name={isSelected ? 'checkmark' : 'add'}
                size={18}
                color={isSelected ? colors.surface : colors.text}
              />
            </TouchableOpacity>
          )}
        </View>
      </ModernCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando especializações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Especializações</Text>
        <Text style={styles.subtitle}>
          {clinicCode 
            ? 'Gerencie as especialidades da sua clínica' 
            : 'Todas as especialidades disponíveis'
          }
        </Text>
      </View>

      {/* Create New Specialization */}
      <ModernCard style={styles.createCard}>
        <Text style={styles.createTitle}>Nova Especialização</Text>
        <ModernInput
          label="Nome da Especialização"
          value={newSpecName}
          onChangeText={setNewSpecName}
          placeholder="Ex: Cardiologia, Dermatologia..."
        />
        <ModernButton
          title="Criar"
          onPress={handleCreateSpecialization}
          disabled={!newSpecName.trim()}
          style={styles.createButton}
        />
      </ModernCard>

      {/* Selected Specializations for Clinic */}
      {clinicCode && clinicSpecializations.length > 0 && (
        <ModernCard style={styles.selectedCard}>
          <Text style={styles.selectedTitle}>Especializações Ativas</Text>
          <View style={styles.selectedList}>
            {clinicSpecializations.map((spec, index) => (
              <View key={index} style={styles.selectedItem}>
                <Text style={styles.selectedItemText}>• {spec.nome}</Text>
              </View>
            ))}
          </View>
        </ModernCard>
      )}

      {/* Specializations List */}
      <FlatList
        data={specializations}
        renderItem={renderSpecializationItem}
        keyExtractor={(item) => item.codigo?.toString() || item.nome}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  createCard: {
    margin: spacing.lg,
    gap: spacing.md,
  },
  createTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  createButton: {
    marginTop: spacing.sm,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  specializationCard: {
    marginBottom: spacing.sm,
  },
  specializationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specializationName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
    flex: 1,
  },
  selectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 40,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  selectedButtonText: {
    color: colors.surface,
  },
  selectedCard: {
    margin: spacing.lg,
    marginTop: 0,
  },
  selectedTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  selectedList: {
    gap: spacing.xs,
  },
  selectedItem: {
    paddingVertical: spacing.xs,
  },
  selectedItemText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});