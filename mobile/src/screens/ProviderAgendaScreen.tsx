import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addAppointmentNote, AppointmentAction, changeAppointment, getAppointmentNotes,
  getAppointmentsByClinic, getAppointmentsByProfessional,
} from "../api/client";
import { AppointmentNote, AppointmentWithDetails } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar, confirmar } from "../utils/dialog";
import { entrarNaTeleconsulta } from "../utils/telemedicine";
import { dataIso, formatarHora, formatarHoraUtc, ROTULO_ATENDIMENTO, STATUS_CONSULTA } from "../utils/serviceFormat";
import { Badge, EmptyState, Loading, PrimaryButton, s, ServiceHeading } from "./services/common";
import IconText from "../components/IconText";

const COR = "#2563EB";
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = { navigation: any; route: any };

// Dois dias para trás (registrar evolução/ausência atrasada) e duas semanas à frente.
function diasDaAgenda() {
  const hoje = new Date();
  return Array.from({ length: 16 }, (_, i) => {
    const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i - 2);
    const rotulo = i === 2 ? "Hoje" : i === 1 ? "Ontem" : i === 3 ? "Amanhã" : DIAS_CURTOS[dia.getDay()];
    return { iso: dataIso(dia), rotulo: `${rotulo}, ${dia.getDate()}` };
  });
}

function Evolucoes({ consulta }: { consulta: AppointmentWithDetails }) {
  const [notas, setNotas] = useState<AppointmentNote[] | null>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    getAppointmentNotes(consulta.codigo!).then(setNotas).catch(() => setNotas([]));
  }, [consulta.codigo]);

  useEffect(carregar, [carregar]);

  async function salvar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await addAppointmentNote(consulta.codigo!, texto.trim());
      setTexto("");
      carregar();
    } catch (err) {
      avisar("Evolução", getErrorMessage(err, "Não foi possível registrar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EEF2F7" }}>
      <View style={s.helpRow}>
        <Ionicons name="lock-closed-outline" size={14} color="#64748B" />
        <Text style={s.helpText}>Visível apenas para o paciente e para quem atende.</Text>
      </View>
      {notas === null ? <Loading /> : notas.length === 0 ? (
        <Text style={s.cardText}>Nenhuma evolução registrada.</Text>
      ) : notas.map((n) => (
        <Text key={n.codigo} style={s.cardText}>{formatarHoraUtc(n.criado_em)} — {n.texto}</Text>
      ))}
      {consulta.status !== "cancelada" ? (
        <>
          <TextInput
            style={[s.input, { minHeight: 70, textAlignVertical: "top", marginTop: 8 }]}
            value={texto}
            onChangeText={setTexto}
            placeholder="Registrar evolução, conduta, encaminhamento..."
            placeholderTextColor="#94A3B8"
            multiline
          />
          <PrimaryButton title="Salvar evolução" color={COR} onPress={salvar} loading={salvando} disabled={!texto.trim()} style={{ marginTop: 8 }} />
        </>
      ) : null}
    </View>
  );
}

