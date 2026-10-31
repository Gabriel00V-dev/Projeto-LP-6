import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";
import ModernCard from "../components/ModernCard";
import ModernButton from "../components/ModernButton";
import IconText from "../components/IconText";
import { getAppointmentsByClinic, updateAppointmentStatus } from "../api/client";
import { AppointmentWithDetails } from "../types";

type Props = {
  navigation: any;
  route: any;
};

export default function ClinicPatientsScreen({ route, navigation }: Props) {
  const clinic = route.params?.clinic;
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (clinic?.codigo) {
      loadAppointments();
    }
  }, [clinic?.codigo]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointmentsByClinic(clinic.codigo);
      setAppointments(data);
    } catch (error: any) {
      console.error("Erro ao carregar consultas:", error);
      Alert.alert("Erro", "Não foi possível carregar as consultas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleUpdateStatus = (codigo: number, newStatus: 'confirmada' | 'cancelada' | 'concluida') => {
    const statusLabels = {
      confirmada: 'Confirmar',
      cancelada: 'Cancelar',
      concluida: 'Concluir'
    };

    Alert.alert(
      `${statusLabels[newStatus]} Consulta`,
      `Tem certeza que deseja ${statusLabels[newStatus].toLowerCase()} esta consulta?`,
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim",
          onPress: async () => {
            try {
              await updateAppointmentStatus(codigo, newStatus);
              Alert.alert("Sucesso", "Status atualizado com sucesso");
              loadAppointments();
            } catch (error) {
              Alert.alert("Erro", "Não foi possível atualizar o status");
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendada': return colors.warning;
      case 'confirmada': return colors.success;
      case 'cancelada': return colors.error;
      case 'concluida': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'agendada': return 'time-outline';
      case 'confirmada': return 'checkmark-circle-outline';
      case 'cancelada': return 'close-circle-outline';
      case 'concluida': return 'checkmark-done-outline';
      default: return 'help-outline';
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const filteredAppointments = appointments.filter(apt => {
    const now = new Date();
    const aptDate = new Date(apt.data_hora);
    
    if (filter === 'upcoming') {
      return (apt.status === 'agendada' || apt.status === 'confirmada') && aptDate >= now;
    } else if (filter === 'past') {
      return apt.status === 'concluida' || apt.status === 'cancelada' || aptDate < now;
    }
    return true;
  });

  // Agrupar por paciente
  const patientGroups = filteredAppointments.reduce((acc, apt) => {
    const patientName = apt.paciente_nome || 'Paciente';
    if (!acc[patientName]) {
      acc[patientName] = [];
    }
    acc[patientName].push(apt);
    return acc;
  }, {} as Record<string, AppointmentWithDetails[]>);

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'upcoming' && styles.filterButtonActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.filterButtonText, filter === 'upcoming' && styles.filterButtonTextActive]}>
            Próximas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'past' && styles.filterButtonActive]}
          onPress={() => setFilter('past')}
        >
          <Text style={[styles.filterButtonText, filter === 'past' && styles.filterButtonTextActive]}>
            Histórico
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            Todas
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {Object.keys(patientGroups).length === 0 ? (
          <ModernCard variant="outlined" style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Nenhuma consulta encontrada</Text>
            <Text style={styles.emptySubtext}>As consultas agendadas aparecerão aqui</Text>
          </ModernCard>
        ) : (
          Object.entries(patientGroups).map(([patientName, appointments]) => (
            <ModernCard key={patientName} variant="elevated" style={styles.patientCard}>
              <View style={styles.patientHeader}>
                <View style={styles.patientInfo}>
                  <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
                  <View style={styles.patientDetails}>
                    <Text style={styles.patientName}>{patientName}</Text>
                    <Text style={styles.appointmentCount}>
                      {appointments.length} consulta{appointments.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </View>

              {appointments.map((apt) => {
                const { date, time } = formatDateTime(apt.data_hora);
                return (
                  <View key={apt.codigo} style={styles.appointmentItem}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.appointmentDate}>
                        <Ionicons name="calendar" size={18} color={colors.primary} />
                        <Text style={styles.dateText}>{date}</Text>
                        <Text style={styles.timeText}>{time}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(apt.status) + '20' }]}>
                        <Ionicons name={getStatusIcon(apt.status) as any} size={14} color={getStatusColor(apt.status)} />
                        <Text style={[styles.statusText, { color: getStatusColor(apt.status) }]}>
                          {apt.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.specializationText}>
                      {apt.especializacao_nome}
                    </Text>

                    {apt.paciente_email && (
                      <IconText icon="mail-outline" style={styles.contactText}>{apt.paciente_email}</IconText>
                    )}
                    {apt.observacoes && (
                      <IconText icon="chatbubble-outline" style={styles.observationsText}>{apt.observacoes}</IconText>
                    )}

                    {apt.status === 'agendada' && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.confirmButton]}
                          onPress={() => handleUpdateStatus(apt.codigo!, 'confirmada')}
                        >
                          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                          <Text style={[styles.actionButtonText, { color: colors.success }]}>Confirmar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cancelButton]}
                          onPress={() => handleUpdateStatus(apt.codigo!, 'cancelada')}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.error} />
                          <Text style={[styles.actionButtonText, { color: colors.error }]}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {apt.status === 'confirmada' && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.completeButton]}
                          onPress={() => handleUpdateStatus(apt.codigo!, 'concluida')}
                        >
                          <Ionicons name="checkmark-done" size={18} color={colors.primary} />
                          <Text style={[styles.actionButtonText, { color: colors.primary }]}>Concluir</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ModernCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    color: colors.text,
  },
  filterButtonTextActive: {
    color: colors.surface,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium as any,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  patientCard: {
    marginBottom: spacing.lg,
  },
  patientHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    color: colors.text,
  },
  appointmentCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  appointmentItem: {
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  appointmentDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    color: colors.text,
  },
  timeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium as any,
    textTransform: 'capitalize',
  },
  specializationText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  contactText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  observationsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  confirmButton: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  cancelButton: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  completeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
  },
});
