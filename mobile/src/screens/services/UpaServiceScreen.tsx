import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMyUpaQueue, getUpaProtocol, getUpaUnits, joinUpaQueue, updateUpaQueueStatus } from "../../api/client";
import { UpaQueueEntry, UpaUnit } from "../../types";
import { getErrorMessage } from "../../utils/errorMessage";
import { avisar, confirmar } from "../../utils/dialog";
import { formatarDataUtc, formatarEspera, formatarHoraUtc, RISCO, STATUS_FILA } from "../../utils/serviceFormat";
import {
  Badge, EmptyState, Loading, LoginRequired, OptionRow, PrimaryButton, s, SectionTitle, ServiceHeading,
} from "./common";

const COR = "#2563EB";
const ATUALIZAR_A_CADA_MS = 30_000;

type Props = { navigation: any; route: any };

function ProtocoloCard({ entrada, onDesistir }: { entrada: UpaQueueEntry; onDesistir?: () => void }) {
  const ativa = !["finalizado", "cancelado"].includes(entrada.status);
  const risco = entrada.classificacao_risco ? RISCO[entrada.classificacao_risco] : null;

  return (
    <View style={[s.formCard, entrada.foi_chamado && { borderColor: COR, borderWidth: 2 }]}>
      <View style={s.row}>
        <Text style={s.cardTitle}>Protocolo {entrada.protocolo}</Text>
        <Badge label={STATUS_FILA[entrada.status]} color={ativa ? COR : "#64748B"} />
      </View>
      <Text style={s.cardText}>{entrada.unidade_nome}{entrada.unidade_endereco ? ` · ${entrada.unidade_endereco}` : ""}</Text>
      <Text style={s.cardText}>Entrada às {formatarHoraUtc(entrada.entrada_em)}{entrada.setor ? ` · Setor: ${entrada.setor}` : ""}</Text>

      {entrada.foi_chamado ? (
        <View style={[s.helpRow, { marginTop: 12 }]}>
          <Ionicons name="notifications" size={20} color={COR} />
          <Text style={[s.helpText, { color: COR, fontWeight: "700" }]}>Você foi chamado! Dirija-se ao atendimento.</Text>
        </View>
      ) : ativa ? (
        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{entrada.posicao ?? "—"}</Text>
            <Text style={s.statLabel}>sua posição</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{formatarEspera(entrada.tempo_estimado_minutos)}</Text>
            <Text style={s.statLabel}>espera estimada</Text>
          </View>
        </View>
      ) : null}

      {risco ? (
        <View style={[s.helpRow, { marginTop: 10 }]}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: risco.color }} />
          <Text style={s.helpText}>Classificação de risco: {risco.label}</Text>
        </View>
      ) : null}

      {ativa && onDesistir && ["aguardando_triagem", "em_triagem", "aguardando_atendimento"].includes(entrada.status) ? (
        <TouchableOpacity style={s.secondaryButton} onPress={onDesistir}>
          <Text style={[s.secondaryButtonText, { color: "#DC2626" }]}>Desistir da fila</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function UpaServiceScreen({ navigation, route }: Props) {
  const patient = route.params?.patient;
  const [unidades, setUnidades] = useState<UpaUnit[]>([]);
  const [selecionada, setSelecionada] = useState<UpaUnit | null>(null);
  const [minhas, setMinhas] = useState<UpaQueueEntry[]>([]);
  const [sintomas, setSintomas] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [consultado, setConsultado] = useState<UpaQueueEntry | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const ativa = minhas.find((e) => !["finalizado", "cancelado"].includes(e.status)) ?? null;

  const carregar = useCallback(async () => {
    try {
      const [listaUnidades, entradas] = await Promise.all([
        getUpaUnits(),
        patient ? getMyUpaQueue() : Promise.resolve([] as UpaQueueEntry[]),
      ]);
      setUnidades(listaUnidades);
      setMinhas(entradas);
      setSelecionada((atual) => (atual ? listaUnidades.find((u) => u.codigo === atual.codigo) ?? null : null));
    } catch (err) {
      avisar("UPA", getErrorMessage(err, "Não foi possível carregar as unidades."));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [patient]);

  useEffect(() => {
    carregar();
    // Lotação e posição mudam o tempo todo: atualiza sozinho enquanto a tela está aberta.
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [carregar]);

  async function entrarNaFila() {
    if (!selecionada) return;
    setEnviando(true);
    try {
      const entrada = await joinUpaQueue(selecionada.codigo, sintomas);
      setSintomas("");
      avisar("Você está na fila", `Protocolo ${entrada.protocolo}. Acompanhe sua posição nesta tela.`);
      await carregar();
    } catch (err) {
      avisar("Não foi possível entrar na fila", getErrorMessage(err, "Tente novamente."));
    } finally {
      setEnviando(false);
    }
  }

  async function desistir(entrada: UpaQueueEntry) {
    const ok = await confirmar("Desistir da fila", `Sair da fila da ${entrada.unidade_nome}? Você perderá sua posição.`, "Desistir");
    if (!ok) return;
    try {
      await updateUpaQueueStatus(entrada.codigo, { status: "cancelado" });
      await carregar();
    } catch (err) {
      avisar("Erro", getErrorMessage(err, "Não foi possível sair da fila."));
    }
  }

  async function consultarProtocolo() {
    if (!protocolo.trim()) return;
    try {
      setConsultado(await getUpaProtocol(protocolo.trim()));
    } catch (err) {
      setConsultado(null);
      avisar("Protocolo", getErrorMessage(err, "Protocolo não encontrado."));
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} />}
    >
      <ServiceHeading
        icon="medkit-outline"
        color={COR}
        title="UPA / SUS"
        text="Consulte a lotação antes de sair de casa e, quando a unidade permitir, entre na fila pelo app."
      />

      {ativa ? (
        <>
          <SectionTitle>Seu atendimento</SectionTitle>
          <ProtocoloCard entrada={ativa} onDesistir={() => desistir(ativa)} />
        </>
      ) : null}

      <SectionTitle>Unidades de atendimento</SectionTitle>
      {carregando ? <Loading /> : unidades.length === 0 ? (
        <EmptyState icon="business-outline" text="Nenhuma UPA cadastrada no momento." />
      ) : unidades.map((unidade) => (
        <OptionRow
          key={unidade.codigo}
          title={unidade.nome}
          subtitle={`${unidade.aguardando} aguardando · espera ~${formatarEspera(unidade.tempo_estimado_minutos)}${unidade.endereco ? ` · ${unidade.endereco}` : ""}`}
          selected={selecionada?.codigo === unidade.codigo}
          color={COR}
          onPress={() => setSelecionada(unidade)}
          right={unidade.aceita_fila_online ? <Badge label="Fila pelo app" color="#16A34A" /> : undefined}
        />
      ))}

      {selecionada ? (
        <View style={s.formCard}>
          <Text style={s.cardTitle}>{selecionada.nome}</Text>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{selecionada.aguardando}</Text>
              <Text style={s.statLabel}>aguardando</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{selecionada.em_atendimento}</Text>
              <Text style={s.statLabel}>em atendimento</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{formatarEspera(selecionada.tempo_estimado_minutos)}</Text>
              <Text style={s.statLabel}>{selecionada.estimativa_por_historico ? "espera média recente" : "espera estimada"}</Text>
            </View>
          </View>
          <Text style={[s.cardText, { marginTop: 10 }]}>
            O atendimento segue a classificação de risco: casos mais graves são chamados primeiro, independente da ordem de chegada.
          </Text>

          {!patient ? (
            <View style={{ marginTop: 12 }}><LoginRequired navigation={navigation} color={COR} /></View>
          ) : ativa ? (
            <Text style={[s.formHint, { marginTop: 12 }]}>Você já está em uma fila. Finalize ou desista dela para entrar em outra.</Text>
          ) : selecionada.aceita_fila_online ? (
            <>
              <SectionTitle>O que você está sentindo? (opcional)</SectionTitle>
              <TextInput
                style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
                value={sintomas}
                onChangeText={setSintomas}
                placeholder="Ex.: febre alta desde ontem, dor no peito..."
                placeholderTextColor="#94A3B8"
                multiline
              />
              <Text style={[s.helpText, { marginTop: 8 }]}>
                Em caso de falta de ar, dor no peito forte ou desmaio, procure a unidade imediatamente ou ligue 192.
              </Text>
              <PrimaryButton title="Entrar na fila" color={COR} onPress={entrarNaFila} loading={enviando} />
            </>
          ) : (
            <Text style={[s.formHint, { marginTop: 12 }]}>Esta unidade não aceita fila pelo aplicativo. Dirija-se à recepção.</Text>
          )}
        </View>
      ) : null}

      {patient ? (
        <>
          <SectionTitle>Consultar protocolo</SectionTitle>
          <View style={s.formCard}>
            <TextInput
              style={s.input}
              value={protocolo}
              onChangeText={setProtocolo}
              placeholder="Ex.: UPA3-20261025-A1B2C3"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
            <PrimaryButton title="Consultar" color={COR} onPress={consultarProtocolo} disabled={!protocolo.trim()} />
          </View>
          {consultado ? <ProtocoloCard entrada={consultado} /> : null}

          {minhas.filter((e) => e !== ativa).length > 0 ? (
            <>
              <SectionTitle>Atendimentos anteriores</SectionTitle>
              {minhas.filter((e) => e !== ativa).map((entrada) => (
                <View key={entrada.codigo} style={s.card}>
                  <View style={s.row}>
                    <Text style={s.cardTitle}>{entrada.unidade_nome}</Text>
                    <Badge label={STATUS_FILA[entrada.status]} color="#64748B" />
                  </View>
                  <Text style={s.cardText}>{entrada.protocolo} · {formatarDataUtc(entrada.entrada_em)}</Text>
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
