import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModernButton from "../components/ModernButton";
import { ColumnChart, HBarChart, HeroFigure, SegmentedBar, StatGrid, StatTile } from "../components/charts";
import { authLogout, getPrefeituraDashboard } from "../api/client";
import { DashboardServico, PrefeituraDashboard } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar } from "../utils/dialog";
import { dataIso, formatarEspera, RISCO } from "../utils/serviceFormat";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";

type Props = { navigation: any; route: any };

const PERIODOS = [
  { dias: 1, label: "Hoje" },
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

type Area = "geral" | "saude" | "psicologia" | "animal" | "telemedicina";

const AREAS: { key: Area; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "geral", label: "Visão geral", icon: "grid-outline" },
  { key: "saude", label: "Saúde pública", icon: "medkit-outline" },
  { key: "psicologia", label: "Psicologia", icon: "heart-outline" },
  { key: "animal", label: "Proteção animal", icon: "paw-outline" },
  { key: "telemedicina", label: "Telemedicina", icon: "videocam-outline" },
];

const NOME_SERVICO: Record<DashboardServico, string> = {
  upa: "UPA / SUS",
  clinica: "Clínicas",
  psicologia: "Psicologia",
  veterinaria: "Veterinária",
};

const numero = (v: number) => v.toLocaleString("pt-BR");
const percentual = (v: number | null) => (v === null ? "—" : `${v}%`);
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function periodo(dias: number) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1));
  return { de: dataIso(inicio), ate: dataIso(hoje) };
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

