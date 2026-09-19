import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ModernInput from "../components/ModernInput";
import ModernButton from "../components/ModernButton";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/theme";
import { updatePatient } from "../api/client";
import { getErrorMessage } from "../utils/errorMessage";
import {
  formatDateInput,
  convertDateToISO,
  validateDateFormat,
  convertISOToDate,
} from "../utils/dateUtils";

type Props = {
  navigation: any;
  route: any;
};

export default function PatientEditScreen({ navigation, route }: Props) {
  const { patient } = route.params;
  
  const [nome, setNome] = useState(patient?.nome || "");
  const [datan, setDatan] = useState(patient?.datan ? convertISOToDate(patient.datan) : "");
  const [fone, setFone] = useState(patient?.fone || "");
  const [ende, setEnde] = useState(patient?.ende || "");
  const [email, setEmail] = useState(patient?.email || "");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (!nome || !email) {
      Alert.alert(
        "Campos Obrigatórios",
        "Nome e email são necessários."
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
      setLoading(true);
      const datanISO = datan ? convertDateToISO(datan) : undefined;
      
      const payload: any = { 
        nome, 
        datan: datanISO, 
        fone, 
        ende, 
        email 
      };
      
      // Só inclui senha se foi preenchida
      if (senha && senha.trim().length > 0) {
        payload.senha = senha;
      }
      
      const updatedPatient = await updatePatient(patient.codigo, payload);
      
      Alert.alert("Sucesso!", "Seus dados foram atualizados com sucesso.", [
        { 
          text: "OK", 
          onPress: () => navigation.navigate("PatientMenu", { patient: updatedPatient }) 
        },
      ]);
    } catch (err: any) {
      console.error("Update Error:", err);
      const errorMessage = getErrorMessage(
        err,
        "Não foi possível atualizar os dados. Tente novamente."
      );
      Alert.alert("Erro na Atualização", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons
              name="person-outline"
              size={60}
              color={colors.primary}
              style={styles.icon}
            />
            <Text style={styles.title}>Editar Perfil</Text>
            <Text style={styles.subtitle}>
              Atualize suas informações pessoais
            </Text>
          </View>

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
              label="Nova Senha (deixe em branco para manter a atual)"
              value={senha}
              onChangeText={setSenha}
              placeholder="Digite uma nova senha (opcional)"
              secureTextEntry
              icon="lock-closed-outline"
            />

            <ModernButton
              title={loading ? "Salvando..." : "Salvar Alterações"}
              onPress={handleUpdate}
              variant="primary"
              size="large"
              fullWidth
              disabled={loading}
              style={styles.updateButton}
            />

            <ModernButton
              title="Cancelar"
              onPress={() => navigation.goBack()}
              variant="outline"
              size="large"
              fullWidth
              style={styles.cancelButton}
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
  contentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  icon: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  formContainer: {
    marginTop: spacing.md,
  },
  updateButton: {
    marginTop: spacing.lg,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});
