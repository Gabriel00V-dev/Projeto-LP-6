import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { restoreSession } from "../api/client";
import { useClinic } from "../contexts/ClinicContexts";
import { entrarNaSessao } from "../navigation/session";
import { colors, fontSize, fontWeight, spacing } from "../styles/theme";

type Props = { navigation: any };

/**
 * Primeira tela ao abrir o app (ou recarregar a página): com sessão salva,
 * vai direto para o menu do usuário; sem sessão, para o login.
 */
export default function SplashScreen({ navigation }: Props) {
  const { loadClinicSession } = useClinic();

  useEffect(() => {
    let ativo = true;

    (async () => {
      const sessao = await restoreSession();
      if (!ativo) return;

      if (sessao?.user) {
        try {
          await entrarNaSessao(navigation, sessao.role, sessao.user, loadClinicSession);
          return;
        } catch (error) {
          console.warn("Não foi possível retomar a sessão.", error);
        }
      }
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    })();

    return () => {
      ativo = false;
    };
  }, [navigation, loadClinicSession]);

  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.container}>
      <Ionicons name="medical-outline" size={56} color={colors.onPrimary} />
      <Text style={styles.title}>Gerenciamento de Clínicas</Text>
      <ActivityIndicator color={colors.onPrimary} style={{ marginTop: spacing.lg }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onPrimary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginTop: spacing.md },
});
