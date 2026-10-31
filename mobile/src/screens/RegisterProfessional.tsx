import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModernInput from "../components/ModernInput";
import ModernButton from "../components/ModernButton";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/theme";
import { authRegister } from "../api/client";
import { ProfessionalType } from "../types";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar } from "../utils/dialog";
import { ROTULO_PROFISSIONAL } from "../utils/serviceFormat";
import { cpfValido, emailValido, mascaraCpf, mascaraTelefone, somenteDigitos } from "../utils/documentos";
import { useClinic } from "../contexts/ClinicContexts";
import { entrarNaSessao } from "../navigation/session";

type Props = {
  navigation: any;
};

const TIPOS: ProfessionalType[] = ["psicologo", "veterinario", "medico", "enfermeiro", "profissional_sus"];

const REGISTRO: Record<ProfessionalType, string> = {
  psicologo: "CRP",
  veterinario: "CRMV",
  medico: "CRM",
  enfermeiro: "COREN",
  profissional_sus: "Matrícula / registro",
};

/**
 * Cadastro de profissional independente (psicólogo, veterinário...). Quem
 * atende vinculado a uma clínica é cadastrado pela própria clínica.
 */
export default function RegisterProfessional({ navigation }: Props) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [fone, setFone] = useState("");
  const [tipo, setTipo] = useState<ProfessionalType>("psicologo");
  const [registro, setRegistro] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const { loadClinicSession } = useClinic();

  function validar(): string | null {
    if (!nome.trim() || !email.trim() || !senha || !fone.trim() || !registro.trim()) {
      return "Preencha todos os campos marcados com *.";
    }
    if (!cpfValido(cpf)) return "CPF inválido. Confira os números.";
    if (somenteDigitos(fone).length < 10) return "Telefone incompleto. Inclua o DDD.";
    if (!emailValido(email)) return "E-mail inválido.";
    if (senha.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
    if (senha !== confirmarSenha) return "As senhas não conferem.";
    return null;
  }

  async function handleRegister() {
    const erro = validar();
    if (erro) {
      avisar("Confira o cadastro", erro);
      return;
    }

    setLoading(true);
    try {
      const resp = await authRegister("profissional", {
        nome: nome.trim(),
        cpf: somenteDigitos(cpf),
        email: email.trim(),
        senha,
        fone,
        tipo,
        registro_profissional: registro.trim(),
        bio: bio.trim() || undefined,
      });

      // Com sessão, já mostra a tela de acompanhamento da análise.
      if (resp?.session?.access_token) {
        await entrarNaSessao(navigation, "profissional", resp.user, loadClinicSession);
      } else {
        avisar("Cadastro enviado", "Seu cadastro foi enviado para análise da prefeitura. Entre com seu e-mail e senha, escolhendo \"Sou Profissional\", para acompanhar.");
        navigation.goBack();
      }
    } catch (err: any) {
      avisar("Erro no Cadastro", getErrorMessage(err, "Não foi possível concluir o cadastro."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.headerGradient}>
        <Ionicons name="medkit-outline" size={50} color={colors.onPrimary} />
        <Text style={styles.headerTitle}>Cadastro de Profissional</Text>
        <Text style={styles.headerSubtitle}>Para quem atende de forma independente</Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            <Text style={styles.label}>Área de atuação *</Text>
            <View style={styles.chips}>
              {TIPOS.map((t) => (
                <TouchableOpacity key={t} onPress={() => setTipo(t)} style={[styles.chip, tipo === t && styles.chipActive]}>
                  <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{ROTULO_PROFISSIONAL[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ModernInput label="Nome completo *" value={nome} onChangeText={setNome} placeholder="Como aparecerá para os pacientes" icon="person-outline" />
            <ModernInput label="CPF *" value={cpf} onChangeText={(t) => setCpf(mascaraCpf(t))} placeholder="000.000.000-00" keyboardType="numeric" icon="card-outline" />
            <ModernInput label={`${REGISTRO[tipo]} *`} value={registro} onChangeText={setRegistro} placeholder="Número do registro profissional" icon="ribbon-outline" />
            <ModernInput label="Telefone *" value={fone} onChangeText={(t) => setFone(mascaraTelefone(t))} placeholder="(XX) XXXXX-XXXX" keyboardType="phone-pad" icon="call-outline" />
            <ModernInput label="Email *" value={email} onChangeText={setEmail} placeholder="seu@email.com" keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
            <ModernInput label="Apresentação" value={bio} onChangeText={setBio} placeholder="Abordagem, públicos que atende..." multiline icon="chatbox-outline" />
            <ModernInput label="Senha *" value={senha} onChangeText={setSenha} placeholder="Mínimo de 6 caracteres" secureTextEntry icon="lock-closed-outline" />
            <ModernInput
              label="Confirmar senha *"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              placeholder="Repita a senha"
              secureTextEntry
              icon="lock-closed-outline"
              error={confirmarSenha && confirmarSenha !== senha ? "As senhas não conferem" : undefined}
            />

            <Text style={styles.hint}>
              A prefeitura confere o CPF e o registro no conselho antes de liberar seu perfil para os pacientes.
              Trabalha em uma clínica cadastrada? Peça para a clínica incluir você na equipe — assim seus horários aparecem junto com os dela.
            </Text>

            <ModernButton
              title={loading ? "Enviando..." : "Enviar para análise"}
              onPress={handleRegister}
              variant="primary"
              size="large"
              fullWidth
              disabled={loading}
              style={styles.registerButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tem uma conta?</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.linkText}>Faça Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.onPrimary, textAlign: "center", marginTop: spacing.md },
  headerSubtitle: { fontSize: fontSize.md, color: colors.onPrimary, textAlign: "center", marginTop: spacing.xs, opacity: 0.9 },
  contentContainer: { flexGrow: 1, padding: spacing.lg },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: -spacing.xl,
    ...Platform.select({
      ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: borderRadius.round, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  chipTextActive: { color: colors.onPrimary },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.xs },
  registerButton: { marginTop: spacing.md },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.xl },
  footerText: { fontSize: fontSize.md, color: colors.textSecondary },
  linkText: { fontSize: fontSize.md, color: colors.primary, fontWeight: fontWeight.medium, marginLeft: spacing.xs },
});
