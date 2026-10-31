import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";
import ModernCard from "../components/ModernCard";
import ModernButton from "../components/ModernButton";
import ModernInput from "../components/ModernInput";
import IconText from "../components/IconText";
import { createAppointment, getAvailableSlots, getClinicSpecializations } from "../api/client";
import { Specialization } from "../types";

type Props = {
  navigation: any;
  route: any;
};

export default function BookAppointmentScreen({ route, navigation }: Props) {
  const { clinic, patient } = route.params;
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSpecializations();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  useEffect(() => {
    console.log("Especialização mudou para:", selectedSpecialization);
  }, [selectedSpecialization]);

  const loadSpecializations = async () => {
    try {
      console.log("Carregando especializações para clínica:", clinic.codigo);
      const data = await getClinicSpecializations(clinic.codigo);
      console.log("Especializações recebidas:", JSON.stringify(data, null, 2));
      setSpecializations(data || []);
      
      if (!data || data.length === 0) {
        Alert.alert("Atenção", "Esta clínica não possui especializações cadastradas");
      }
    } catch (error: any) {
      console.error("Erro ao carregar especializações:", error);
      Alert.alert("Erro", `Não foi possível carregar as especializações: ${error.message}`);
    }
  };

  const loadAvailableSlots = async () => {
    setSelectedSlot("");
    const apiDate = formatDateForAPI(selectedDate);
    
    if (clinic.codigo) {
      try {
        const slots = await getAvailableSlots(clinic.codigo, apiDate);
        setAvailableSlots(slots);
      } catch (error) {
        console.error("Erro ao carregar horários:", error);
        Alert.alert("Erro", "Não foi possível carregar os horários disponíveis");
      }
    } else {
      setAvailableSlots([]);
    }
  };

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const handleBookAppointment = async () => {
    console.log("=== INICIANDO AGENDAMENTO ===");
    console.log("selectedSpecialization:", selectedSpecialization);
    console.log("selectedDate:", selectedDate);
    console.log("selectedSlot:", selectedSlot);
    console.log("patient:", patient);
    console.log("clinic:", clinic);

    if (!selectedSpecialization) {
      Alert.alert("Atenção", "Selecione uma especialização");
      return;
    }
    
    if (!selectedDate) {
      Alert.alert("Atenção", "Selecione uma data");
      return;
    }
    
    if (!selectedSlot) {
      Alert.alert("Atenção", "Selecione um horário disponível");
      return;
    }

    try {
      setLoading(true);
      
      console.log("Data/Hora selecionada:", selectedSlot);
      
      const payload = {
        codigo_paciente: patient.codigo,
        codigo_clinica: clinic.codigo,
        codigo_especializacao: selectedSpecialization,
        data_hora: selectedSlot,
        status: 'agendada' as const,
        observacoes: observacoes || undefined,
      };
      
      console.log("Payload do agendamento:", payload);
      
      const result = await createAppointment(payload);
      console.log("Resultado do agendamento:", result);

      Alert.alert("Sucesso", "Consulta agendada com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error("Erro ao agendar consulta:", error);
      console.error("Erro detalhado:", error.response?.data || error.message);
      Alert.alert("Erro", `Não foi possível agendar a consulta: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatSlotTime = (slot: string) => {
    const date = new Date(slot);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getMinDate = () => {
    return new Date();
  };

  return (
    <ScrollView style={styles.container}>
      <ModernCard variant="elevated" style={styles.clinicCard}>
        <Text style={styles.clinicName}>{clinic.nome}</Text>
        <IconText icon="location-outline" style={styles.clinicInfo}>{clinic.endereco}</IconText>
        {clinic.fone && <IconText icon="call-outline" style={styles.clinicInfo}>{clinic.fone}</IconText>}
      </ModernCard>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Especialização</Text>
        {specializations.length === 0 ? (
          <Text style={styles.noSlotsText}>Carregando especializações...</Text>
        ) : (
          <View style={styles.specializationsContainer}>
            {specializations.map((spec) => {
              if (!spec || !spec.codigo) {
                return null;
              }
              const isSelected = selectedSpecialization === spec.codigo;
              return (
                <TouchableOpacity
                  key={spec.codigo}
                  style={[
                    styles.specializationChip,
                    isSelected && styles.specializationChipSelected,
                  ]}
                  onPress={() => {
                    console.log("Selecionou especialização:", spec.codigo, spec.nome);
                    setSelectedSpecialization(spec.codigo);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.specializationText,
                    isSelected && styles.specializationTextSelected,
                  ]}>
                    {spec.nome}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Data da Consulta</Text>
        <TouchableOpacity 
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={24} color={colors.primary} />
          <View style={styles.datePickerTextContainer}>
            <Text style={styles.datePickerLabel}>Data Selecionada:</Text>
            <Text style={styles.datePickerText}>
              {formatDateForDisplay(selectedDate)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={getMinDate()}
            locale="pt-BR"
          />
        )}
      </View>

      {availableSlots.length > 0 && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Horários Disponíveis</Text>
          <View style={styles.slotsContainer}>
            {availableSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.slotChip,
                  selectedSlot === slot && styles.slotChipSelected
                ]}
                onPress={() => {
                  setSelectedSlot(slot);
                }}
              >
                <Ionicons 
                  name="time-outline" 
                  size={16} 
                  color={selectedSlot === slot ? colors.surface : colors.primary} 
                />
                <Text style={[
                  styles.slotText,
                  selectedSlot === slot && styles.slotTextSelected
                ]}>
                  {formatSlotTime(slot)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {availableSlots.length === 0 && (
        <ModernCard variant="outlined" style={styles.noSlotsCard}>
          <Ionicons name="time-outline" size={40} color={colors.primary} />
          <Text style={styles.noSlotsText}>Nenhum horário pré-definido</Text>
          <Text style={styles.noSlotsSubtext}>Digite o horário desejado abaixo</Text>
        </ModernCard>
      )}

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Observações (opcional)</Text>
        <ModernInput
          placeholder="Ex: Primeira consulta, sintomas específicos..."
          value={observacoes}
          onChangeText={setObservacoes}
          multiline
          numberOfLines={4}
          icon="chatbox-outline"
        />
      </View>

      <View style={styles.buttonContainer}>
        <ModernButton
          title={loading ? "Agendando..." : "Confirmar Agendamento"}
          onPress={handleBookAppointment}
          disabled={loading || !selectedSpecialization || !selectedDate || !selectedSlot}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  clinicCard: {
    marginBottom: spacing.lg,
  },
  clinicName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clinicInfo: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold as any,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  specializationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  specializationChipSelected: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  specializationText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium as any,
  },
  specializationTextSelected: {
    color: colors.surface,
    fontWeight: fontWeight.bold as any,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  datePickerTextContainer: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  datePickerText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium as any,
    textTransform: 'capitalize',
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  slotChipSelected: {
    backgroundColor: colors.primary,
  },
  slotText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium as any,
  },
  slotTextSelected: {
    color: colors.surface,
  },
  noSlotsCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  noSlotsText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as any,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  noSlotsSubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  helpText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