function Acao({ label, icon, color = COR, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, { borderColor: `${color}55` }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProviderAgendaScreen({ route }: Props) {
  const professional = route.params?.professional;
  const clinic = route.params?.clinic;
  const dias = useMemo(diasDaAgenda, []);
  const [dia, setDia] = useState(dias[2].iso);
  const [consultas, setConsultas] = useState<AppointmentWithDetails[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      // Com profissional, a agenda dele (mesmo aberta pela clínica); sem, a da clínica toda.
      const lista = professional?.codigo
        ? await getAppointmentsByProfessional(professional.codigo, dia)
        : (await getAppointmentsByClinic(clinic.codigo)).filter((c) => c.data_hora.startsWith(dia));
      setConsultas(lista.sort((a, b) => a.data_hora.localeCompare(b.data_hora)));
    } catch (err) {
      avisar("Agenda", getErrorMessage(err, "Não foi possível carregar a agenda."));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [professional?.codigo, clinic?.codigo, dia]);

  useEffect(() => { setCarregando(true); carregar(); }, [carregar]);

  async function executar(consulta: AppointmentWithDetails, acao: AppointmentAction) {
    if (acao === "cancel" || acao === "no-show") {
      const texto = acao === "cancel" ? "Cancelar esta consulta? O paciente verá o cancelamento." : "Registrar que o paciente não compareceu?";
      if (!(await confirmar(acao === "cancel" ? "Cancelar consulta" : "Ausência", texto))) return;
    }
    try {
      await changeAppointment(consulta.codigo!, acao);
      await carregar();
    } catch (err) {
      avisar("Agenda", getErrorMessage(err, "Não foi possível atualizar a consulta."));
    }
  }

  async function teleconsulta(consulta: AppointmentWithDetails) {
    if (await entrarNaTeleconsulta(consulta.codigo!)) carregar();
  }

  const titulo = professional?.nome ?? clinic?.nome ?? "Agenda";
  const presentes = consultas.filter((c) => c.status !== "cancelada");

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} />}
    >
      <ServiceHeading
        icon="calendar-outline"
        color={COR}
        title={titulo}
        text={`${presentes.length} atendimento(s) neste dia · ${presentes.filter((c) => c.modalidade === "telemedicina").length} online`}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {dias.map((d) => (
          <TouchableOpacity
            key={d.iso}
            onPress={() => setDia(d.iso)}
            style={[s.chip, dia === d.iso && { backgroundColor: COR, borderColor: COR }]}
          >
            <Text style={[s.chipText, dia === d.iso && s.selectedText]}>{d.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {carregando ? <Loading /> : consultas.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" text="Nenhum atendimento neste dia." />
      ) : consultas.map((c) => {
        const status = STATUS_CONSULTA[c.status];
        const online = c.modalidade === "telemedicina";
        const aberto = aberta === c.codigo;
        const pendente = c.status === "agendada" || c.status === "confirmada";

        return (
          <View key={c.codigo} style={[s.card, c.status === "em_atendimento" && { borderColor: COR, borderWidth: 2 }]}>
            <View style={s.row}>
              <Text style={[s.cardTitle, { fontSize: 18 }]}>{formatarHora(c.data_hora)}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Badge label={online ? "Online" : "Presencial"} color={online ? "#0F9D78" : "#64748B"} />
                <Badge label={status.label} color={status.color} />
              </View>
            </View>
            <Text style={[s.cardTitle, { marginTop: 6 }]}>{c.paciente_nome}</Text>
            {c.animal_nome ? (
              <IconText icon="paw-outline" style={s.cardText}>{c.animal_nome} ({c.animal_especie})</IconText>
            ) : null}
            <Text style={s.cardText}>
              {[
                c.tipo_atendimento ? ROTULO_ATENDIMENTO[c.tipo_atendimento] : c.especializacao_nome,
                !professional && c.profissional_nome ? `com ${c.profissional_nome}` : null,
                c.paciente_fone,
              ].filter(Boolean).join(" · ")}
            </Text>
            {c.observacoes ? <Text style={[s.cardText, { fontStyle: "italic" }]}>"{c.observacoes}"</Text> : null}

            <View style={[s.chipRow, { marginTop: 10 }]}>
              {c.status === "agendada" ? <Acao label="Confirmar presença" icon="checkmark-outline" onPress={() => executar(c, "confirm")} /> : null}
              {pendente && !online ? <Acao label="Iniciar" icon="play-outline" onPress={() => executar(c, "start")} /> : null}
              {online && (pendente || c.status === "em_atendimento") ? (
                <Acao label={c.status === "em_atendimento" ? "Voltar à sala" : "Iniciar teleconsulta"} icon="videocam-outline" color="#0F9D78" onPress={() => teleconsulta(c)} />
              ) : null}
              {c.status === "em_atendimento" || pendente ? <Acao label="Finalizar" icon="checkmark-done-outline" color="#16A34A" onPress={() => executar(c, "finish")} /> : null}
              {pendente ? <Acao label="Faltou" icon="remove-circle-outline" color="#64748B" onPress={() => executar(c, "no-show")} /> : null}
              {pendente ? <Acao label="Cancelar" icon="close-outline" color="#DC2626" onPress={() => executar(c, "cancel")} /> : null}
              <Acao label={aberto ? "Fechar evolução" : "Evolução"} icon="document-text-outline" color="#7C3AED" onPress={() => setAberta(aberto ? null : c.codigo!)} />
            </View>

            {aberto ? <Evolucoes consulta={c} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
