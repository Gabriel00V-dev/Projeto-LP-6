import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  callNextUpa, getUpaQueue, updateClinic, updateUpaQueueStatus, updateUpaRisk,
} from "../api/client";
import { RiskLevel, UpaQueue, UpaQueueEntry, UpaQueueStatus } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar, confirmar } from "../utils/dialog";
import { formatarEspera, formatarHoraUtc, minutosDesde, RISCO, STATUS_FILA } from "../utils/serviceFormat";
import { Badge, EmptyState, Loading, PrimaryButton, s, SectionTitle, ServiceHeading } from "./services/common";

const COR = "#2563EB";
const ATUALIZAR_A_CADA_MS = 20_000;
const RISCOS: RiskLevel[] = ["vermelho", "amarelo", "verde", "azul"];

type Props = { navigation: any; route: any };

function Botao({ label, color = COR, onPress }: { label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, { borderColor: `${color}55` }]}>
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EntradaCard({
  entrada,
  podeClassificar,
  onStatus,
  onRisco,
  onSetor,
}: {
  entrada: UpaQueueEntry;
  podeClassificar: boolean;
  onStatus: (status: UpaQueueStatus) => void;
  onRisco: (risco: RiskLevel) => void;
  onSetor: (setor: string) => void;
}) {
  const [setor, setSetor] = useState("");
  const risco = entrada.classificacao_risco ? RISCO[entrada.classificacao_risco] : null;

  return (
    <View style={[s.card, { borderLeftWidth: 5, borderLeftColor: risco?.color ?? "#CBD5E1" }]}>
      <View style={s.row}>
        <Text style={[s.cardTitle, { flex: 1 }]}>
          {entrada.posicao ? `${entrada.posicao}º · ` : ""}{entrada.paciente_nome ?? "Paciente"}
        </Text>
        <Badge label={STATUS_FILA[entrada.status]} color={entrada.status === "em_atendimento" ? COR : "#64748B"} />
      </View>
      <Text style={s.cardText}>
        {entrada.protocolo} · chegou {formatarHoraUtc(entrada.entrada_em)} (há {formatarEspera(minutosDesde(entrada.entrada_em))})
        {entrada.setor ? ` · ${entrada.setor}` : ""}
        {entrada.profissional_nome ? ` · ${entrada.profissional_nome}` : ""}
      </Text>
      {entrada.sintomas ? <Text style={[s.cardText, { fontStyle: "italic" }]}>"{entrada.sintomas}"</Text> : null}
      <View style={[s.helpRow, { marginTop: 4 }]}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: risco?.color ?? "#CBD5E1" }} />
        <Text style={[s.cardText, { fontWeight: "600", marginTop: 0 }]}>
          {risco ? `Risco: ${risco.label}` : "Sem classificação de risco"}
        </Text>
      </View>

      {podeClassificar && ["em_triagem", "aguardando_atendimento", "em_atendimento"].includes(entrada.status) ? (
        <View style={[s.chipRow, { marginTop: 8 }]}>
          {RISCOS.map((r) => {
            const ativo = entrada.classificacao_risco === r;
            // Texto dentro do preenchimento: branco, exceto no amarelo (claro demais).
            const corTextoAtivo = r === "amarelo" ? "#1C1C1E" : "#fff";
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onRisco(r)}
                style={[s.chip, { borderColor: RISCO[r].color }, ativo && { backgroundColor: RISCO[r].color }]}
              >
                {!ativo ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: RISCO[r].color }} /> : null}
                <Text style={[s.chipText, ativo && { color: corTextoAtivo }]}>{RISCO[r].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={[s.chipRow, { marginTop: 10 }]}>
        {entrada.status === "aguardando_triagem" ? <Botao label="Iniciar triagem" onPress={() => onStatus("em_triagem")} /> : null}
        {entrada.status === "em_triagem" ? <Botao label="Encaminhar p/ atendimento" onPress={() => onStatus("aguardando_atendimento")} /> : null}
        {entrada.status === "aguardando_atendimento" ? <Botao label="Chamar" onPress={() => onStatus("em_atendimento")} /> : null}
        {entrada.status === "em_atendimento" ? <Botao label="Finalizar" color="#16A34A" onPress={() => onStatus("finalizado")} /> : null}
        {entrada.status === "em_atendimento" ? <Botao label="Devolver à espera" color="#64748B" onPress={() => onStatus("aguardando_atendimento")} /> : null}
        {entrada.status !== "em_atendimento" ? <Botao label="Cancelar" color="#DC2626" onPress={() => onStatus("cancelado")} /> : null}
      </View>

      <View style={[s.row, { marginTop: 8 }]}>
        <TextInput
          style={[s.input, { flex: 1, minHeight: 40, paddingVertical: 6 }]}
          value={setor}
          onChangeText={setSetor}
          placeholder="Transferir para setor (ex.: Pediatria)"
          placeholderTextColor="#94A3B8"
        />
        <Botao label="Transferir" onPress={() => { if (setor.trim()) { onSetor(setor.trim()); setSetor(""); } }} />
      </View>
    </View>
  );
}

export default function UpaStaffScreen({ route }: Props) {
  const unitId: number = route.params?.unitId;
  const clinic = route.params?.clinic; // presente quando quem abre é a conta da própria UPA
  const [fila, setFila] = useState<UpaQueue | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [aceitaFila, setAceitaFila] = useState<boolean>(Boolean(clinic?.aceita_fila_online));

  const carregar = useCallback(async () => {
    try {
      const dados = await getUpaQueue(unitId);
      setFila(dados);
      setAceitaFila(dados.unidade.aceita_fila_online);
    } catch (err) {
      avisar("Fila", getErrorMessage(err, "Não foi possível carregar a fila."));
    } finally {
      setAtualizando(false);
    }
  }, [unitId]);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [carregar]);

  async function rodar(acao: () => Promise<unknown>) {
    try {
      await acao();
      await carregar();
    } catch (err) {
      avisar("Fila", getErrorMessage(err, "Não foi possível atualizar."));
    }
  }

  async function mudarStatus(entrada: UpaQueueEntry, status: UpaQueueStatus) {
    if (status === "cancelado" && !(await confirmar("Cancelar", `Retirar ${entrada.paciente_nome} da fila?`, "Retirar"))) return;
    rodar(() => updateUpaQueueStatus(entrada.codigo, { status }));
  }

  async function chamar(etapa: "triagem" | "atendimento") {
    try {
      const chamado = await callNextUpa(unitId, etapa);
      avisar("Paciente chamado", `${chamado.protocolo} — ${etapa === "triagem" ? "triagem" : "atendimento"}.`);
      await carregar();
    } catch (err) {
      avisar("Fila", getErrorMessage(err, "Ninguém aguardando."));
    }
  }

  async function alternarFilaOnline(valor: boolean) {
    setAceitaFila(valor);
    try {
      await updateClinic(unitId, { aceita_fila_online: valor });
    } catch (err) {
      setAceitaFila(!valor);
      avisar("Fila pelo app", getErrorMessage(err, "Não foi possível alterar."));
    }
  }

  const producao = fila?.producao_plantao;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} />}
    >
      <ServiceHeading
        icon="medkit-outline"
        color={COR}
        title={fila?.unidade.nome ?? route.params?.unitName ?? "UPA"}
        text="Fila ordenada por classificação de risco e ordem de chegada. Atualiza sozinha a cada 20 segundos."
      />

      {!fila ? <Loading /> : (
        <>
          <View style={s.formCard}>
            <View style={s.statRow}>
              <View style={s.stat}><Text style={s.statValue}>{fila.aguardando}</Text><Text style={s.statLabel}>aguardando</Text></View>
              <View style={s.stat}><Text style={s.statValue}>{fila.em_atendimento}</Text><Text style={s.statLabel}>em atendimento</Text></View>
              <View style={s.stat}><Text style={s.statValue}>{formatarEspera(fila.tempo_estimado_minutos)}</Text><Text style={s.statLabel}>espera estimada</Text></View>
            </View>
            <View style={s.statRow}>
              {RISCOS.map((r) => (
                <View key={r} style={[s.stat, { borderTopWidth: 3, borderTopColor: RISCO[r].color }]}>
                  <Text style={s.statValue}>{fila.por_classificacao[r]}</Text>
                  <Text style={s.statLabel}>{RISCO[r].label}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <PrimaryButton title="Chamar p/ triagem" color="#64748B" onPress={() => chamar("triagem")} style={{ flex: 1 }} />
              <PrimaryButton title="Chamar p/ atendimento" color={COR} onPress={() => chamar("atendimento")} style={{ flex: 1 }} />
            </View>

            {clinic ? (
              <View style={[s.row, { marginTop: 14 }]}>
                <Text style={[s.helpText, { flex: 1 }]}>Aceitar entrada na fila pelo aplicativo</Text>
                <Switch value={aceitaFila} onValueChange={alternarFilaOnline} />
              </View>
            ) : null}
            {!fila.pode_classificar ? (
              <View style={[s.helpRow, { marginTop: 10 }]}>
                <Ionicons name="information-circle-outline" size={16} color="#64748B" />
                <Text style={s.helpText}>A classificação de risco é feita por médicos, enfermeiros e profissionais do SUS da unidade.</Text>
              </View>
            ) : null}
          </View>

          {producao ? (
            <>
              <SectionTitle>Produção do plantão (últimas {producao.horas}h)</SectionTitle>
              <View style={s.statRow}>
                <View style={s.stat}><Text style={s.statValue}>{producao.entradas}</Text><Text style={s.statLabel}>entradas</Text></View>
                <View style={s.stat}><Text style={s.statValue}>{producao.atendidos}</Text><Text style={s.statLabel}>atendidos</Text></View>
                <View style={s.stat}><Text style={s.statValue}>{producao.finalizados}</Text><Text style={s.statLabel}>finalizados</Text></View>
                <View style={s.stat}><Text style={s.statValue}>{formatarEspera(producao.tempo_medio_porta_medico_minutos)}</Text><Text style={s.statLabel}>porta-médico</Text></View>
              </View>
            </>
          ) : null}

          <SectionTitle>Fila</SectionTitle>
          {(fila.fila ?? []).length === 0 ? (
            <EmptyState icon="happy-outline" text="Ninguém na fila agora." />
          ) : (fila.fila ?? []).map((entrada) => (
            <EntradaCard
              key={entrada.codigo}
              entrada={entrada}
              podeClassificar={Boolean(fila.pode_classificar)}
              onStatus={(status) => mudarStatus(entrada, status)}
              onRisco={(risco) => rodar(() => updateUpaRisk(entrada.codigo, risco))}
              onSetor={(setor) => rodar(() => updateUpaQueueStatus(entrada.codigo, { setor }))}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}
