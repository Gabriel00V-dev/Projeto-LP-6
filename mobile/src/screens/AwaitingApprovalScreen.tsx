import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModernButton from "../components/ModernButton";
import ModernInput from "../components/ModernInput";
import IconText from "../components/IconText";
import { authLogout, getMyApproval, resubmitApproval, restoreSession } from "../api/client";
import { useClinic } from "../contexts/ClinicContexts";
import { entrarNaSessao } from "../navigation/session";
import { ApprovalStatus, MyApproval } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar } from "../utils/dialog";
import { cnpjValido, cpfValido, mascaraCnpj, mascaraCpf, mascaraTelefone } from "../utils/documentos";
import { formatarDataUtc } from "../utils/serviceFormat";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";

type Props = { navigation: any; route: any };

const ATUALIZAR_A_CADA_MS = 30_000;

const VISUAL: Record<ApprovalStatus, { icon: keyof typeof Ionicons.glyphMap; titulo: string; texto: string; cor: string }> = {
  pendente: {
    icon: "hourglass-outline",
    titulo: "Cadastro em análise",
    texto: "A prefeitura está conferindo seus dados. Esta tela se atualiza sozinha quando houver uma resposta.",
    cor: colors.warning,
  },
  aprovado: {
    icon: "checkmark-circle-outline",
    titulo: "Cadastro aprovado!",
    texto: "Seu cadastro foi liberado. A partir de agora você aparece para os pacientes.",
    cor: colors.success,
  },
  reprovado: {
    icon: "close-circle-outline",
    titulo: "Cadastro não aprovado",
    texto: "Veja o que a prefeitura pediu, corrija os dados e reenvie para uma nova análise.",
    cor: colors.error,
  },
};

type Campo = { chave: string; label: string; icon: keyof typeof Ionicons.glyphMap; mascara?: (v: string) => string; teclado?: "phone-pad" | "numeric" };

const CAMPOS: Record<"clinica" | "profissional", Campo[]> = {
  clinica: [
    { chave: "nome", label: "Nome do estabelecimento", icon: "business-outline" },
    { chave: "cnpj", label: "CNPJ", icon: "document-text-outline", mascara: mascaraCnpj, teclado: "numeric" },
    { chave: "endereco", label: "Endereço", icon: "location-outline" },
    { chave: "fone", label: "Telefone", icon: "call-outline", mascara: mascaraTelefone, teclado: "phone-pad" },
    { chave: "responsavel_tecnico", label: "Responsável técnico", icon: "person-outline" },
    { chave: "registro_responsavel", label: "Registro do responsável", icon: "ribbon-outline" },
  ],
  profissional: [
    { chave: "nome", label: "Nome completo", icon: "person-outline" },
    { chave: "cpf", label: "CPF", icon: "card-outline", mascara: mascaraCpf, teclado: "numeric" },
    { chave: "fone", label: "Telefone", icon: "call-outline", mascara: mascaraTelefone, teclado: "phone-pad" },
    { chave: "registro_profissional", label: "Registro profissional", icon: "ribbon-outline" },
  ],
};

