import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";
import ModernCard from "../components/ModernCard";
import { getAppointmentsByPatient } from "../api/client";
import { AppointmentWithDetails } from "../types";

type Props = {
  navigation: any;
  route: any;
};

type Notification = {
  id: string;
  type: "reminder" | "confirmation" | "update";
  title: string;
  message: string;
  date: Date;
  appointment?: AppointmentWithDetails;
  read: boolean;
};

export default function NotificationsScreen({ route, navigation }: Props) {
  const patient = route.params?.patient;
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (patient?.codigo) {
      loadAppointments();
    }
  }, [patient?.codigo]);

  useEffect(() => {
    if (appointments.length > 0) {
      generateNotifications();
    }
  }, [appointments]);

  const loadAppointments = async () => {
    setRefreshing(true);
    try {
      const data = await getAppointmentsByPatient(patient.codigo);
      setAppointments(data);
    } catch (error: any) {
      console.error("Erro ao carregar consultas:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const generateNotifications = () => {
    const now = new Date();
    const generatedNotifications: Notification[] = [];

    appointments.forEach((apt) => {
      const aptDate = new Date(apt.data_hora);
      const timeDiff = aptDate.getTime() - now.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

      if (timeDiff > 0 && apt.status !== "cancelada" && apt.status !== "concluida") {
        if (daysDiff <= 1) {
          generatedNotifications.push({
            id: `reminder-1d-${apt.codigo}`,
            type: "reminder",
            title: "Consulta Amanhã!",
            message: `Sua consulta em ${apt.clinicas?.nome || apt.clinica_nome} está marcada para amanhã às ${formatTime(apt.data_hora)}. `,
            date: new Date(aptDate.getTime() - 24 * 60 * 60 * 1000),
            appointment: apt,
            read: false,
          });
        }
        if (apt.status === "confirmada" && daysDiff <= 7) {
          generatedNotifications.push({
            id: `confirmation-${apt.codigo}`,
            type: "confirmation",
            title: "Consulta Confirmada",
            message: `Sua consulta foi confirmada para ${formatDate(apt.data_hora)} em ${apt.clinicas?.nome || apt.clinica_nome}.`,
            date: new Date(),
            appointment: apt,
            read: false,
          });
        }
      }
    });

    generatedNotifications.sort((a, b) => b.date.getTime() - a.date.getTime());
    setNotifications(generatedNotifications);
  };

  const formatDate = (dateTime: string) => new Date(dateTime).toLocaleDateString("pt-BR");
  const formatTime = (dateTime: string) => new Date(dateTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  const getNotificationDetails = (type: string) => {
    switch (type) {
      case "reminder": return { icon: "notifications-outline", color: colors.warning };
      case "confirmation": return { icon: "checkmark-circle-outline", color: colors.success };
      case "update": return { icon: "information-circle-outline", color: colors.primary };
      default: return { icon: "alert-circle-outline", color: colors.textSecondary };
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (notification.appointment) {
      navigation.navigate("Appointments", { patient });
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const details = getNotificationDetails(item.type);
    return (
      <TouchableOpacity onPress={() => handleNotificationPress(item)} activeOpacity={0.7}>
        <ModernCard variant="elevated" style={[styles.notificationCard, !item.read && styles.unreadCard]}>
          <View style={styles.notificationHeader}>
            <View style={[styles.notificationIconContainer, { backgroundColor: details.color + "20" }]}>
              <Ionicons name={details.icon as any} size={24} color={details.color} />
            </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
            </View>
            <Text style={styles.notificationTime}>{getRelativeTime(item.date)}</Text>
          </View>
        </ModernCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
        <Text style={styles.headerTitle}>Notificações</Text>
        <Text style={styles.headerSubtitle}>Lembretes e atualizações importantes</Text>
      </LinearGradient>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAppointments} tintColor={colors.primary} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nenhuma Notificação</Text>
            <Text style={styles.emptySubtext}>Lembretes sobre suas consultas aparecerão aqui.</Text>
          </View>
        )}
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
  listContainer: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl * 2,
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
  notificationCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderColor: "transparent",
  },
  unreadCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surface, 
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.round,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});