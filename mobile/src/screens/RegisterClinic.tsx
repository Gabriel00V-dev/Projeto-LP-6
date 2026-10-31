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
import CircularImage from "../components/CircularImage";
import { useImagePicker } from "../hooks/useImagePicker";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/theme";
import { authRegister, uploadImage } from "../api/client";
import { getErrorMessage } from "../utils/errorMessage";
import { avisar } from "../utils/dialog";
import { cnpjValido, emailValido, mascaraCnpj, mascaraTelefone, somenteDigitos } from "../utils/documentos";
import { useClinic } from "../contexts/ClinicContexts";
import { entrarNaSessao } from "../navigation/session";
import { ClinicType } from "../types";

type Props = {
  navigation: any;
};

const TIPOS: { value: ClinicType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "clinica", label: "Clínica", icon: "business-outline" },
  { value: "veterinaria", label: "Veterinária", icon: "paw-outline" },
  { value: "psicologia", label: "Psicologia", icon: "heart-outline" },
  { value: "upa", label: "UPA / SUS", icon: "medkit-outline" },
];

export default function RegisterClinic({ navigation }: Props) {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [fone, setFone] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [registroResponsavel, setRegistroResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [atendeUnimed, setAtendeUnimed] = useState(false);
  const [tipo, setTipo] = useState<ClinicType>("clinica");
  const [loading, setLoading] = useState(false);

  const { image, showImageOptions, setUploading } = useImagePicker();
  const { loadClinicSession } = useClinic();

  function validar(): string | null {
    if (!nome.trim() || !endereco.trim() || !fone.trim() || !email.trim() || !senha) {
      return "Preencha todos os campos marcados com *.";
    }
    if (!cnpjValido(cnpj)) return "CNPJ inválido. Confira os números.";
    if (somenteDigitos(fone).length < 10) return "Telefone incompleto. Inclua o DDD.";
    if (!responsavel.trim() || !registroResponsavel.trim()) {
      return "Informe o responsável técnico e o registro profissional dele (CRM, CRMV, CRP...).";
    }
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
      let imageUrl = "";
      if (image.uri) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(image.uri);
        } catch (uploadError) {
          console.warn("Image upload failed, proceeding without it.", uploadError);
        } finally {
          setUploading(false);
        }
      }

      const payload = {
        nome: nome.trim(),
        cnpj: somenteDigitos(cnpj),
        endereco: endereco.trim(),
        fone,
        responsavel_tecnico: responsavel.trim(),
        registro_responsavel: registroResponsavel.trim(),
        email: email.trim(),
        senha,
        imagem: imageUrl || null,
        atende_unimed: atendeUnimed,
        tipo,
      };
      const resp = await authRegister("clinica", payload);

      // Com sessão (confirmação de e-mail desligada no Supabase), já entra e
      // vê a tela de acompanhamento da análise; sem, volta para o login.
      if (resp?.session?.access_token) {
        await entrarNaSessao(navigation, "clinica", resp.user, loadClinicSession);
      } else {
        avisar(
          "Cadastro enviado",
          "Seu cadastro foi enviado para análise da prefeitura. Entre com seu e-mail e senha para acompanhar."
        );
        navigation.goBack();
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err, "Não foi possível cadastrar a clínica.");
      avisar("Erro no Cadastro", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.headerGradient}
      >
        <Ionicons name="business-outline" size={50} color={colors.onPrimary} />
        <Text style={styles.headerTitle}>Cadastre sua Clínica</Text>
        <Text style={styles.headerSubtitle}>
          Preencha os dados para começar
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <View style={styles.imageContainer}>
              <CircularImage
                uri={image.uri}
                size={100}
                onPress={showImageOptions}
                showEditButton={true}
                loading={image.isUploading}
              />
            </View>

            <View style={styles.notice}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={styles.noticeText}>
                O cadastro passa pela análise da prefeitura. Depois de aprovado, o estabelecimento aparece para os pacientes.
              </Text>
            </View>

            <Text style={styles.typeLabel}>Tipo de estabelecimento *</Text>
            <View style={styles.typeRow}>
              {TIPOS.map((opcao) => {
                const ativo = tipo === opcao.value;
                return (
                  <TouchableOpacity
                    key={opcao.value}
                    style={[styles.typeChip, ativo && styles.typeChipActive]}
                    onPress={() => setTipo(opcao.value)}
                  >
                    <Ionicons name={opcao.icon} size={16} color={ativo ? colors.onPrimary : colors.primary} />
                    <Text style={[styles.typeChipText, ativo && styles.typeChipTextActive]}>{opcao.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Estabelecimento</Text>

            <ModernInput
              label="Nome do estabelecimento *"
              value={nome}
              onChangeText={setNome}
              placeholder="Como aparecerá para os pacientes"
              icon="business-outline"
            />

            <ModernInput
              label="CNPJ *"
              value={cnpj}
              onChangeText={(t) => setCnpj(mascaraCnpj(t))}
              placeholder="00.000.000/0000-00"
              keyboardType="numeric"
              icon="document-text-outline"
            />

            <ModernInput
              label="Endereço *"
              value={endereco}
              onChangeText={setEndereco}
              placeholder="Rua, número, bairro"
              icon="location-outline"
            />

            <ModernInput
              label="Telefone *"
              value={fone}
              onChangeText={(t) => setFone(mascaraTelefone(t))}
              placeholder="(XX) XXXXX-XXXX"
              keyboardType="phone-pad"
              icon="call-outline"
            />

            <Text style={styles.sectionLabel}>Responsável técnico</Text>

            <ModernInput
              label="Nome do responsável técnico *"
              value={responsavel}
              onChangeText={setResponsavel}
              placeholder="Profissional responsável pelo estabelecimento"
              icon="person-outline"
            />

            <ModernInput
              label="Registro profissional do responsável *"
              value={registroResponsavel}
              onChangeText={setRegistroResponsavel}
              placeholder="Ex.: CRM-SP 123456, CRMV, CRP"
              icon="ribbon-outline"
            />

            <Text style={styles.sectionLabel}>Acesso</Text>

            <ModernInput
              label="Email *"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <TouchableOpacity
              style={styles.toggleCard}
              onPress={() => setAtendeUnimed((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={styles.toggleLeft}>
                <Ionicons
                  name={atendeUnimed ? "checkbox" : "square-outline"}
                  size={22}
                  color={atendeUnimed ? colors.success : colors.textSecondary}
                />
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Atende Unimed</Text>
                  <Text style={styles.toggleSubtitle}>
                    Marque se a clínica aceita convênio Unimed
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <ModernInput
              label="Senha *"
              value={senha}
              onChangeText={setSenha}
              placeholder="Mínimo de 6 caracteres"
              secureTextEntry
              icon="lock-closed-outline"
            />

            <ModernInput
              label="Confirmar senha *"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              placeholder="Repita a senha"
              secureTextEntry
              icon="lock-closed-outline"
              error={confirmarSenha && confirmarSenha !== senha ? "As senhas não conferem" : undefined}
            />

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  headerSubtitle: {
    fontSize: fontSize.md,
    color: colors.onPrimary,
    textAlign: "center",
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  contentContainer: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: -spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  registerButton: {
    marginTop: spacing.md,
  },
  typeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primary + "10",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
  },
  typeChipText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  typeChipTextActive: {
    color: colors.onPrimary,
  },
  toggleCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  toggleTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  toggleSubtitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  linkText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
});