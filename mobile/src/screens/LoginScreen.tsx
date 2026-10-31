import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModernInput from "../components/ModernInput";
import ModernButton from "../components/ModernButton";
import { getErrorMessage } from "../utils/errorMessage";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/theme";
import { authLogin, SessionRole } from "../api/client";
import { useClinic } from "../contexts/ClinicContexts";
import { entrarNaSessao } from "../navigation/session";

type Props = {
  navigation: any;
};

const PERFIS: { role: SessionRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: "paciente", label: "Sou Paciente", icon: "person-outline" },
  { role: "clinica", label: "Sou Clínica", icon: "business-outline" },
  { role: "profissional", label: "Sou Profissional", icon: "medkit-outline" },
];

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<SessionRole>("paciente");
  const [loading, setLoading] = useState(false);

  const { loadClinicSession } = useClinic();

  async function handleLogin() {
    if (!email || !senha) {
      Alert.alert("Erro de Validação", "Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);

    try {
      const resp = await authLogin(email, senha, role);

      if (!resp?.user) {
        Alert.alert("Erro de Login", "Credenciais inválidas. Tente novamente.");
        return;
      }

      // Leva cada perfil à sua tela inicial. Clínica e profissional aprovados
      // carregam os add-ons no contexto global (uma única chamada à API);
      // cadastro ainda em análise vai para a tela de acompanhamento.
      await entrarNaSessao(navigation, role, resp.user, loadClinicSession);
    } catch (err: any) {
      console.error("Login Error:", err);
      const errorMessage = getErrorMessage(
        err,
        "Não foi possível fazer o login. Verifique sua conexão e credenciais."
      );
      Alert.alert("Erro", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        Platform.OS === "web" && styles.webContainer,
      ]}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={[styles.header, Platform.OS === "web" && styles.webHeader]}
      >
        <Ionicons name="log-in-outline" size={48} color={colors.onPrimary} />
        <Text style={styles.title}>Bem-vindo!</Text>
        <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={[styles.keyboardContainer, Platform.OS === "web" && styles.webKeyboardContainer]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS === "web" && styles.webContentContainer,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {role === "prefeitura" ? (
              <View style={styles.prefeituraBanner}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
                <Text style={styles.prefeituraText}>Acesso restrito da prefeitura</Text>
                <TouchableOpacity onPress={() => setRole("paciente")} disabled={loading}>
                  <Text style={styles.linkText}>Voltar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.roleSelector}>
                {PERFIS.map((perfil) => {
                  const ativo = role === perfil.role;
                  return (
                    <TouchableOpacity
                      key={perfil.role}
                      style={[styles.roleButton, ativo && styles.roleButtonActive]}
                      onPress={() => setRole(perfil.role)}
                    >
                      <Ionicons name={perfil.icon} size={20} color={ativo ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.roleButtonText, ativo && styles.roleButtonTextActive]}>
                        {perfil.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <ModernInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="seuemail@exemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              icon="mail-outline"
              editable={!loading}
            />

            <ModernInput
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              placeholder="Sua senha"
              secureTextEntry
              icon="lock-closed-outline"
              editable={!loading}
            />

            {loading ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={styles.loadingText}>
                  {role === "paciente" ? "Entrando..." : "Carregando seu perfil..."}
                </Text>
              </View>
            ) : (
              <ModernButton
                title="Entrar"
                onPress={handleLogin}
                variant="primary"
                size="large"
                fullWidth
                style={styles.loginButton}
              />
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("RegisterPatient")}
              disabled={loading}
            >
              <Text style={styles.linkText}>Cadastre-se como Paciente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("RegisterClinic")}
              disabled={loading}
            >
              <Text style={styles.linkText}>Cadastre-se como Clínica</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("RegisterProfessional")}
              disabled={loading}
            >
              <Text style={styles.linkText}>Cadastre-se como Profissional</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.guestActions}>
            <ModernButton
              title="Ver serviços de atendimento"
              onPress={() => navigation.navigate("ServicesHome")}
              variant="primary"
              size="medium"
              fullWidth
              disabled={loading}
            />
            <ModernButton
              title="Ver Clínicas Disponíveis"
              onPress={() => navigation.navigate("ClinicList")}
              variant="ghost"
              size="medium"
              fullWidth
              disabled={loading}
            />
            {role !== "prefeitura" && (
              <TouchableOpacity
                style={styles.prefeituraLink}
                onPress={() => setRole("prefeitura")}
                disabled={loading}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.prefeituraLinkText}>Acesso da prefeitura</Text>
              </TouchableOpacity>
            )}
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
  webContainer: {
    flexDirection: "row",
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  webKeyboardContainer: {
    flex: 1.1,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  webHeader: {
    flex: 0.9,
    minHeight: "100%",
    borderRadius: 0,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.onPrimary,
    textAlign: "center",
    opacity: 0.9,
    marginTop: spacing.xs,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  webContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...(Platform.OS === "web"
      ? {
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
        }
      : {}),
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  roleSelector: {
    flexDirection: "row",
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    padding: spacing.xs,
  },
  roleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  prefeituraBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary + "10",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  prefeituraText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  prefeituraLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  prefeituraLinkText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  roleButtonActive: {
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  roleButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: "center",
  },
  roleButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  loginButton: {
    marginTop: spacing.md,
  },
  loadingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minHeight: 56,
    marginTop: spacing.md,
    opacity: 0.85,
  },
  loadingText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  footer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  footerText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    paddingVertical: spacing.xs,
  },
  guestActions: {
    paddingTop: spacing.lg,
  },
});