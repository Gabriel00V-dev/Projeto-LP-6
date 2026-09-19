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
import { authRegister } from "../api/client";
import {
  formatDateInput,
  convertDateToISO,
  validateDateFormat,
} from "../utils/dateUtils";

type Props = {
  navigation: any;
};

export default function RegisterPatient({ navigation }: Props) {
  const [nome, setNome] = useState("");
  const [datan, setDatan] = useState("");
  const [fone, setFone] = useState("");
  const [ende, setEnde] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleRegister() {
    if (!nome || !email || !senha) {
      Alert.alert(
        "Campos Obrigatórios",
        "Nome, email e senha são necessários para o cadastro."
      );
      return;
    }

    if (datan && datan.length > 0 && !validateDateFormat(datan)) {
      Alert.alert(
        "Data Inválida",
        "O formato da data de nascimento deve ser DD/MM/AAAA."
      );
      return;
    }

    try {
      const datanISO = datan ? convertDateToISO(datan) : undefined;
      const payload = { nome, datan: datanISO, fone, ende, email, senha };
      await authRegister("paciente", payload);
      Alert.alert("Cadastro Realizado!", "Seu cadastro foi efetuado com sucesso.", [
        { text: "Ir para Login", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      console.error("Registration Error:", err);
      const errorMessage = getErrorMessage(
        err,
        "Não foi possível realizar o cadastro. Tente novamente."
      );
      Alert.alert("Erro no Cadastro", errorMessage);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.headerGradient}
      >
        <Ionicons name="person-add-outline" size={50} color={colors.onPrimary} />
        <Text style={styles.headerTitle}>Crie sua Conta</Text>
        <Text style={styles.headerSubtitle}>
          Preencha seus dados para se cadastrar
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
            <ModernInput
              label="Nome Completo *"
              value={nome}
              onChangeText={setNome}
              placeholder="Digite seu nome completo"
              icon="person-outline"
            />

            <ModernInput
              label="Data de Nascimento"
              value={datan}
              onChangeText={(text) => setDatan(formatDateInput(text))}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
              icon="calendar-outline"
            />

            <ModernInput
              label="Telefone"
              value={fone}
              onChangeText={setFone}
              placeholder="(XX) XXXXX-XXXX"
              keyboardType="phone-pad"
              icon="call-outline"
            />

            <ModernInput
              label="Endereço"
              value={ende}
              onChangeText={setEnde}
              placeholder="Sua rua, número, bairro..."
              icon="location-outline"
            />

            <ModernInput
              label="Email *"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <ModernInput
              label="Senha *"
              value={senha}
              onChangeText={setSenha}
              placeholder="Crie uma senha segura"
              secureTextEntry
              icon="lock-closed-outline"
            />

            <ModernButton
              title="Finalizar Cadastro"
              onPress={handleRegister}
              variant="primary"
              size="large"
              fullWidth
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
  registerButton: {
    marginTop: spacing.md,
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