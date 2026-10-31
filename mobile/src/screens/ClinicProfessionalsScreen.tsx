import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createProfessional, getProfessionals, updateProfessional } from "../api/client";
import { Professional, ProfessionalType } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar, confirmar } from "../utils/dialog";
import { ROTULO_PROFISSIONAL } from "../utils/serviceFormat";
import { cpfValido, emailValido, mascaraCpf, mascaraTelefone, somenteDigitos } from "../utils/documentos";
import { Badge, Chip, EmptyState, Loading, PrimaryButton, s, SectionTitle, ServiceHeading } from "./services/common";

const COR = "#2563EB";
const TIPOS: ProfessionalType[] = ["psicologo", "veterinario", "medico", "enfermeiro", "profissional_sus"];

// Tipo sugerido de acordo com o tipo de estabelecimento.
const TIPO_PADRAO: Record<string, ProfessionalType> = {
  veterinaria: "veterinario",
  psicologia: "psicologo",
  upa: "profissional_sus",
  clinica: "medico",
};

type Props = { navigation: any; route: any };

export default function ClinicProfessionalsScreen({ navigation, route }: Props) {
  const clinic = route.params?.clinic;
  const [equipe, setEquipe] = useState<Professional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [fone, setFone] = useState("");
  const [registro, setRegistro] = useState("");
  const [tipo, setTipo] = useState<ProfessionalType>(TIPO_PADRAO[clinic?.tipo ?? "clinica"] ?? "medico");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setEquipe(await getProfessionals({ clinic: clinic.codigo }));
    } catch (err) {
      avisar("Equipe", getErrorMessage(err, "Não foi possível carregar a equipe."));
    } finally {
      setCarregando(false);
    }
  }, [clinic?.codigo]);

  useEffect(() => { carregar(); }, [carregar]);

  async function cadastrar() {
    if (!nome.trim() || !email.trim() || !registro.trim()) {
      avisar("Equipe", "Nome, e-mail, CPF e registro são obrigatórios.");
      return;
    }
    if (!emailValido(email)) {
      avisar("Equipe", "E-mail inválido.");
      return;
    }
    if (!cpfValido(cpf)) {
      avisar("Equipe", "CPF inválido. Confira os números.");
      return;
    }
    setSalvando(true);
    try {
      await createProfessional({
        nome: nome.trim(),
        email: email.trim(),
        cpf: somenteDigitos(cpf),
        fone: fone.trim() || null,
        registro_profissional: registro.trim(),
        tipo,
      });
      setNome(""); setEmail(""); setCpf(""); setFone(""); setRegistro("");
      avisar("Profissional cadastrado", "O cadastro foi enviado para análise da prefeitura. A agenda dele é liberada depois da aprovação.");
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      avisar("Equipe", getErrorMessage(err, "Não foi possível cadastrar."));
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(p: Professional) {
    if (!(await confirmar("Desativar profissional", `${p.nome} deixará de aparecer para agendamento. Consultas marcadas continuam.`, "Desativar"))) return;
    try {
      await updateProfessional(p.codigo, { ativo: false });
      await carregar();
    } catch (err) {
      avisar("Equipe", getErrorMessage(err, "Não foi possível desativar."));
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <ServiceHeading
        icon="people-outline"
        color={COR}
        title="Equipe"
        text="Profissionais que atendem pela clínica. Cada um tem a própria agenda de horários presenciais e online."
      />

      {mostrarForm ? (
        <View style={s.formCard}>
          <Text style={s.cardTitle}>Novo profissional</Text>
          <SectionTitle>Área</SectionTitle>
          <View style={s.chipRow}>
            {TIPOS.map((t) => <Chip key={t} label={ROTULO_PROFISSIONAL[t]} selected={tipo === t} color={COR} onPress={() => setTipo(t)} />)}
          </View>
          <SectionTitle>Dados</SectionTitle>
          <TextInput style={[s.input, { marginBottom: 8 }]} value={nome} onChangeText={setNome} placeholder="Nome completo *" placeholderTextColor="#94A3B8" />
          <TextInput style={[s.input, { marginBottom: 8 }]} value={email} onChangeText={setEmail} placeholder="E-mail *" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={[s.input, { marginBottom: 8 }]} value={cpf} onChangeText={(t) => setCpf(mascaraCpf(t))} placeholder="CPF *" placeholderTextColor="#94A3B8" keyboardType="numeric" />
          <TextInput style={[s.input, { marginBottom: 8 }]} value={registro} onChangeText={setRegistro} placeholder="Registro (CRP, CRMV, CRM...) *" placeholderTextColor="#94A3B8" />
          <TextInput style={s.input} value={fone} onChangeText={(t) => setFone(mascaraTelefone(t))} placeholder="Telefone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
          <Text style={[s.helpText, { marginTop: 8 }]}>
            O profissional passa pela análise da prefeitura antes de atender. Para entrar no app com a própria conta, ele se cadastra como "Profissional" usando este mesmo e-mail.
          </Text>
          <PrimaryButton title="Cadastrar" color={COR} onPress={cadastrar} loading={salvando} />
          <TouchableOpacity style={s.secondaryButton} onPress={() => setMostrarForm(false)}>
            <Text style={s.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <PrimaryButton title="Adicionar profissional" color={COR} onPress={() => setMostrarForm(true)} style={{ marginTop: 0 }} />
      )}

      <SectionTitle>Profissionais ativos</SectionTitle>
      {carregando ? <Loading /> : equipe.length === 0 ? (
        <EmptyState icon="people-outline" text="Nenhum profissional cadastrado ainda." />
      ) : equipe.map((p) => {
        const aprovado = (p.status_cadastro ?? "aprovado") === "aprovado";
        return (
          <View key={p.codigo} style={s.card}>
            <View style={s.row}>
              <Text style={[s.cardTitle, { flex: 1 }]}>{p.nome}</Text>
              {p.status_cadastro === "pendente" ? <Badge label="Em análise" color="#FF9500" /> : null}
              {p.status_cadastro === "reprovado" ? <Badge label="Reprovado" color="#DC2626" /> : null}
              {aprovado && p.telemedicina ? <Badge label="Online" color="#0F9D78" /> : null}
            </View>
            <Text style={s.cardText}>
              {[ROTULO_PROFISSIONAL[p.tipo], p.registro_profissional, p.email].filter(Boolean).join(" · ")}
            </Text>
            {p.status_cadastro === "reprovado" && p.motivo_reprovacao ? (
              <Text style={[s.cardText, { color: "#DC2626" }]}>Motivo: {p.motivo_reprovacao}</Text>
            ) : null}
            <View style={[s.chipRow, { marginTop: 10 }]}>
              {aprovado ? (
                <>
                  <Chip label="Horários" icon="time-outline" selected={false} color={COR} onPress={() => navigation.navigate("Availability", { clinic, professionalId: p.codigo })} />
                  <Chip label="Agenda" icon="calendar-outline" selected={false} color={COR} onPress={() => navigation.navigate("ProviderAgenda", { clinic, professional: p })} />
                </>
              ) : null}
              <Chip label="Desativar" icon="person-remove-outline" selected={false} color={COR} onPress={() => desativar(p)} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
