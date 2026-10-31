import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createAvailability, deleteAvailability, getAvailability, getProfessionals } from "../api/client";
import { useAddonGuard } from "../hooks/useAddonGuard";
import { Availability, Modalidade, Professional } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar, confirmar } from "../utils/dialog";
import { DIAS_SEMANA } from "../utils/serviceFormat";
import { Badge, Chip, EmptyState, Loading, PrimaryButton, s, SectionTitle, ServiceHeading } from "./services/common";

const COR = "#7C3AED";
const DURACOES = [30, 45, 50, 60, 90];

type Props = { navigation: any; route: any };

function mascaraHora(texto: string) {
  const n = texto.replace(/\D/g, "").slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
}

/**
 * Agenda semanal. O profissional edita a própria; a clínica edita a agenda
 * geral dela e a de cada profissional da equipe.
 */
export default function AvailabilityScreen({ route }: Props) {
  const professional = route.params?.professional;
  const clinic = route.params?.clinic;
  const telemedicina = useAddonGuard("addon_telemedicina");

  const [equipe, setEquipe] = useState<Professional[]>([]);
  const [dono, setDono] = useState<number | null>(professional?.codigo ?? route.params?.professionalId ?? null);
  const [linhas, setLinhas] = useState<Availability[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("12:00");
  const [duracao, setDuracao] = useState(60);
  const [modalidade, setModalidade] = useState<Modalidade>("presencial");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Só quem a prefeitura já aprovou pode ter horários.
    if (clinic?.codigo) {
      getProfessionals({ clinic: clinic.codigo })
        .then((lista) => setEquipe(lista.filter((p) => (p.status_cadastro ?? "aprovado") === "aprovado")))
        .catch(() => setEquipe([]));
    }
  }, [clinic?.codigo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      if (dono) {
        setLinhas(await getAvailability({ codigo_profissional: dono }));
      } else {
        // Por clínica vêm todas as linhas; a agenda geral é a sem profissional.
        const todas = await getAvailability({ codigo_clinica: clinic.codigo });
        setLinhas(todas.filter((l) => !l.codigo_profissional));
      }
    } catch (err) {
      avisar("Horários", getErrorMessage(err, "Não foi possível carregar os horários."));
    } finally {
      setCarregando(false);
    }
  }, [dono, clinic?.codigo]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fim)) {
      avisar("Horários", "Use o formato HH:MM.");
      return;
    }
    setSalvando(true);
    try {
      await createAvailability({
        codigo_profissional: dono,
        dia_semana: dia,
        hora_inicio: inicio,
        hora_fim: fim,
        duracao_minutos: duracao,
        modalidade,
      });
      await carregar();
    } catch (err) {
      avisar("Horários", getErrorMessage(err, "Não foi possível salvar o horário."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(linha: Availability) {
    const ok = await confirmar(
      "Remover horário",
      `${DIAS_SEMANA[linha.dia_semana]} ${linha.hora_inicio}–${linha.hora_fim}. Consultas já marcadas continuam valendo.`,
      "Remover"
    );
    if (!ok) return;
    try {
      await deleteAvailability(linha.codigo);
      await carregar();
    } catch (err) {
      avisar("Horários", getErrorMessage(err, "Não foi possível remover."));
    }
  }

  function escolherModalidade(m: Modalidade) {
    if (m === "telemedicina" && !telemedicina.isUnlocked) {
      telemedicina.showUpsell();
      return;
    }
    setModalidade(m);
  }

  const porDia = DIAS_SEMANA.map((nome, indice) => ({ nome, linhas: linhas.filter((l) => l.dia_semana === indice) }))
    .filter((d) => d.linhas.length > 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <ServiceHeading
        icon="time-outline"
        color={COR}
        title="Horários de atendimento"
        text="Os pacientes só conseguem agendar dentro destes horários. Horários online exigem o add-on de telemedicina."
      />

      {clinic ? (
        <>
          <SectionTitle>Agenda de</SectionTitle>
          <View style={s.chipRow}>
            <Chip label="Clínica (geral)" selected={dono === null} color={COR} onPress={() => setDono(null)} />
            {equipe.map((p) => <Chip key={p.codigo} label={p.nome} selected={dono === p.codigo} color={COR} onPress={() => setDono(p.codigo)} />)}
          </View>
        </>
      ) : null}

      <View style={[s.formCard, { marginTop: 12 }]}>
        <Text style={s.cardTitle}>Adicionar horário</Text>
        <SectionTitle>Dia da semana</SectionTitle>
        <View style={s.chipRow}>
          {DIAS_SEMANA.map((nome, i) => <Chip key={nome} label={nome.slice(0, 3)} selected={dia === i} color={COR} onPress={() => setDia(i)} />)}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SectionTitle>Início</SectionTitle>
            <TextInput style={s.input} value={inicio} onChangeText={(t) => setInicio(mascaraHora(t))} keyboardType="numeric" placeholder="08:00" />
          </View>
          <View style={{ flex: 1 }}>
            <SectionTitle>Fim</SectionTitle>
            <TextInput style={s.input} value={fim} onChangeText={(t) => setFim(mascaraHora(t))} keyboardType="numeric" placeholder="12:00" />
          </View>
        </View>

        <SectionTitle>Duração de cada consulta</SectionTitle>
        <View style={s.chipRow}>
          {DURACOES.map((d) => <Chip key={d} label={`${d} min`} selected={duracao === d} color={COR} onPress={() => setDuracao(d)} />)}
        </View>

        <SectionTitle>Modalidade</SectionTitle>
        <View style={s.chipRow}>
          <Chip label="Presencial" icon="location-outline" selected={modalidade === "presencial"} color={COR} onPress={() => escolherModalidade("presencial")} />
          <Chip
            label="Telemedicina"
            icon={telemedicina.isUnlocked ? "videocam-outline" : "lock-closed-outline"}
            selected={modalidade === "telemedicina"}
            color={COR}
            onPress={() => escolherModalidade("telemedicina")}
          />
        </View>

        <PrimaryButton title="Adicionar" color={COR} onPress={adicionar} loading={salvando} />
      </View>

      <SectionTitle>Semana</SectionTitle>
      {carregando ? <Loading /> : porDia.length === 0 ? (
        <EmptyState icon="calendar-outline" text="Nenhum horário cadastrado. Sem horários, ninguém consegue agendar." />
      ) : porDia.map((d) => (
        <View key={d.nome} style={s.card}>
          <Text style={s.cardTitle}>{d.nome}</Text>
          {d.linhas.map((l) => (
            <View key={l.codigo} style={[s.row, { marginTop: 8 }]}>
              <Text style={[s.optionTitle, { flex: 1 }]}>{l.hora_inicio}–{l.hora_fim} · {l.duracao_minutos} min</Text>
              <Badge label={l.modalidade === "telemedicina" ? "Online" : "Presencial"} color={l.modalidade === "telemedicina" ? "#0F9D78" : "#64748B"} />
              <TouchableOpacity onPress={() => remover(l)} accessibilityLabel="Remover horário">
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
