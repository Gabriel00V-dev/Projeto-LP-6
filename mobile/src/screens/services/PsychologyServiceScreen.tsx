import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { createScheduledAppointment, getProfessionals, getProfessionalSlots } from "../../api/client";
import SlotPicker from "../../components/SlotPicker";
import { Modalidade, Professional, Slot } from "../../types";
import { getErrorMessage } from "../../utils/errorMessage";
import { avisar } from "../../utils/dialog";
import { formatarDataHora } from "../../utils/serviceFormat";
import {
  Badge, Chip, EmptyState, Loading, LoginRequired, OptionRow, PrimaryButton, s, SectionTitle, ServiceHeading,
} from "./common";

const COR = "#7C3AED";

type Props = { navigation: any; route: any };

export default function PsychologyServiceScreen({ navigation, route }: Props) {
  const patient = route.params?.patient;
  const [profissionais, setProfissionais] = useState<Professional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [profissional, setProfissional] = useState<Professional | null>(null);
  const [modalidade, setModalidade] = useState<Modalidade>("presencial");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getProfessionals({ type: "psicologo" })
      .then(setProfissionais)
      .catch((err) => avisar("Psicologia", getErrorMessage(err, "Não foi possível carregar os profissionais.")))
      .finally(() => setCarregando(false));
  }, []);

  function escolher(p: Professional) {
    setProfissional(p);
    // Telemedicina só aparece para quem tem o add-on (plano, 5.1).
    if (!p.telemedicina) setModalidade("presencial");
  }

  async function confirmarAgendamento() {
    if (!profissional || !slot) return;
    setEnviando(true);
    try {
      await createScheduledAppointment({
        codigo_profissional: profissional.codigo,
        data_hora: slot.data_hora,
        modalidade,
        observacoes: observacoes.trim() || undefined,
      });
      avisar("Consulta agendada", `${profissional.nome} · ${formatarDataHora(slot.data_hora)} (${modalidade === "telemedicina" ? "online" : "presencial"}).`);
      navigation.navigate("Appointments", { patient });
    } catch (err) {
      avisar("Não foi possível agendar", getErrorMessage(err, "Tente outro horário."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <ServiceHeading
        icon="heart-outline"
        color={COR}
        title="Psicologia"
        text="Escolha o profissional, a modalidade e um horário livre na agenda dele."
      />

      <SectionTitle>Profissional</SectionTitle>
      {carregando ? <Loading /> : profissionais.length === 0 ? (
        <EmptyState icon="people-outline" text="Nenhum psicólogo com agenda cadastrada ainda." />
      ) : profissionais.map((p) => (
        <OptionRow
          key={p.codigo}
          title={p.nome}
          subtitle={[
            p.registro_profissional ? `CRP ${p.registro_profissional}` : null,
            p.clinica_nome ?? "Atendimento independente",
            p.telemedicina ? "presencial e online" : "presencial",
          ].filter(Boolean).join(" · ")}
          selected={profissional?.codigo === p.codigo}
          color={COR}
          onPress={() => escolher(p)}
          right={p.telemedicina ? <Badge label="Online" color="#0F9D78" /> : undefined}
        />
      ))}

      {profissional ? (
        <>
          {profissional.bio ? <Text style={[s.formHint, { marginTop: 4 }]}>{profissional.bio}</Text> : null}

          <SectionTitle>Modalidade</SectionTitle>
          <View style={s.chipRow}>
            <Chip label="Presencial" icon="location-outline" selected={modalidade === "presencial"} color={COR} onPress={() => setModalidade("presencial")} />
            <Chip
              label="Telemedicina"
              icon="videocam-outline"
              selected={modalidade === "telemedicina"}
              color={COR}
              disabled={!profissional.telemedicina}
              onPress={() => setModalidade("telemedicina")}
            />
          </View>
          {!profissional.telemedicina ? <Text style={[s.helpText, { marginTop: 6 }]}>Este profissional atende apenas presencialmente.</Text> : null}

          <SectionTitle>Data e horário</SectionTitle>
          <SlotPicker
            color={COR}
            reloadKey={`${profissional.codigo}-${modalidade}`}
            loadSlots={(data) => getProfessionalSlots(profissional.codigo, data, modalidade)}
            selected={slot}
            onSelect={setSlot}
          />

          {!patient ? (
            <View style={{ marginTop: 16 }}><LoginRequired navigation={navigation} color={COR} /></View>
          ) : (
            <>
              <SectionTitle>Quer contar algo antes da consulta? (opcional)</SectionTitle>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: "top" }]}
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Visível só para você e o profissional."
                placeholderTextColor="#94A3B8"
                multiline
              />
              <PrimaryButton
                title={slot ? `Confirmar ${slot.hora}` : "Escolha um horário"}
                color={COR}
                onPress={confirmarAgendamento}
                disabled={!slot}
                loading={enviando}
              />
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
