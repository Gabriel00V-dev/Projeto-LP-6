import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";

export { default as UpaServiceScreen } from "./services/UpaServiceScreen";
export { default as PsychologyServiceScreen } from "./services/PsychologyServiceScreen";
export { default as VeterinaryServiceScreen } from "./services/VeterinaryServiceScreen";
export { default as TelemedicineServiceScreen } from "./services/TelemedicineServiceScreen";

type Props = { navigation: any; route?: any };

const serviceOptions = [
  { title: "UPA / SUS", subtitle: "Consultar lotação e entrar na fila", icon: "medkit-outline" as const, color: "#2563EB", screen: "UpaService" },
  { title: "Psicólogo", subtitle: "Escolher profissional e horário", icon: "heart-outline" as const, color: "#7C3AED", screen: "PsychologyService" },
  { title: "Clínica veterinária", subtitle: "Agendar consulta para seu animal", icon: "paw-outline" as const, color: "#D97706", screen: "VeterinaryService" },
  { title: "Telemedicina", subtitle: "Entrar ou marcar uma consulta online", icon: "videocam-outline" as const, color: "#0F9D78", screen: "TelemedicineService" },
];

export function ServicesHome({ navigation, route }: Props) {
  // Vindo do menu do paciente, o paciente logado segue para os serviços
  // (agendar exige login). Vindo do Login, é um visitante.
  const patient = route?.params?.patient;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace("Login"))}><Ionicons name="arrow-back" size={22} color="#64748B" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Serviços de atendimento</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.intro}><Text style={styles.introTitle}>Como podemos ajudar?</Text><Text style={styles.introText}>Escolha um serviço para consultar horários, agendar ou acompanhar seu atendimento.</Text></View>
      {serviceOptions.map((service) => <TouchableOpacity key={service.screen} style={styles.serviceCard} onPress={() => navigation.navigate(service.screen, { patient })}>
        <View style={[styles.serviceIcon, { backgroundColor: `${service.color}16` }]}><Ionicons name={service.icon} size={28} color={service.color} /></View>
        <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>{service.title}</Text><Text style={styles.serviceSubtitle}>{service.subtitle}</Text></View>
        <Ionicons name="chevron-forward" size={21} color="#94A3B8" />
      </TouchableOpacity>)}
      <Text style={styles.note}>
        {patient
          ? "Os horários e a disponibilidade podem mudar conforme a unidade e o profissional."
          : "Você está navegando como visitante. Entre como paciente para agendar."}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F9FC" },
  content: { padding: spacing.lg, paddingBottom: 44, maxWidth: 760, width: "100%", alignSelf: "center" },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: "#12233F" },
  intro: { backgroundColor: "#E8F0FF", borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  introTitle: { color: "#12233F", fontSize: 21, fontWeight: fontWeight.bold, marginBottom: 6 }, introText: { color: "#536985", fontSize: fontSize.md, lineHeight: 22 },
  serviceCard: { backgroundColor: "#fff", borderRadius: borderRadius.md, padding: spacing.md, marginBottom: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5EAF0" },
  serviceIcon: { width: 54, height: 54, borderRadius: 15, justifyContent: "center", alignItems: "center", marginRight: 14 }, serviceCopy: { flex: 1 }, serviceTitle: { color: "#12233F", fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: 4 }, serviceSubtitle: { color: "#64748B", fontSize: fontSize.sm }, note: { color: "#94A3B8", fontSize: 12, textAlign: "center", marginTop: 12 },
});
