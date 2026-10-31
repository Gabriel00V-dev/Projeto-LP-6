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

  const loadSpecializations = async () => {
    try {
      const data = await getClinicSpecializations(clinic.codigo);
      setSpecializations(data);
    } catch (error) {
      console.error("Erro ao carregar especializações:", error);
    }
  };

  // Valida se a data está no formato DD/MM/AAAA, é uma data real e não está no passado
  const isValidDate = (date: string) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
    const [day, month, year] = date.split('/').map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return false;
    }
    // Não permite datas no passado
    const today = new Date();
    today.setHours(0,0,0,0);
    return dateObj >= today;
  };

  // Máscara para DD/MM/AAAA
  const formatDateInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = cleaned.slice(0,2) + '/' + cleaned.slice(2);
    } else if (cleaned.length > 4) {
      formatted = cleaned.slice(0,2) + '/' + cleaned.slice(2,4) + '/' + cleaned.slice(4,8);
    }
    return formatted;
  };

  // Converte DD/MM/AAAA para AAAA-MM-DD
  const convertToApiDate = (date: string) => {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [day, month, year] = date.split('/');
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const handleDateChange = async (text: string) => {
    const formatted = formatDateInput(text);
    setSelectedDate(formatted);
    setSelectedSlot("");

    if (!isValidDate(formatted)) {
      setAvailableSlots([]);
      return;
    }

    const apiDate = convertToApiDate(formatted);
    if (apiDate && clinic.codigo) {
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

  const handleBookAppointment = async () => {
    if (!selectedSpecialization) {
      Alert.alert("Atenção", "Selecione uma especialização");
      return;
    }
    
    if (!selectedDate) {
      Alert.alert("Atenção", "Selecione uma data");
      return;
    }
    
    if (!selectedSlot) {
      Alert.alert("Atenção", "Selecione um horário");
      return;
    }

    try {
      setLoading(true);
      
      await createAppointment({
        codigo_paciente: patient.codigo,
        codigo_clinica: clinic.codigo,
        codigo_especializacao: selectedSpecialization,
        data_hora: selectedSlot,
        status: 'agendada',
        observacoes: observacoes || undefined,
      });

      Alert.alert("Sucesso", "Consulta agendada com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error("Erro ao agendar consulta:", error);
      Alert.alert("Erro", "Não foi possível agendar a consulta");
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const formatSlotTime = (slot: string) => {
    const date = new Date(slot);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
        <View style={styles.specializationsContainer}>
          {specializations.map((spec) => {
            const isSelected = selectedSpecialization === spec.codigo;
            return (
              <TouchableOpacity
                key={spec.codigo}
                style={[
                  styles.specializationChip,
                  isSelected && styles.specializationChipSelected,
                  isSelected && { borderColor: colors.primary, borderWidth: 2, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }
                ]}
                onPress={() => setSelectedSpecialization(spec.codigo!)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.specializationText,
                  isSelected && styles.specializationTextSelected,
                  isSelected && { color: colors.surface, fontWeight: fontWeight.bold }
                ]}>
                  {spec.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Data da Consulta</Text>
        <ModernInput
          placeholder="DD/MM/AAAA"
          value={selectedDate}
          onChangeText={handleDateChange}
          icon="calendar-outline"
          keyboardType="numeric"
          maxLength={10}
          error={selectedDate.length === 10 && !isValidDate(selectedDate) ? "Data inválida ou no passado" : undefined}
        />
        <Text style={styles.helperText}>Digite a data no formato DD/MM/AAAA (Ex: 25/10/2025)</Text>
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
                onPress={() => setSelectedSlot(slot)}
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

      {selectedDate && availableSlots.length === 0 && (
        <ModernCard variant="outlined" style={styles.noSlotsCard}>
          <Ionicons name="sad-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.noSlotsText}>Nenhum horário disponível para esta data</Text>
          <Text style={styles.noSlotsSubtext}>Tente selecionar outra data</Text>
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
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  specializationChipSelected: {
    backgroundColor: colors.primary,
  },
  specializationText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium as any,
  },
  specializationTextSelected: {
    color: colors.surface,
  },
  helperText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  },
  noSlotsSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  buttonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
