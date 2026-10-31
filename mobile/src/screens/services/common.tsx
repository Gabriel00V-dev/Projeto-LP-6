import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius } from "../../styles/theme";

// Mesma linguagem visual do protótipo de serviços (ServicesHome).

export function ServiceHeading({ icon, color, title, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; text: string }) {
  return (
    <View style={s.serviceHeading}>
      <View style={[s.serviceIcon, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.headingTitle}>{title}</Text>
        <Text style={s.headingText}>{text}</Text>
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function OptionRow({
  title,
  subtitle,
  selected,
  color,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  color: string;
  onPress: () => void;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[s.optionRow, selected && { borderColor: color, backgroundColor: `${color}08` }]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={s.radio}>
        <View style={[s.radioDot, selected && { backgroundColor: color }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        {subtitle ? <Text style={s.optionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export function Chip({
  label,
  selected,
  color,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, selected && { backgroundColor: color, borderColor: color }, disabled && { opacity: 0.45 }]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? "#fff" : "#475569"} /> : null}
      <Text style={[s.chipText, selected && s.selectedText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: `${color}18` }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  color,
  onPress,
  disabled,
  loading,
  style,
}: {
  title: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      style={[s.primaryButton, { backgroundColor: color }, (disabled || loading) && { opacity: 0.5 }, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={30} color="#94A3B8" />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.empty}>
      <ActivityIndicator color="#64748B" />
    </View>
  );
}

/** Agendar exige login de paciente; quem entrou como visitante vê este aviso. */
export function LoginRequired({ navigation, color }: { navigation: any; color: string }) {
  return (
    <View style={s.formCard}>
      <View style={s.helpRow}>
        <Ionicons name="lock-closed-outline" size={18} color={color} />
        <Text style={s.helpText}>Entre como paciente para agendar e acompanhar seus atendimentos.</Text>
      </View>
      <PrimaryButton title="Entrar" color={color} onPress={() => navigation.navigate("Login")} />
    </View>
  );
}

export const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F9FC" },
  content: { padding: spacing.lg, paddingBottom: 44, maxWidth: 760, width: "100%", alignSelf: "center" },
  serviceHeading: { backgroundColor: "#fff", borderRadius: borderRadius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5EAF0", marginBottom: spacing.md },
  serviceIcon: { width: 54, height: 54, borderRadius: 15, justifyContent: "center", alignItems: "center", marginRight: 14 },
  headingTitle: { color: "#12233F", fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 4 },
  headingText: { color: "#64748B", fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: "#12233F", fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: spacing.md, marginBottom: 10 },
  optionRow: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5EAF0", borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  radio: { width: 20, height: 20, borderWidth: 2, borderColor: "#CBD5E1", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionTitle: { color: "#334155", fontSize: 14, fontWeight: fontWeight.semibold },
  optionSubtitle: { color: "#94A3B8", fontSize: 11, marginTop: 3 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5EAF0", borderRadius: 9, paddingVertical: 10, paddingHorizontal: 13 },
  chipText: { color: "#475569", fontSize: 12, fontWeight: fontWeight.semibold },
  selectedText: { color: "#fff" },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: fontWeight.bold },
  primaryButton: { borderRadius: 10, paddingVertical: 15, alignItems: "center", marginTop: spacing.lg, minHeight: 50, justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  secondaryButton: { borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#DCE5F0", backgroundColor: "#fff", marginTop: spacing.sm },
  secondaryButtonText: { color: "#475569", fontSize: 14, fontWeight: fontWeight.semibold },
  formCard: { backgroundColor: "#fff", padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: "#E5EAF0", marginBottom: spacing.md },
  formHint: { color: "#64748B", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#DCE5F0", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 10, color: "#12233F", backgroundColor: "#fff", fontSize: 14 },
  helpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  helpText: { color: "#64748B", fontSize: 12, flex: 1, lineHeight: 18 },
  card: { backgroundColor: "#fff", borderRadius: borderRadius.md, borderWidth: 1, borderColor: "#E5EAF0", padding: spacing.md, marginBottom: 10 },
  cardTitle: { color: "#12233F", fontSize: 15, fontWeight: fontWeight.bold },
  cardText: { color: "#64748B", fontSize: 12, marginTop: 4, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  stat: { flex: 1, backgroundColor: "#F7F9FC", borderRadius: 9, padding: 10, alignItems: "center" },
  statValue: { color: "#12233F", fontSize: 18, fontWeight: fontWeight.bold },
  statLabel: { color: "#64748B", fontSize: 11, marginTop: 2, textAlign: "center" },
  tabRow: { flexDirection: "row", backgroundColor: "#E9EEF4", borderRadius: 10, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 8 },
  activeTab: { backgroundColor: "#fff" },
  tabText: { color: "#64748B", fontSize: 13, fontWeight: fontWeight.semibold },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 8 },
  emptyText: { color: "#94A3B8", fontSize: 13, textAlign: "center", maxWidth: 320 },
  linkText: { color: "#2563EB", fontSize: 13, fontWeight: fontWeight.semibold },
});
