import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addVaccine, createAnimal, deleteAnimal, getAnimals, updateAnimal } from "../api/client";
import { Animal } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar, confirmar } from "../utils/dialog";
import { convertDateToISO, convertISOToDate, formatDateInput, validateDateFormat } from "../utils/dateUtils";
import { Chip, EmptyState, Loading, PrimaryButton, s, SectionTitle, ServiceHeading } from "./services/common";

const COR = "#D97706";
const ESPECIES = ["Cão", "Gato", "Ave", "Coelho", "Outro"];

type Props = { navigation: any; route: any };

type Formulario = { nome: string; especie: string; raca: string; nascimento: string; peso: string; observacoes: string };
const VAZIO: Formulario = { nome: "", especie: "Cão", raca: "", nascimento: "", peso: "", observacoes: "" };

function Campo({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[s.helpText, { marginBottom: 4 }]}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor="#94A3B8" {...props} />
    </View>
  );
}

function VacinaForm({ animal, onSalvo }: { animal: Animal; onSalvo: () => void }) {
  const [nome, setNome] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [proxima, setProxima] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim() || !validateDateFormat(aplicada) || (proxima && !validateDateFormat(proxima))) {
      avisar("Vacina", "Informe o nome e as datas no formato DD/MM/AAAA.");
      return;
    }
    setSalvando(true);
    try {
      await addVaccine(animal.codigo, {
        nome: nome.trim(),
        aplicada_em: convertDateToISO(aplicada),
        proxima_dose: proxima ? convertDateToISO(proxima) : undefined,
      });
      setNome(""); setAplicada(""); setProxima("");
      onSalvo();
    } catch (err) {
      avisar("Vacina", getErrorMessage(err, "Não foi possível registrar a vacina."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EEF2F7" }}>
      <Campo label="Vacina" value={nome} onChangeText={setNome} placeholder="Ex.: V10, antirrábica" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Campo label="Aplicada em" value={aplicada} onChangeText={(t) => setAplicada(formatDateInput(t))} placeholder="DD/MM/AAAA" keyboardType="numeric" /></View>
        <View style={{ flex: 1 }}><Campo label="Próxima dose" value={proxima} onChangeText={(t) => setProxima(formatDateInput(t))} placeholder="opcional" keyboardType="numeric" /></View>
      </View>
      <PrimaryButton title="Registrar vacina" color={COR} onPress={salvar} loading={salvando} style={{ marginTop: 4 }} />
    </View>
  );
}

export default function PetsScreen({ route }: Props) {
  const patient = route.params?.patient;
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [editando, setEditando] = useState<Animal | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [vacinaAberta, setVacinaAberta] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setAnimais(await getAnimals());
    } catch (err) {
      avisar("Animais", getErrorMessage(err, "Não foi possível carregar seus animais."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setForm(VAZIO);
    setMostrarForm(true);
  }

  function abrirEdicao(animal: Animal) {
    setEditando(animal);
    setForm({
      nome: animal.nome,
      especie: animal.especie,
      raca: animal.raca ?? "",
      nascimento: animal.data_nascimento ? convertISOToDate(animal.data_nascimento) : "",
      peso: animal.peso ? String(animal.peso) : "",
      observacoes: animal.observacoes ?? "",
    });
    setMostrarForm(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      avisar("Cadastro", "Informe o nome do animal.");
      return;
    }
    if (form.nascimento && !validateDateFormat(form.nascimento)) {
      avisar("Cadastro", "Data de nascimento inválida (DD/MM/AAAA).");
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      especie: form.especie,
      raca: form.raca.trim() || null,
      data_nascimento: form.nascimento ? convertDateToISO(form.nascimento) : null,
      peso: form.peso ? Number(form.peso.replace(",", ".")) : null,
      observacoes: form.observacoes.trim() || null,
    };

    setSalvando(true);
    try {
      if (editando) await updateAnimal(editando.codigo, payload);
      else await createAnimal(payload);
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      avisar("Cadastro", getErrorMessage(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(animal: Animal) {
    if (!(await confirmar("Remover animal", `Remover ${animal.nome} e todo o histórico de vacinas?`, "Remover"))) return;
    try {
      await deleteAnimal(animal.codigo);
      await carregar();
    } catch (err) {
      avisar("Remover", getErrorMessage(err, "Não foi possível remover."));
    }
  }

  const set = (campo: keyof Formulario) => (valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <ServiceHeading icon="paw-outline" color={COR} title="Meus animais" text={`Cadastro e vacinas dos animais de ${patient?.nome ?? "você"}.`} />

      {mostrarForm ? (
        <View style={s.formCard}>
          <Text style={s.cardTitle}>{editando ? `Editar ${editando.nome}` : "Novo animal"}</Text>
          <View style={{ height: 10 }} />
          <Campo label="Nome *" value={form.nome} onChangeText={set("nome")} placeholder="Ex.: Thor" />
          <Text style={[s.helpText, { marginBottom: 6 }]}>Espécie *</Text>
          <View style={[s.chipRow, { marginBottom: 10 }]}>
            {ESPECIES.map((e) => <Chip key={e} label={e} selected={form.especie === e} color={COR} onPress={() => set("especie")(e)} />)}
          </View>
          <Campo label="Raça" value={form.raca} onChangeText={set("raca")} placeholder="Ex.: SRD" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Campo label="Nascimento" value={form.nascimento} onChangeText={(t) => set("nascimento")(formatDateInput(t))} placeholder="DD/MM/AAAA" keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Campo label="Peso (kg)" value={form.peso} onChangeText={set("peso")} placeholder="Ex.: 12,5" keyboardType="decimal-pad" /></View>
          </View>
          <Campo label="Observações" value={form.observacoes} onChangeText={set("observacoes")} placeholder="Alergias, medicação contínua..." multiline />
          <PrimaryButton title={editando ? "Salvar alterações" : "Cadastrar"} color={COR} onPress={salvar} loading={salvando} />
          <TouchableOpacity style={s.secondaryButton} onPress={() => setMostrarForm(false)}>
            <Text style={s.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <PrimaryButton title="Cadastrar animal" color={COR} onPress={abrirNovo} style={{ marginTop: 0, marginBottom: 8 }} />
      )}

      <SectionTitle>Cadastrados</SectionTitle>
      {carregando ? <Loading /> : animais.length === 0 ? (
        <EmptyState icon="paw-outline" text="Nenhum animal cadastrado ainda." />
      ) : animais.map((animal) => (
        <View key={animal.codigo} style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{animal.nome}</Text>
              <Text style={s.cardText}>
                {[animal.especie, animal.raca, animal.peso ? `${animal.peso} kg` : null, animal.data_nascimento ? `nasc. ${convertISOToDate(animal.data_nascimento)}` : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <TouchableOpacity onPress={() => abrirEdicao(animal)} accessibilityLabel={`Editar ${animal.nome}`}>
              <Ionicons name="create-outline" size={20} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remover(animal)} accessibilityLabel={`Remover ${animal.nome}`}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </TouchableOpacity>
          </View>

          <Text style={[s.helpText, { marginTop: 10, fontWeight: "600" }]}>Vacinas</Text>
          {(animal.vacinas ?? []).length === 0 ? (
            <Text style={s.cardText}>Nenhuma vacina registrada.</Text>
          ) : (animal.vacinas ?? []).map((v) => (
            <Text key={v.codigo} style={s.cardText}>
              • {v.nome} — {convertISOToDate(v.aplicada_em)}{v.proxima_dose ? ` (próxima: ${convertISOToDate(v.proxima_dose)})` : ""}
            </Text>
          ))}

          {vacinaAberta === animal.codigo ? (
            <VacinaForm animal={animal} onSalvo={() => { setVacinaAberta(null); carregar(); }} />
          ) : (
            <TouchableOpacity onPress={() => setVacinaAberta(animal.codigo)} style={{ marginTop: 8 }}>
              <Text style={s.linkText}>+ Registrar vacina</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