/** Painel da prefeitura (plano, seção 2): indicadores a partir dos dados reais. */
export default function PrefeituraDashboardScreen({ navigation, route }: Props) {
  const admin = route.params?.admin;
  const [dias, setDias] = useState(30);
  const [area, setArea] = useState<Area>("geral");
  const [dados, setDados] = useState<PrefeituraDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { de, ate } = periodo(dias);
      setDados(await getPrefeituraDashboard(de, ate));
    } catch (err) {
      avisar("Dashboard", getErrorMessage(err, "Não foi possível carregar os indicadores."));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [dias]);

  useEffect(() => {
    carregar();
    // Volta da tela de aprovação com a contagem de pendentes atualizada.
    return navigation.addListener("focus", carregar);
  }, [carregar, navigation]);

  async function sair() {
    await authLogout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  const g = dados?.visao_geral;
  const pendentes = g?.cadastros_pendentes ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} />}
    >
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
        <Ionicons name="stats-chart-outline" size={44} color={colors.onPrimary} />
        <Text style={styles.headerTitle}>Painel da prefeitura</Text>
        <Text style={styles.headerSubtitle}>{admin?.nome ?? "Gestão municipal"}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <TouchableOpacity style={styles.approvals} onPress={() => navigation.navigate("Approvals", { admin })}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.approvalsTitle}>Aprovação de cadastros</Text>
            <Text style={styles.approvalsText}>
              {pendentes > 0 ? `${numero(pendentes)} aguardando análise` : "Nenhum cadastro pendente"}
            </Text>
          </View>
          {pendentes > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{numero(pendentes)}</Text></View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Filtros: uma linha acima de tudo que eles afetam */}
        <View style={styles.filters}>
          {PERIODOS.map((p) => (
            <TouchableOpacity key={p.dias} onPress={() => setDias(p.dias)} style={[styles.chip, dias === p.dias && styles.chipActive]}>
              {dias === p.dias ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
              <Text style={[styles.chipText, dias === p.dias && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {AREAS.map((a) => (
            <TouchableOpacity key={a.key} onPress={() => setArea(a.key)} style={[styles.tab, area === a.key && styles.tabActive]}>
              <Ionicons name={a.icon} size={16} color={area === a.key ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, area === a.key && styles.tabTextActive]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!dados ? (
          <Text style={styles.empty}>{carregando ? "Carregando indicadores..." : "Sem dados."}</Text>
        ) : (
          // Ao trocar o filtro, mantém o último resultado esmaecido em vez de piscar a tela.
          <View style={{ opacity: carregando ? 0.5 : 1 }}>
            {area === "geral" && g ? (
              <>
                <Card title="Visão geral" subtitle={`${diaCurto(dados.periodo.de)} a ${diaCurto(dados.periodo.ate)}`}>
                  <HeroFigure
                    label="Atendimentos realizados"
                    value={numero(g.atendimentos_realizados)}
                    hint="Consultas concluídas e pacientes atendidos na UPA"
                  />
                  <StatGrid>
                    <StatTile label="Consultas marcadas" value={numero(g.consultas_marcadas)} />
                    <StatTile label="Taxa de presença" value={percentual(g.taxa_presenca)} hint="Compareceram / (compareceram + faltaram)" />
                    <StatTile label="Espera média na UPA" value={formatarEspera(g.espera_media_upa_minutos)} hint="Da chegada até ser chamado" />
                    <StatTile label="Atendimentos online" value={numero(g.atendimentos_online)} />
                    <StatTile label="Cancelamentos" value={numero(g.cancelamentos)} />
                    <StatTile label="Rede credenciada" value={numero(g.rede.estabelecimentos)} hint={`estabelecimentos · ${numero(g.rede.profissionais)} profissionais`} />
                  </StatGrid>
                </Card>

                <Card title="Atendimentos por serviço" subtitle="Realizados no período">
                  <HBarChart items={g.por_servico.map((s) => ({ label: NOME_SERVICO[s.servico], value: s.total }))} />
                </Card>

                {g.serie_diaria.length > 1 ? (
                  <Card title="Demanda por dia" subtitle="Consultas marcadas e entradas na fila da UPA">
                    <ColumnChart points={g.serie_diaria.map((d) => ({ key: d.dia, value: d.total }))} formatLabel={diaCurto} />
                  </Card>
                ) : null}
              </>
            ) : null}

            {area === "saude" ? (
              <>
                <Card title="Saúde pública" subtitle="UPA / SUS">
                  <StatGrid>
                    <StatTile label="Aguardando agora" value={numero(dados.saude_publica.aguardando_agora)} />
                    <StatTile label="Em atendimento agora" value={numero(dados.saude_publica.em_atendimento_agora)} />
                    <StatTile label="Tempo porta-médico" value={formatarEspera(dados.saude_publica.espera_media_minutos)} hint="Média no período" />
                    <StatTile label="Entradas na fila" value={numero(dados.saude_publica.entradas)} />
                    <StatTile label="Atendidos" value={numero(dados.saude_publica.atendidos)} />
                    <StatTile label="Desistências" value={numero(dados.saude_publica.desistencias)} />
                  </StatGrid>
                </Card>

                <Card title="Classificação de risco" subtitle="Entradas no período">
                  <SegmentedBar
                    parts={[
                      ...(["vermelho", "amarelo", "verde", "azul"] as const).map((r) => ({
                        key: r,
                        label: RISCO[r].label,
                        value: dados.saude_publica.risco[r],
                        color: RISCO[r].color,
                        textoClaro: r === "amarelo",
                      })),
                      { key: "sem", label: "Sem classificação", value: dados.saude_publica.risco.sem_classificacao, color: "#B4B2A9" },
                    ]}
                  />
                </Card>

                <Card title="Status das unidades">
                  {dados.saude_publica.unidades.length === 0 ? (
                    <Text style={styles.empty}>Nenhuma UPA aprovada.</Text>
                  ) : dados.saude_publica.unidades.map((u) => (
                    <View key={u.codigo} style={styles.unitRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.unitName}>{u.nome}</Text>
                        <Text style={styles.unitMeta}>
                          {numero(u.entradas_periodo)} entradas no período · espera média {formatarEspera(u.espera_media_minutos)}
                          {u.aceita_fila_online ? " · fila pelo app" : ""}
                        </Text>
                      </View>
                      <View style={styles.unitNumbers}>
                        <Text style={styles.unitValue}>{numero(u.aguardando)}</Text>
                        <Text style={styles.unitMeta}>aguardando</Text>
                      </View>
                      <View style={styles.unitNumbers}>
                        <Text style={styles.unitValue}>{numero(u.em_atendimento)}</Text>
                        <Text style={styles.unitMeta}>em atend.</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {area === "psicologia" ? (
              <Card title="Psicologia e bem-estar">
                <StatGrid>
                  <StatTile label="Sessões realizadas" value={numero(dados.psicologia.sessoes_realizadas)} hint={`${numero(dados.psicologia.sessoes_online)} online`} />
                  <StatTile label="Taxa de presença" value={percentual(dados.psicologia.taxa_presenca)} />
                  <StatTile label="Faltas" value={numero(dados.psicologia.faltas)} />
                  <StatTile label="Cancelamentos" value={numero(dados.psicologia.cancelamentos)} />
                  <StatTile label="Sessões agendadas" value={numero(dados.psicologia.agendadas_futuras)} hint="A partir de hoje" />
                  <StatTile label="Psicólogos disponíveis" value={numero(dados.psicologia.profissionais)} />
                </StatGrid>
              </Card>
            ) : null}

            {area === "animal" ? (
              <Card title="Proteção animal">
                <StatGrid>
                  <StatTile label="Consultas veterinárias" value={numero(dados.protecao_animal.consultas_realizadas)} />
                  <StatTile label="Castrações realizadas" value={numero(dados.protecao_animal.castracoes)} />
                  <StatTile label="Vacinações" value={numero(dados.protecao_animal.vacinacoes)} />
                  <StatTile label="Aguardando atendimento" value={numero(dados.protecao_animal.aguardando_atendimento)} hint="Consultas agendadas a partir de hoje" />
                  <StatTile label="Animais cadastrados" value={numero(dados.protecao_animal.animais_cadastrados)} />
                  <StatTile label="Clínicas credenciadas" value={numero(dados.protecao_animal.clinicas_credenciadas)} hint={`${numero(dados.protecao_animal.veterinarios)} veterinários`} />
                </StatGrid>
              </Card>
            ) : null}

            {area === "telemedicina" ? (
              <Card title="Telemedicina">
                <StatGrid>
                  <StatTile label="Consultas online marcadas" value={numero(dados.telemedicina.consultas_marcadas)} />
                  <StatTile label="Consultas finalizadas" value={numero(dados.telemedicina.consultas_realizadas)} />
                  <StatTile label="Salas em atendimento" value={numero(dados.telemedicina.em_atendimento_agora)} hint="Agora" />
                  <StatTile label="Taxa de presença" value={percentual(dados.telemedicina.taxa_presenca)} />
                  <StatTile label="Faltas" value={numero(dados.telemedicina.faltas)} />
                  <StatTile label="Prestadores com telemedicina" value={numero(dados.telemedicina.prestadores_com_addon)} />
                </StatGrid>
              </Card>
            ) : null}

            <Text style={styles.footnote}>
              Ocupação de leitos, adoções, chamados de abandono, encaminhamentos e satisfação do cidadão ainda não são registrados
              no sistema e por isso não aparecem aqui.
            </Text>
          </View>
        )}

        <ModernButton title="Sair da conta" onPress={sair} variant="outline" fullWidth style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  header: {
    paddingTop: 56,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.onPrimary, marginTop: spacing.sm },
  headerSubtitle: { fontSize: fontSize.md, color: colors.onPrimary, opacity: 0.9, marginTop: spacing.xs },
  body: { padding: spacing.lg, marginTop: -spacing.xl, width: "100%", maxWidth: 1600, alignSelf: "center" },

  approvals: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  approvalsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  approvalsText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.round, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  chipTextActive: { color: colors.onPrimary },
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  cardSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  unitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: "#e1e0d9" },
  unitName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  unitMeta: { fontSize: fontSize.xs, color: colors.textSecondary },
  unitNumbers: { alignItems: "center", minWidth: 64 },
  unitValue: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.text },

  empty: { textAlign: "center", color: colors.textSecondary, fontSize: fontSize.md, paddingVertical: spacing.lg },
  footnote: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.sm },
});
