import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModernButton from "../components/ModernButton";
import IconText from "../components/IconText";
import { authLogout, decideApproval, listApprovals } from "../api/client";
import { ApprovalItem, ApprovalStatus, ApprovalType, ProfessionalType } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar, confirmar } from "../utils/dialog";
import { mascaraCnpj, mascaraCpf, mascaraTelefone } from "../utils/documentos";
import { formatarDataUtc, ROTULO_PROFISSIONAL } from "../utils/serviceFormat";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";

type Props = { navigation: any; route: any };

const ABAS: { status: ApprovalStatus; label: string }[] = [
  { status: "pendente", label: "Pendentes" },
  { status: "aprovado", label: "Aprovados" },
  { status: "reprovado", label: "Reprovados" },
];

const TIPO_ESTABELECIMENTO: Record<string, string> = {
  clinica: "Clínica",
  veterinaria: "Clínica veterinária",
  psicologia: "Psicologia",
  upa: "UPA / SUS",
};

function descricaoTipo(item: ApprovalItem) {
  if (item.tipo_cadastro === "clinica") return TIPO_ESTABELECIMENTO[item.tipo ?? "clinica"] ?? "Clínica";
  const rotulo = ROTULO_PROFISSIONAL[item.tipo as ProfessionalType] ?? "Profissional";
  return item.clinica_nome ? `${rotulo} · equipe de ${item.clinica_nome}` : `${rotulo} · independente`;
}

