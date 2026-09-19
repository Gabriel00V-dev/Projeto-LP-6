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

type Props = {
  navigation: any;
};

export default function RegisterClinic({ navigation }: Props) {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [fone, setFone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [atendeUnimed, setAtendeUnimed] = useState(false);
  const [loading, setLoading] = useState(false);

  const { image, showImageOptions, setUploading } = useImagePicker();

  async function handleRegister() {
    if (!nome || !email || !senha) {
      Alert.alert("Erro", "Nome, email e senha são obrigatórios");
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
        nome,
        endereco,
        fone,
        email,
        senha,
        imagem: imageUrl || null,
        atende_unimed: atendeUnimed,
      };
      await authRegister("clinica", payload);
      Alert.alert("Sucesso!", "Clínica cadastrada com sucesso.", [
        { text: "Ir para Login", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const errorMessage = getErrorMessage(err, "Não foi possível cadastrar a clínica.");
      Alert.alert("Erro no Cadastro", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
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

            <ModernInput
              label="Nome da Clínica *"
              value={nome}
              onChangeText={setNome}
              placeholder="Digite o nome da clínica"
              icon="business-outline"
            />

            <ModernInput
              label="Endereço"
              value={endereco}
              onChangeText={setEndereco}
              placeholder="Sua rua, número, bairro..."
              icon="location-outline"
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
              placeholder="Crie uma senha segura"
              secureTextEntry
              icon="lock-closed-outline"
            />

            <ModernButton
              title={loading ? "Cadastrando..." : "Finalizar Cadastro"}
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