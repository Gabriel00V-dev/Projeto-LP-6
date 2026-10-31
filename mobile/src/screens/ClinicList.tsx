import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ClinicCard from "../components/ClinicCard";
import ModernInput from "../components/ModernInput";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from "../styles/theme";
import { getClinics } from "../api/client";
import { Clinic } from "../types";
import { useSpecializations } from "../hooks/useSpecializations";

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.9;
const COLLAPSED_TRANSLATE_Y = SHEET_HEIGHT * 0.42;

type Props = {
  navigation: any;
  route?: any;
};

export default function ClinicList({ navigation, route }: Props) {
  const patient = route?.params?.patient;
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSearchTerm, setFilterSearchTerm] = useState("");
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [filterByUnimed, setFilterByUnimed] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [specializationSearchTerm, setSpecializationSearchTerm] = useState("");

  const sheetTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const dragStartY = useRef(COLLAPSED_TRANSLATE_Y);

  const { specializations } = useSpecializations();

  // Filtrar especialidades baseado na busca
  const filteredSpecializations = useMemo(
    () =>
      specializations.filter((spec) =>
        spec.nome.toLowerCase().includes(specializationSearchTerm.toLowerCase())
      ),
    [specializations, specializationSearchTerm]
  );

  // Debug - verificar se patient está chegando
  useEffect(() => {
    console.log('ClinicList - Patient data:', patient);
  }, [patient]);

  const fetchClinics = async () => {
    setLoading(true);
    try {
      const data = await getClinics();
      setClinics(data);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível carregar as clínicas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const filteredClinics = useMemo(() => {
    let filtered = clinics;

    // Filtro por especialidades (múltiplas)
    if (selectedSpecializations.length > 0) {
      filtered = filtered.filter((clinic) =>
        clinic.especializacoes?.some((esp) =>
          selectedSpecializations.includes(esp)
        )
      );
    }

    // Filtro por atendimento Unimed
    if (filterByUnimed) {
      filtered = filtered.filter((clinic) => clinic.atende_unimed === true);
    }

    // Filtro por nome de clínica (no modal e na busca)
    if (filterSearchTerm) {
      const lowercasedTerm = filterSearchTerm.toLowerCase();
      filtered = filtered.filter((clinic) =>
        clinic.nome.toLowerCase().includes(lowercasedTerm)
      );
    }

    // Busca geral por nome ou endereço
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (clinic) =>
          clinic.nome.toLowerCase().includes(lowercasedTerm) ||
          clinic.endereco?.toLowerCase().includes(lowercasedTerm)
      );
    }

    return filtered;
  }, [clinics, searchTerm, selectedSpecializations, filterSearchTerm, filterByUnimed]);

  const toggleSpecialization = (specName: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(specName)
        ? prev.filter((s) => s !== specName)
        : [...prev, specName]
    );
  };

  const clearAllFilters = () => {
    setSelectedSpecializations([]);
    setFilterSearchTerm("");
    setSpecializationSearchTerm("");
    setFilterByUnimed(false);
    setIsFilterModalVisible(false);
  };

  const openFiltersModal = () => {
    sheetTranslateY.setValue(COLLAPSED_TRANSLATE_Y);
    setIsFilterModalVisible(true);
  };

  const closeFiltersModal = () => {
    setIsFilterModalVisible(false);
  };

  const snapSheet = (toValue: number) => {
    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((value) => {
          dragStartY.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const next = Math.min(
          COLLAPSED_TRANSLATE_Y,
          Math.max(0, dragStartY.current + gestureState.dy)
        );
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const projected = dragStartY.current + gestureState.dy;
        const shouldExpand = gestureState.vy < -0.2 || projected < COLLAPSED_TRANSLATE_Y * 0.55;
        snapSheet(shouldExpand ? 0 : COLLAPSED_TRANSLATE_Y);
      },
      onPanResponderTerminate: () => {
        snapSheet(COLLAPSED_TRANSLATE_Y);
      },
    })
  ).current;

  const onRefresh = () => {
    setSearchTerm("");
    clearAllFilters();
    fetchClinics();
  };

  const activeFiltersCount =
    selectedSpecializations.length +
    (filterSearchTerm ? 1 : 0) +
    (filterByUnimed ? 1 : 0);

  const renderClinicItem = ({ item }: { item: Clinic }) => (
    <ClinicCard
      clinic={item}
      onPress={() => navigation.navigate("ClinicDetails", { clinicId: item.codigo, patient })}
    />
  );

  const renderFiltersModal = () => (
    <Modal
      visible={isFilterModalVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {
        closeFiltersModal();
      }}
    >
      <View style={[styles.modalOverlay, Platform.OS === "web" && styles.webModalOverlay]}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlayButton}
          onPress={closeFiltersModal}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            Platform.OS === "web" && styles.webModalContainer,
            Platform.OS !== "web" && {
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.dragIndicatorContainer} {...handlePanResponder.panHandlers}>
            <View style={styles.dragIndicator} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalFullContainer}
          >
            <View style={styles.modalHeaderSimple}>
          <Text style={styles.modalTitle}>Filtros Avançados</Text>
          <TouchableOpacity
                onPress={closeFiltersModal}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContentSimple}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="always"
          scrollEnabled={true}
          nestedScrollEnabled={true}
        >
          {/* Seção de Busca por Nome */}
          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="search-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Buscar por Nome</Text>
            </View>
            <ModernInput
              value={filterSearchTerm}
              onChangeText={setFilterSearchTerm}
              placeholder="Digite o nome da clínica..."
              icon="medical-outline"
              style={styles.filterInput}
            />
          </View>

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Convênio</Text>
            </View>

            <TouchableOpacity
              style={styles.unimedFilterCard}
              onPress={() => setFilterByUnimed((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={styles.unimedFilterLeft}>
                <Ionicons
                  name={filterByUnimed ? "checkbox" : "square-outline"}
                  size={20}
                  color={filterByUnimed ? colors.success : colors.textSecondary}
                />
                <View style={styles.unimedFilterTextContainer}>
                  <Text style={styles.unimedFilterTitle}>Mostrar apenas clínicas que atendem Unimed</Text>
                  <Text style={styles.unimedFilterSubtitle}>
                    Exibe somente clínicas com atendimento Unimed ativo
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Seção de Especialidades */}
          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Especialidades</Text>
              {selectedSpecializations.length > 0 && (
                <Text style={styles.selectedCount}>
                  {selectedSpecializations.length} selecionada(s)
                </Text>
              )}
            </View>

            <ModernInput
              value={specializationSearchTerm}
              onChangeText={setSpecializationSearchTerm}
              placeholder="Pesquisar especialidade..."
              icon="search-outline"
              style={styles.filterInput}
            />

            <View style={styles.specializationGrid}>
              {filteredSpecializations.length > 0 ? (
                filteredSpecializations.map((spec) => (
                  <TouchableOpacity
                    key={spec.codigo}
                    style={[
                      styles.specializationChip,
                      selectedSpecializations.includes(spec.nome) &&
                        styles.specializationChipActive,
                    ]}
                    onPress={() => toggleSpecialization(spec.nome)}
                  >
                    <Ionicons
                      name={
                        selectedSpecializations.includes(spec.nome)
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={18}
                      color={
                        selectedSpecializations.includes(spec.nome)
                          ? colors.primary
                          : colors.textSecondary
                      }
                      style={styles.chipCheckbox}
                    />
                    <Text
                      style={[
                        styles.specializationChipText,
                        selectedSpecializations.includes(spec.nome) &&
                          styles.specializationChipTextActive,
                      ]}
                    >
                      {spec.nome}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptySpecializations}>
                  <Ionicons name="search-outline" size={32} color={colors.textMuted} />
                  <Text style={styles.emptySpecializationsText}>
                    Nenhuma especialidade encontrada
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.modalContentPadding} />
        </ScrollView>

        {/* Footer com Botões - Fixo */}
        <View style={styles.modalFooterSimple}>
          <TouchableOpacity
            style={styles.buttonClear}
            onPress={clearAllFilters}
          >
            <Ionicons name="trash-outline" size={18} color={colors.primary} />
            <Text style={styles.buttonClearText}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonApply}
                onPress={closeFiltersModal}
          >
            <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
            <Text style={styles.buttonApplyText}>Aplicar</Text>
          </TouchableOpacity>
        </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIcon}>
        <Ionicons name="medical-outline" size={64} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyStateTitle}>Nenhuma clínica encontrada</Text>
      <Text style={styles.emptyStateText}>
        {searchTerm || selectedSpecializations.length > 0 || filterSearchTerm || filterByUnimed
          ? "Tente ajustar sua busca ou filtros para encontrar mais resultados"
          : "Não há clínicas disponíveis no momento"
        }
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        <Text style={styles.refreshButtonText}>Recarregar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSpecializationFilters = () => (
    <View style={styles.filtersSection}>
      <View style={styles.filterHeader}>
        <Ionicons name="options-outline" size={18} color={colors.primary} />
        <Text style={styles.filterHeaderText}>Filtros</Text>
        {(activeFiltersCount > 0) && (
          <TouchableOpacity
            style={styles.clearFilterButton}
            onPress={clearAllFilters}
          >
            <Text style={styles.clearFilterText}>Limpar tudo</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.filterButtonContainer}
        onPress={openFiltersModal}
      >
        <View style={styles.filterButton}>
          <Ionicons name="funnel-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.filterButtonText}>
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtro(s) ativo(s)`
              : "Filtros"}
          </Text>
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color={colors.onPrimary}
            style={styles.filterButtonIcon}
          />
        </View>
      </TouchableOpacity>

      {selectedSpecializations.length > 0 && (
        <View style={styles.activeTags}>
          {selectedSpecializations.map((spec) => (
            <View key={spec} style={styles.tag}>
              <Text style={styles.tagText}>{spec}</Text>
              <TouchableOpacity onPress={() => toggleSpecialization(spec)}>
                <Ionicons name="close" size={14} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {filterByUnimed && (
        <View style={styles.activeTags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Atende Unimed</Text>
            <TouchableOpacity onPress={() => setFilterByUnimed(false)}>
              <Ionicons name="close" size={14} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={[styles.header, Platform.OS === 'web' && styles.webHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Ionicons name="medical" size={28} color={colors.onPrimary} />
            <Text style={styles.title}>Clínicas</Text>
          </View>
          <Text style={styles.subtitle}>
            Encontre a clínica ideal para você
          </Text>
        </View>
        
        <View style={styles.searchContainer}>
          <ModernInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar por nome ou endereço..."
            icon="search-outline"
            style={styles.searchInput}
          />
        </View>
      </LinearGradient>

      {renderSpecializationFilters()}
      {renderFiltersModal()}

      {loading && !clinics.length ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando clínicas...</Text>
            <Text style={styles.loadingSubtext}>Aguarde um momento</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredClinics}
          renderItem={renderClinicItem}
          numColumns={Platform.OS === 'web' ? 3 : 1}
          columnWrapperStyle={Platform.OS === 'web' ? styles.webColumn : undefined}
          keyExtractor={(item) => item.codigo.toString()}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContentContainer,
            Platform.OS === 'web' && styles.webListContentContainer,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  webHeader: {
    paddingTop: 48,
    paddingBottom: 40,
    borderRadius: 0,
  },
  headerContent: {
    marginBottom: spacing.lg,
    ...(Platform.OS === 'web'
      ? {
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }
      : {}),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
    marginLeft: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.onPrimary,
    textAlign: 'center',
    opacity: 0.9,
  },
  searchContainer: {
    marginTop: spacing.md,
    ...(Platform.OS === 'web'
      ? {
          width: '100%',
          maxWidth: 960,
          alignSelf: 'center',
        }
      : {}),
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 0,
    ...shadows.medium,
  },
  filtersSection: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    ...(Platform.OS === 'web'
      ? {
          paddingHorizontal: 32,
          paddingVertical: 20,
          maxWidth: 1280,
          width: '100%',
          alignSelf: 'center',
          borderRadius: 0,
        }
      : {}),
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...(Platform.OS === 'web'
      ? {
          paddingHorizontal: 0,
        }
      : {}),
  },
  filterHeaderText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  clearFilterButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
  clearFilterText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  filterButtonContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...(Platform.OS === 'web'
      ? {
          paddingHorizontal: 0,
          maxWidth: 360,
        }
      : {}),
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  filterButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.onPrimary,
    flex: 1,
    marginLeft: spacing.md,
  },
  filterButtonIcon: {
    marginLeft: spacing.md,
  },
  activeTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
  },
  tagText: {
    color: colors.onPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  
  // Modal Styles
  modalFullContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeaderSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: colors.textMuted,
    borderRadius: 2,
  },
  modalContentSimple: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  modalContentPadding: {
    height: spacing.xl,
  },
  modalFooterSimple: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  webModalOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayButton: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    width: '100%',
    height: height * 0.9,
    ...shadows.large,
  },
  webModalContainer: {
    width: '100%',
    maxWidth: 720,
    height: '85%',
    maxHeight: 720,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  filterSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  selectedCount: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  filterInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.md,
  },
  unimedFilterCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  unimedFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unimedFilterTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  unimedFilterTitle: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  unimedFilterSubtitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  specializationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  emptySpecializations: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceVariant,
  },
  emptySpecializationsText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontWeight: fontWeight.medium,
  },
  specializationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    flex: 1,
    minWidth: '45%',
  },
  specializationChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipCheckbox: {
    marginRight: spacing.md,
  },
  specializationChipText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  specializationChipTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  buttonClear: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonClearText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  buttonApply: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonApplyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.onPrimary,
    marginLeft: spacing.sm,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  loadingSubtext: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  listContentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  webListContentContainer: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 64,
  },
  webColumn: {
    gap: 24,
    alignItems: 'stretch',
    marginBottom: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  emptyStateIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.small,
  },
  refreshButtonText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
  },
});
