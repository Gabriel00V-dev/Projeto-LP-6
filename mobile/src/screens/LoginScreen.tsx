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
import { authLogin } from "../api/client";
import { useClinic } from "../contexts/ClinicContexts"; 

type Props = {
  navigation: any;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"paciente" | "clinica">("paciente");
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

      if (role === "paciente") {
        navigation.replace("PatientMenu", { patient: resp.user });
      } else {
        // Carrega add-ons no contexto global — uma única chamada à API,
        // depois hasAddon() funciona em qualquer tela sem novo request.
        const token = resp.session?.access_token ?? resp.token ?? "";
        await loadClinicSession(resp.user, token);
        navigation.replace("ClinicMenu", { clinic: resp.user });
      }
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <Ionicons name="log-in-outline" size={48} color={colors.onPrimary} />
        <Text style={styles.title}>Bem-vindo!</Text>
        <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>
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
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "paciente" && styles.roleButtonActive,
                ]}
                onPress={() => setRole("paciente")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === "paciente" && styles.roleButtonTextActive,
                  ]}
                >
                  👤 Sou Paciente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "clinica" && styles.roleButtonActive,
                ]}
                onPress={() => setRole("clinica")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === "clinica" && styles.roleButtonTextActive,
                  ]}
                >
                  🏥 Sou Clínica
                </Text>
              </TouchableOpacity>
            </View>

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
                  {role === "clinica" ? "Carregando seu perfil..." : "Entrando..."}
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
          </View>

          <View style={styles.guestActions}>
            <ModernButton
              title="Ver Clínicas Disponíveis"
              onPress={() => navigation.navigate("ClinicList")}
              variant="ghost"
              size="medium"
              fullWidth
              disabled={loading}
            />
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
  header: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
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
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
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
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
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