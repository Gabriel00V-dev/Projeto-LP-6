import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  createScheduledAppointment, getAppointmentsByPatient, getRoomStatus, getTelemedicineProviders, getTelemedicineSlots,
} from "../../api/client";
import SlotPicker from "../../components/SlotPicker";
import { AppointmentWithDetails, RoomStatus, Slot, TelemedicineProvider } from "../../types";
import { getErrorMessage } from "../../utils/errorMessage";
import { avisar } from "../../utils/dialog";
import { entrarNaTeleconsulta } from "../../utils/telemedicine";
import { formatarDataHora, ROTULO_PROFISSIONAL } from "../../utils/serviceFormat";
import {
  Badge, Chip, EmptyState, Loading, LoginRequired, OptionRow, PrimaryButton, s, SectionTitle,
} from "./common";

const COR = "#0F9D78";

type Props = { navigation: any; route: any };

type ConsultaOnline = AppointmentWithDetails & { sala?: RoomStatus };

function descricaoPrestador(p: TelemedicineProvider): string {
  if (p.tipo_prestador === "profissional") {
    return [ROTULO_PROFISSIONAL[p.tipo], p.especializacao_nome, "independente"].filter(Boolean).join(" · ");
  }
  const especialidades = p.especializacoes.map((e) => e.nome).slice(0, 3).join(", ");
  return [`Clínica · ${p.profissionais.length} profissional(is)`, especialidades].filter(Boolean).join(" · ");
}

