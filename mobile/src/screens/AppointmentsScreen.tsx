import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";
import ModernCard from "../components/ModernCard";
import IconText from "../components/IconText";
import { changeAppointment, getAppointmentsByPatient } from "../api/client";
import { AppointmentWithDetails } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { entrarNaTeleconsulta } from "../utils/telemedicine";
import { parseDataHoraLocal, ROTULO_ATENDIMENTO, STATUS_CONSULTA } from "../utils/serviceFormat";

const ENCERRADAS = ["cancelada", "concluida", "faltou"];

type Props = {
  navigation: any;
  route: any;
};

export default function AppointmentsScreen({ route, navigation }: Props) {
  const patient = route.params?.patient;
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (patient?.codigo) {
      loadAppointments();
    }
  }, [patient?.codigo]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await getAppointmentsByPatient(patient.codigo);
      setAppointments(data);
    } catch (error: any) {
      console.error("Erro ao carregar consultas:", error);
      Alert.alert("Erro", "Não foi possível carregar as consultas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelAppointment = (codigo: number) => {
    Alert.alert(
      "Cancelar Consulta",
      "Tem certeza que deseja cancelar esta consulta?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim",
          style: "destructive",
          onPress: async () => {
            try {
              await changeAppointment(codigo, "cancel");
              Alert.alert("Sucesso", "Consulta cancelada com sucesso");
              loadAppointments();
            } catch (error) {
              Alert.alert("Erro", getErrorMessage(error, "Não foi possível cancelar a consulta"));
            }
          },
        },
      ]
    );
  };

  const getStatusDetails = (status: string) =>
    STATUS_CONSULTA[status as keyof typeof STATUS_CONSULTA] ?? { color: colors.textSecondary, icon: "help-outline", label: status };

  const formatDateTime = (dateTime: string) => {
    const date = parseDataHoraLocal(dateTime);
    return {
      date: date.toLocaleDateString("pt-BR"),
      time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  // Em atendimento continua em "Próximas" mesmo depois do horário de início:
  // é onde fica o botão de voltar para a teleconsulta.
  const isUpcoming = (apt: AppointmentWithDetails) =>
    apt.status === "em_atendimento" ||
    (!ENCERRADAS.includes(apt.status) && parseDataHoraLocal(apt.data_hora) >= new Date());

  const upcomingAppointments = appointments.filter(isUpcoming);

  const pastAppointments = appointments.filter((apt) => !isUpcoming(apt));

  const renderAppointment = ({ item }: { item: AppointmentWithDetails }) => {
    const { date, time } = formatDateTime(item.data_hora);
    const status = getStatusDetails(item.status);
    const online = item.modalidade === "telemedicina";
    const titulo = item.profissional_nome ?? item.clinica_nome;
    const detalhe = item.tipo_atendimento ? ROTULO_ATENDIMENTO[item.tipo_atendimento] : item.especializacao_nome;

    return (
      <ModernCard variant="elevated" style={styles.appointmentCard}>
        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentDate}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.dateText}>{date} às {time}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + "20" }]}>
            <Ionicons name={status.icon as any} size={16} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.appointmentBody}>
          <Text style={styles.clinicName}>{titulo}</Text>
          {detalhe ? <Text style={styles.specializationText}>{detalhe}</Text> : null}
          {item.profissional_nome && item.clinica_nome ? (
            <IconText icon="business-outline" style={styles.addressText}>{item.clinica_nome}</IconText>
          ) : null}
          {item.animal_nome ? (
            <IconText icon="paw-outline" style={styles.addressText}>{item.animal_nome}{item.animal_especie ? ` (${item.animal_especie})` : ""}</IconText>
          ) : null}
          {online ? (
            <IconText icon="videocam-outline" style={styles.addressText}>Teleconsulta — a sala abre alguns minutos antes do horário</IconText>
          ) : item.clinica_endereco ? (
            <IconText icon="location-outline" style={styles.addressText}>{item.clinica_endereco}</IconText>
          ) : null}
        </View>

        {(item.status === "agendada" || item.status === "confirmada" || (online && item.status === "em_atendimento")) && (
          <View style={styles.appointmentActions}>
            {online && (
              <TouchableOpacity style={styles.cancelButton} onPress={() => entrarNaTeleconsulta(item.codigo!)}>
                <Ionicons name="videocam-outline" size={20} color={colors.primary} />
                <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Entrar na sala</Text>
              </TouchableOpacity>
            )}
            {item.status !== "em_atendimento" && (
              <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelAppointment(item.codigo!)}>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <Text style={styles.cancelButtonText}>Cancelar Agendamento</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ModernCard>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
        <Text style={styles.headerTitle}>Minhas Consultas</Text>
        <Text style={styles.headerSubtitle}>Gerencie seus agendamentos</Text>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "upcoming" && styles.tabButtonActive]}
          onPress={() => setActiveTab("upcoming")}
        >
          <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>Próximas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "past" && styles.tabButtonActive]}
          onPress={() => setActiveTab("past")}
        >
          <Text style={[styles.tabText, activeTab === "past" && styles.tabTextActive]}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === "upcoming" ? upcomingAppointments : pastAppointments}
        renderItem={renderAppointment}
        keyExtractor={(item) => item.codigo!.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAppointments} tintColor={colors.primary} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {activeTab === "upcoming"
                ? "Nenhuma consulta agendada"
                : "Nenhuma consulta no histórico"}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === "upcoming"
                ? "Use o botão (+) para agendar uma nova consulta"
                : "Suas consultas passadas aparecerão aqui"}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate("ClinicList", { patient })}
      >
        <Ionicons name="add" size={32} color={colors.onPrimary} />
      </TouchableOpacity>
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
    paddingTop: spacing.xxl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: fontSize.md,
    color: colors.onPrimary,
    textAlign: "center",
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  listContainer: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: "80%",
  },
  appointmentCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  appointmentDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
  },
  appointmentBody: {
    paddingVertical: spacing.sm,
  },
  clinicName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  specializationText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  addressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  appointmentActions: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.error,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: colors.shadow,
    shadowRadius: 6,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
  },
});