function CadastroCard({ item, onDecidir }: { item: ApprovalItem; onDecidir: (decisao: "aprovado" | "reprovado", motivo?: string) => Promise<void> }) {
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const clinica = item.tipo_cadastro === "clinica";

  async function decidir(decisao: "aprovado" | "reprovado") {
    setEnviando(true);
    await onDecidir(decisao, motivo.trim() || undefined);
    setEnviando(false);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: (clinica ? colors.primary : "#7C3AED") + "18" }]}>
          <Ionicons name={clinica ? "business-outline" : "person-outline"} size={22} color={clinica ? colors.primary : "#7C3AED"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.nome}</Text>
          <Text style={styles.cardSubtitle}>{descricaoTipo(item)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <IconText icon="mail-outline" style={styles.info}>{item.email}</IconText>
        {item.fone ? <IconText icon="call-outline" style={styles.info}>{mascaraTelefone(item.fone)}</IconText> : null}
        {clinica ? (
          <>
            {item.cnpj ? <IconText icon="document-text-outline" style={styles.info}>CNPJ {mascaraCnpj(item.cnpj)}</IconText> : null}
            {item.endereco ? <IconText icon="location-outline" style={styles.info}>{item.endereco}</IconText> : null}
            {item.responsavel_tecnico ? (
              <IconText icon="person-circle-outline" style={styles.info}>
                Responsável técnico: {item.responsavel_tecnico}{item.registro_responsavel ? ` (${item.registro_responsavel})` : ""}
              </IconText>
            ) : null}
          </>
        ) : (
          <>
            {item.cpf ? <IconText icon="card-outline" style={styles.info}>CPF {mascaraCpf(item.cpf)}</IconText> : null}
            {item.registro_profissional ? <IconText icon="ribbon-outline" style={styles.info}>Registro {item.registro_profissional}</IconText> : null}
            {item.bio ? <IconText icon="chatbox-outline" style={styles.info}>{item.bio}</IconText> : null}
          </>
        )}
        {item.enviado_em ? <IconText icon="time-outline" style={styles.info}>Enviado em {formatarDataUtc(item.enviado_em)}</IconText> : null}
        {item.analisado_em && item.status_cadastro !== "pendente" ? (
          <IconText icon="checkmark-done-outline" style={styles.info}>Analisado em {formatarDataUtc(item.analisado_em)}</IconText>
        ) : null}
        {item.motivo_reprovacao ? (
          <IconText icon="alert-circle-outline" color={colors.error} style={[styles.info, { color: colors.error }]}>
            {item.motivo_reprovacao}
          </IconText>
        ) : null}
      </View>

      {reprovando ? (
        <View style={styles.reprovar}>
          <Text style={styles.label}>Motivo da reprovação (o prestador vai ler)</Text>
          <TextInput
            style={styles.input}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ex.: o registro informado não foi encontrado no conselho regional."
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <View style={styles.actions}>
            <ModernButton title="Voltar" variant="outline" size="small" onPress={() => setReprovando(false)} style={styles.actionButton} />
            <ModernButton
              title={enviando ? "Enviando..." : "Confirmar reprovação"}
              size="small"
              disabled={enviando || motivo.trim().length < 5}
              onPress={() => decidir("reprovado")}
              style={{ ...styles.actionButton, backgroundColor: colors.error }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {item.status_cadastro !== "aprovado" ? (
            <ModernButton
              title="Aprovar"
              size="small"
              disabled={enviando}
              onPress={() => decidir("aprovado")}
              style={{ ...styles.actionButton, backgroundColor: colors.success }}
            />
          ) : null}
          {item.status_cadastro !== "reprovado" ? (
            <ModernButton
              title={item.status_cadastro === "aprovado" ? "Suspender" : "Reprovar"}
              variant="outline"
              size="small"
              disabled={enviando}
              onPress={() => setReprovando(true)}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Painel da prefeitura: análise dos cadastros de clínicas e profissionais. */
export default function ApprovalsScreen({ navigation, route }: Props) {
  const admin = route.params?.admin;
  const [status, setStatus] = useState<ApprovalStatus>("pendente");
  const [tipo, setTipo] = useState<ApprovalType | undefined>(undefined);
  const [itens, setItens] = useState<ApprovalItem[]>([]);
  const [contagem, setContagem] = useState<Record<ApprovalStatus, number>>({ pendente: 0, aprovado: 0, reprovado: 0 });
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const dados = await listApprovals(status, tipo);
      setItens(dados.itens);
      setContagem(dados.contagem);
    } catch (err) {
      avisar("Cadastros", getErrorMessage(err, "Não foi possível carregar os cadastros."));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [status, tipo]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  async function decidir(item: ApprovalItem, decisao: "aprovado" | "reprovado", motivo?: string) {
    if (decisao === "aprovado" && !(await confirmar("Aprovar cadastro", `${item.nome} passará a aparecer para os pacientes.`, "Aprovar"))) {
      return;
    }
    try {
      await decideApproval(item.tipo_cadastro, item.codigo, decisao, motivo);
      await carregar();
    } catch (err) {
      avisar("Cadastros", getErrorMessage(err, "Não foi possível registrar a decisão."));
    }
  }

  async function sair() {
    await authLogout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} />}
    >
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={48} color={colors.onPrimary} />
        <Text style={styles.headerTitle}>Aprovação de cadastros</Text>
        <Text style={styles.headerSubtitle}>{admin?.nome ?? "Prefeitura"}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.tabs}>
          {ABAS.map((aba) => (
            <TouchableOpacity key={aba.status} onPress={() => setStatus(aba.status)} style={[styles.tab, status === aba.status && styles.tabActive]}>
              <Text style={[styles.tabText, status === aba.status && styles.tabTextActive]}>{aba.label}</Text>
              <View style={[styles.counter, status === aba.status && { backgroundColor: colors.primary }]}>
                <Text style={[styles.counterText, status === aba.status && { color: colors.onPrimary }]}>{contagem[aba.status]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filters}>
          {([undefined, "clinica", "profissional"] as (ApprovalType | undefined)[]).map((t) => (
            <TouchableOpacity key={t ?? "todos"} onPress={() => setTipo(t)} style={[styles.filter, tipo === t && styles.filterActive]}>
              <Ionicons
                name={t === "clinica" ? "business-outline" : t === "profissional" ? "person-outline" : "apps-outline"}
                size={14}
                color={tipo === t ? colors.onPrimary : colors.textSecondary}
              />
              <Text style={[styles.filterText, tipo === t && { color: colors.onPrimary }]}>
                {t === "clinica" ? "Estabelecimentos" : t === "profissional" ? "Profissionais" : "Todos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {carregando ? (
          <Text style={styles.empty}>Carregando...</Text>
        ) : itens.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.empty}>
              {status === "pendente" ? "Nenhum cadastro aguardando análise." : "Nenhum cadastro nesta lista."}
            </Text>
          </View>
        ) : itens.map((item) => (
          <CadastroCard key={`${item.tipo_cadastro}-${item.codigo}`} item={item} onDecidir={(d, m) => decidir(item, d, m)} />
        ))}

        <ModernButton title="Sair da conta" onPress={sair} variant="outline" fullWidth style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  header: {
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.onPrimary, marginTop: spacing.md, textAlign: "center" },
  headerSubtitle: { fontSize: fontSize.md, color: colors.onPrimary, opacity: 0.9, marginTop: spacing.xs },
  body: { padding: spacing.lg, marginTop: -spacing.xl, width: "100%", maxWidth: 820, alignSelf: "center" },
  tabs: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.xs, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  tabActive: { backgroundColor: colors.primary + "12" },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  counter: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: colors.surfaceVariant, alignItems: "center", justifyContent: "center" },
  counterText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textSecondary },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.round, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  typeIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  cardSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  details: { marginTop: spacing.md, gap: spacing.xs },
  info: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  reprovar: { marginTop: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginBottom: spacing.xs },
  input: { minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.sm, color: colors.text, textAlignVertical: "top", fontSize: fontSize.sm },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  actionButton: { minWidth: 110 },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  empty: { textAlign: "center", color: colors.textSecondary, fontSize: fontSize.md },
});
