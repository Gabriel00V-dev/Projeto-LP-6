import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createScheduledAppointment, getAnimals, getProfessionals, getProfessionalSlots } from "../../api/client";
import SlotPicker from "../../components/SlotPicker";
import { Animal, Modalidade, Professional, Slot, TipoAtendimento } from "../../types";
import { getErrorMessage } from "../../utils/errorMessage";
import { avisar } from "../../utils/dialog";
import { formatarDataHora, ROTULO_ATENDIMENTO } from "../../utils/serviceFormat";
import {
  Badge, Chip, EmptyState, Loading, LoginRequired, OptionRow, PrimaryButton, s, SectionTitle, ServiceHeading,
} from "./common";

const COR = "#D97706";

const TIPOS: TipoAtendimento[] = ["consulta", "vacinacao", "castracao", "retorno", "orientacao_online", "emergencia"];

// Plano, 6.4: o que exige exame físico é presencial; orientação é online.
function modalidadesPermitidas(tipo: TipoAtendimento, temOnline: boolean): Modalidade[] {
  if (tipo === "orientacao_online") return temOnline ? ["telemedicina"] : [];
  if (["vacinacao", "castracao", "emergencia"].includes(tipo)) return ["presencial"];
  return temOnline ? ["presencial", "telemedicina"] : ["presencial"];
}

type Props = { navigation: any; route: any };

export default function VeterinaryServiceScreen({ navigation, route }: Props) {
  const patient = route.params?.patient;
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [veterinarios, setVeterinarios] = useState<Professional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [vet, setVet] = useState<Professional | null>(null);
  const [tipo, setTipo] = useState<TipoAtendimento>("consulta");
  const [modalidade, setModalidade] = useState<Modalidade>("presencial");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarAnimais = useCallback(async () => {
    if (!patient) return;
    try {
      const lista = await getAnimals();
      setAnimais(lista);
      setAnimal((atual) => lista.find((a) => a.codigo === atual?.codigo) ?? (lista.length === 1 ? lista[0] : null));
    } catch (err) {
      avisar("Animais", getErrorMessage(err, "Não foi possível carregar seus animais."));
    }
  }, [patient]);

  useEffect(() => {
    Promise.all([carregarAnimais(), getProfessionals({ type: "veterinario" }).then(setVeterinarios)])
      .catch((err) => avisar("Veterinária", getErrorMessage(err, "Não foi possível carregar os veterinários.")))
      .finally(() => setCarregando(false));

    // Volta do cadastro de animais com a lista atualizada.
    return navigation.addListener("focus", carregarAnimais);
  }, [navigation, carregarAnimais]);

  const permitidas = modalidadesPermitidas(tipo, Boolean(vet?.telemedicina));

  useEffect(() => {
    if (permitidas.length && !permitidas.includes(modalidade)) setModalidade(permitidas[0]);
  }, [permitidas.join(), modalidade]);

  async function confirmarAgendamento() {
    if (!vet || !slot || !animal) return;
    setEnviando(true);
    try {
      await createScheduledAppointment({
        codigo_profissional: vet.codigo,
        codigo_animal: animal.codigo,
        tipo_atendimento: tipo,
        data_hora: slot.data_hora,
        modalidade,
        observacoes: observacoes.trim() || undefined,
      });
      avisar("Consulta agendada", `${animal.nome} · ${ROTULO_ATENDIMENTO[tipo]} com ${vet.nome} · ${formatarDataHora(slot.data_hora)}.`);
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
        icon="paw-outline"
        color={COR}
        title="Clínica veterinária"
        text="Escolha o animal, o veterinário e o tipo de atendimento."
      />

      {!patient ? (
        <LoginRequired navigation={navigation} color={COR} />
      ) : (
        <>
          <View style={s.row}>
            <SectionTitle>Animal</SectionTitle>
            <TouchableOpacity onPress={() => navigation.navigate("Pets", { patient })}>
              <Text style={s.linkText}>{animais.length ? "Gerenciar animais" : "Cadastrar animal"}</Text>
            </TouchableOpacity>
          </View>
          {animais.length === 0 ? (
            <EmptyState icon="paw-outline" text="Cadastre seu animal para agendar uma consulta." />
          ) : (
            <View style={s.chipRow}>
              {animais.map((a) => (
                <Chip key={a.codigo} label={`${a.nome} (${a.especie})`} selected={animal?.codigo === a.codigo} color={COR} onPress={() => setAnimal(a)} />
              ))}
            </View>
          )}
        </>
      )}

      <SectionTitle>Veterinário</SectionTitle>
      {carregando ? <Loading /> : veterinarios.length === 0 ? (
        <EmptyState icon="medkit-outline" text="Nenhum veterinário com agenda cadastrada ainda." />
      ) : veterinarios.map((v) => (
        <OptionRow
          key={v.codigo}
          title={v.nome}
          subtitle={[v.clinica_nome ?? "Atendimento independente", v.clinica_endereco, v.registro_profissional ? `CRMV ${v.registro_profissional}` : null].filter(Boolean).join(" · ")}
          selected={vet?.codigo === v.codigo}
          color={COR}
          onPress={() => setVet(v)}
          right={v.telemedicina ? <Badge label="Online" color="#0F9D78" /> : undefined}
        />
      ))}

      {vet ? (
        <>
          <SectionTitle>Tipo de atendimento</SectionTitle>
          <View style={s.chipRow}>
            {TIPOS.map((t) => (
              <Chip
                key={t}
                label={ROTULO_ATENDIMENTO[t]}
                selected={tipo === t}
                color={COR}
                disabled={modalidadesPermitidas(t, Boolean(vet.telemedicina)).length === 0}
                onPress={() => setTipo(t)}
              />
            ))}
          </View>
          {tipo === "emergencia" ? (
            <Text style={[s.helpText, { marginTop: 8, color: "#DC2626" }]}>
              Se o animal corre risco agora, leve-o direto a uma clínica com plantão. O agendamento é para o próximo horário livre.
            </Text>
          ) : null}

          <SectionTitle>Modalidade</SectionTitle>
          <View style={s.chipRow}>
            <Chip label="Presencial" icon="location-outline" selected={modalidade === "presencial"} color={COR} disabled={!permitidas.includes("presencial")} onPress={() => setModalidade("presencial")} />
            <Chip label="Online" icon="videocam-outline" selected={modalidade === "telemedicina"} color={COR} disabled={!permitidas.includes("telemedicina")} onPress={() => setModalidade("telemedicina")} />
          </View>
          {modalidade === "telemedicina" ? (
            <Text style={[s.helpText, { marginTop: 6 }]}>Online serve para orientação, retorno, pós-operatório, exames e medicação. Exame físico é presencial.</Text>
          ) : null}

          <SectionTitle>Data e horário</SectionTitle>
          <SlotPicker
            color={COR}
            reloadKey={`${vet.codigo}-${modalidade}`}
            loadSlots={(data) => getProfessionalSlots(vet.codigo, data, modalidade)}
            selected={slot}
            onSelect={setSlot}
          />

          {patient ? (
            <>
              <SectionTitle>Observações (opcional)</SectionTitle>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: "top" }]}
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Sintomas, medicação em uso..."
                placeholderTextColor="#94A3B8"
                multiline
              />
              <PrimaryButton
                title={!animal ? "Selecione o animal" : slot ? `Confirmar ${slot.hora}` : "Escolha um horário"}
                color={COR}
                onPress={confirmarAgendamento}
                disabled={!slot || !animal}
                loading={enviando}
              />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