export default function TelemedicineServiceScreen({ navigation, route }: Props) {
  const patient = route.params?.patient;
  const [aba, setAba] = useState<"join" | "schedule">(patient ? "join" : "schedule");

  // Minhas teleconsultas
  const [consultas, setConsultas] = useState<ConsultaOnline[]>([]);
  const [carregandoConsultas, setCarregandoConsultas] = useState(Boolean(patient));
  const [atualizando, setAtualizando] = useState(false);
  const [entrando, setEntrando] = useState<number | null>(null);

  // Agendar
  const [prestadores, setPrestadores] = useState<TelemedicineProvider[]>([]);
  const [carregandoPrestadores, setCarregandoPrestadores] = useState(true);
  const [prestador, setPrestador] = useState<TelemedicineProvider | null>(null);
  const [especializacao, setEspecializacao] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregarConsultas = useCallback(async () => {
    if (!patient) return;
    try {
      const todas = await getAppointmentsByPatient(patient.codigo);
      const online = todas.filter((c) =>
        c.modalidade === "telemedicina" && ["agendada", "confirmada", "em_atendimento"].includes(c.status)
      );
      // O backend decide se a sala está liberada (janela de horário configurável).
      const comSala = await Promise.all(online.map(async (c): Promise<ConsultaOnline> => {
        try {
          return { ...c, sala: await getRoomStatus(c.codigo!) };
        } catch {
          return c;
        }
      }));
      setConsultas(comSala.filter((c) => !c.sala || !c.sala.encerrada));
    } catch (err) {
      avisar("Telemedicina", getErrorMessage(err, "Não foi possível carregar suas teleconsultas."));
    } finally {
      setCarregandoConsultas(false);
      setAtualizando(false);
    }
  }, [patient]);

  useEffect(() => {
    carregarConsultas();
    getTelemedicineProviders()
      .then(setPrestadores)
      .catch((err) => avisar("Telemedicina", getErrorMessage(err, "Não foi possível carregar os prestadores.")))
      .finally(() => setCarregandoPrestadores(false));
  }, [carregarConsultas]);

  async function entrar(consulta: ConsultaOnline) {
    setEntrando(consulta.codigo!);
    await entrarNaTeleconsulta(consulta.codigo!);
    setEntrando(null);
  }

  async function confirmarAgendamento() {
    if (!prestador || !slot) return;
    setEnviando(true);
    try {
      await createScheduledAppointment({
        codigo_profissional: slot.codigo_profissional,
        codigo_clinica: slot.codigo_profissional ? undefined : slot.codigo_clinica,
        codigo_especializacao: especializacao,
        data_hora: slot.data_hora,
        modalidade: "telemedicina",
      });
      avisar("Teleconsulta agendada", `${slot.profissional_nome ?? prestador.nome} · ${formatarDataHora(slot.data_hora)}. A sala abre alguns minutos antes.`);
      setSlot(null);
      setAba("join");
      setCarregandoConsultas(true);
      carregarConsultas();
    } catch (err) {
      avisar("Não foi possível agendar", getErrorMessage(err, "Tente outro horário."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregarConsultas(); }} />}
    >
      <View style={{ borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16, backgroundColor: "#E7F8F1" }}>
        <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <Ionicons name="videocam-outline" size={30} color={COR} />
        </View>
        <Text style={s.headingTitle}>Atendimento online</Text>
        <Text style={[s.headingText, { textAlign: "center" }]}>Consulte sem sair de casa com clínicas e profissionais que oferecem telemedicina.</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity onPress={() => setAba("join")} style={[s.tab, aba === "join" && s.activeTab]}>
          <Text style={[s.tabText, aba === "join" && { color: COR }]}>Minhas teleconsultas</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAba("schedule")} style={[s.tab, aba === "schedule" && s.activeTab]}>
          <Text style={[s.tabText, aba === "schedule" && { color: COR }]}>Agendar consulta</Text>
        </TouchableOpacity>
      </View>

      {aba === "join" ? (
        !patient ? <LoginRequired navigation={navigation} color={COR} /> :
        carregandoConsultas ? <Loading /> :
        consultas.length === 0 ? (
          <EmptyState icon="videocam-off-outline" text="Você não tem teleconsultas marcadas. Use a aba Agendar consulta." />
        ) : consultas.map((consulta) => (
          <View key={consulta.codigo} style={s.formCard}>
            <View style={s.row}>
              <Text style={s.cardTitle}>{consulta.profissional_nome ?? consulta.clinica_nome}</Text>
              <Badge label={consulta.sala?.liberada ? "Sala aberta" : "Agendada"} color={consulta.sala?.liberada ? COR : "#64748B"} />
            </View>
            <Text style={s.cardText}>
              {formatarDataHora(consulta.data_hora)}
              {consulta.profissional_nome && consulta.clinica_nome ? ` · ${consulta.clinica_nome}` : ""}
              {consulta.animal_nome ? ` · ${consulta.animal_nome}` : ""}
            </Text>
            <PrimaryButton
              title="Entrar na sala"
              color={COR}
              onPress={() => entrar(consulta)}
              disabled={consulta.sala ? !consulta.sala.liberada : false}
              loading={entrando === consulta.codigo}
            />
            <View style={[s.helpRow, { marginTop: 12, justifyContent: "center" }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COR} />
              <Text style={[s.helpText, { flex: 0 }]}>{consulta.sala?.mensagem ?? "Conexão protegida e atendimento sigiloso"}</Text>
            </View>
          </View>
        ))
      ) : (
        <>
          <SectionTitle>Clínica ou profissional</SectionTitle>
          {carregandoPrestadores ? <Loading /> : prestadores.length === 0 ? (
            <EmptyState icon="videocam-off-outline" text="Nenhum prestador oferece telemedicina no momento." />
          ) : prestadores.map((p) => (
            <OptionRow
              key={`${p.tipo_prestador}-${p.codigo}`}
              title={p.nome}
              subtitle={descricaoPrestador(p)}
              selected={prestador?.tipo_prestador === p.tipo_prestador && prestador.codigo === p.codigo}
              color={COR}
              onPress={() => { setPrestador(p); setEspecializacao(null); }}
              right={!p.tem_horarios_online ? <Badge label="Sem horários" color="#94A3B8" /> : undefined}
            />
          ))}

          {prestador ? (
            <>
              {prestador.tipo_prestador === "clinica" && prestador.especializacoes.length > 0 ? (
                <>
                  <SectionTitle>Especialidade</SectionTitle>
                  <View style={s.chipRow}>
                    <Chip label="Todas" selected={especializacao === null} color={COR} onPress={() => setEspecializacao(null)} />
                    {prestador.especializacoes.map((e) => (
                      <Chip key={e.codigo} label={e.nome} selected={especializacao === e.codigo} color={COR} onPress={() => setEspecializacao(e.codigo)} />
                    ))}
                  </View>
                </>
              ) : null}

              <SectionTitle>Horários online</SectionTitle>
              <SlotPicker
                color={COR}
                reloadKey={`${prestador.tipo_prestador}-${prestador.codigo}-${especializacao ?? "todas"}`}
                loadSlots={(data) => getTelemedicineSlots(prestador.tipo_prestador, prestador.codigo, data, especializacao ?? undefined)}
                selected={slot}
                onSelect={setSlot}
                showProfessional={prestador.tipo_prestador === "clinica"}
              />

              {!patient ? (
                <View style={{ marginTop: 16 }}><LoginRequired navigation={navigation} color={COR} /></View>
              ) : (
                <PrimaryButton
                  title={slot ? `Confirmar ${slot.hora}${slot.profissional_nome ? ` com ${slot.profissional_nome}` : ""}` : "Escolha um horário"}
                  color={COR}
                  onPress={confirmarAgendamento}
                  disabled={!slot}
                  loading={enviando}
                />
              )}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