/** Clínica ou profissional aguardando a análise da prefeitura. */
export default function AwaitingApprovalScreen({ navigation, route }: Props) {
  const role: "clinica" | "profissional" = route.params?.role ?? "clinica";
  const { loadClinicSession } = useClinic();
  const [cadastro, setCadastro] = useState<MyApproval | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [atualizando, setAtualizando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const campos = CAMPOS[role];

  const carregar = useCallback(async () => {
    try {
      const dados = await getMyApproval();
      setCadastro(dados);
      setForm((atual) => Object.keys(atual).length ? atual : Object.fromEntries(
        campos.map((c) => [c.chave, c.mascara ? c.mascara(String((dados as any)[c.chave] ?? "")) : String((dados as any)[c.chave] ?? "")])
      ));
    } catch (err) {
      console.warn("Não foi possível consultar o cadastro.", err);
    } finally {
      setAtualizando(false);
    }
  }, [campos]);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [carregar]);

  async function acessarPainel() {
    // /auth/me devolve o cadastro completo, já com o status aprovado.
    const sessao = await restoreSession();
    if (!sessao) {
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      return;
    }
    await entrarNaSessao(navigation, sessao.role, sessao.user, loadClinicSession);
  }

  async function reenviar() {
    if (role === "clinica" && !cnpjValido(form.cnpj)) {
      avisar("CNPJ inválido", "Confira os números do CNPJ.");
      return;
    }
    if (role === "profissional" && !cpfValido(form.cpf)) {
      avisar("CPF inválido", "Confira os números do CPF.");
      return;
    }
    if (campos.some((c) => !form[c.chave]?.trim())) {
      avisar("Campos obrigatórios", "Preencha todos os campos antes de reenviar.");
      return;
    }

    setEnviando(true);
    try {
      setCadastro(await resubmitApproval(form));
      avisar("Cadastro reenviado", "A prefeitura vai analisar seus dados novamente.");
    } catch (err) {
      avisar("Não foi possível reenviar", getErrorMessage(err, "Tente novamente."));
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await authLogout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  const status: ApprovalStatus = cadastro?.status_cadastro ?? route.params?.user?.status_cadastro ?? "pendente";
  const visual = VISUAL[status];
  const etapas = [
    { label: "Enviado", feito: true },
    { label: "Em análise", feito: status !== "pendente", atual: status === "pendente" },
    { label: status === "reprovado" ? "Correção" : "Liberado", feito: status === "aprovado", atual: status === "reprovado" },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} />}
    >
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
        <View style={[styles.statusIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name={visual.icon} size={40} color={visual.cor} />
        </View>
        <Text style={styles.headerTitle}>{visual.titulo}</Text>
        <Text style={styles.headerSubtitle}>{cadastro?.nome ?? route.params?.user?.nome}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.steps}>
            {etapas.map((etapa, i) => (
              <React.Fragment key={etapa.label}>
                {i > 0 ? <View style={[styles.stepLine, etapa.feito && { backgroundColor: colors.success }]} /> : null}
                <View style={styles.step}>
                  <Ionicons
                    name={etapa.feito ? "checkmark-circle" : etapa.atual ? "ellipse" : "ellipse-outline"}
                    size={22}
                    color={etapa.feito ? colors.success : etapa.atual ? visual.cor : colors.textMuted}
                  />
                  <Text style={styles.stepLabel}>{etapa.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.text}>{visual.texto}</Text>
          {cadastro?.enviado_em ? (
            <IconText icon="time-outline" style={styles.meta}>Enviado em {formatarDataUtc(cadastro.enviado_em)}</IconText>
          ) : null}
        </View>

        {status === "aprovado" ? (
          <ModernButton title="Acessar meu painel" onPress={acessarPainel} size="large" fullWidth />
        ) : null}

        {status === "reprovado" ? (
          <>
            <View style={[styles.card, styles.motivoCard]}>
              <IconText icon="alert-circle-outline" color={colors.error} style={styles.cardTitle}>O que precisa ser corrigido</IconText>
              <Text style={styles.text}>{cadastro?.motivo_reprovacao ?? "A prefeitura não informou o motivo."}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Corrigir dados</Text>
              {campos.map((c) => (
                <ModernInput
                  key={c.chave}
                  label={c.label}
                  icon={c.icon}
                  value={form[c.chave] ?? ""}
                  keyboardType={c.teclado}
                  onChangeText={(v) => setForm((f) => ({ ...f, [c.chave]: c.mascara ? c.mascara(v) : v }))}
                />
              ))}
              <ModernButton title={enviando ? "Reenviando..." : "Corrigir e reenviar"} onPress={reenviar} disabled={enviando} fullWidth />
            </View>
          </>
        ) : null}

        {status === "pendente" && cadastro ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dados enviados</Text>
            {campos.map((c) => (
              <IconText key={c.chave} icon={c.icon} style={styles.info}>
                {c.label}: {form[c.chave] || "—"}
              </IconText>
            ))}
          </View>
        ) : null}

        {cadastro?.historico?.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Histórico</Text>
            {cadastro.historico.map((h, i) => (
              <IconText
                key={i}
                icon={h.decisao === "aprovado" ? "checkmark-circle-outline" : h.decisao === "reprovado" ? "close-circle-outline" : "refresh-outline"}
                color={h.decisao === "aprovado" ? colors.success : h.decisao === "reprovado" ? colors.error : colors.primary}
                style={styles.info}
              >
                {formatarDataUtc(h.criado_em)} — {h.decisao === "reenviado" ? "reenviado para análise" : h.decisao}
                {h.motivo ? `: ${h.motivo}` : ""}
              </IconText>
            ))}
          </View>
        ) : null}

        <ModernButton title="Sair da conta" onPress={sair} variant="outline" fullWidth style={{ marginTop: spacing.md }} />
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
  statusIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.onPrimary, marginTop: spacing.md, textAlign: "center" },
  headerSubtitle: { fontSize: fontSize.md, color: colors.onPrimary, opacity: 0.9, marginTop: spacing.xs, textAlign: "center" },
  body: { padding: spacing.lg, marginTop: -spacing.xl, width: "100%", maxWidth: 640, alignSelf: "center" },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  motivoCard: { borderColor: colors.error + "55", backgroundColor: colors.error + "0D" },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  text: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm },
  info: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  steps: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  step: { alignItems: "center", width: 80 },
  stepLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginBottom: 18 },
});
