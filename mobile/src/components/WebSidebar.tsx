import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { authLogout } from "../api/client";
import { useClinic } from "../contexts/ClinicContexts";
import { Sessao } from "../session/sessionStore";
import { itemAtivo, ItemMenu, Menu } from "../navigation/webMenu";
import { fontSize, fontWeight, spacing } from "../styles/theme";

// Medidas e tons do menu do painel da Sellentt (Inspinia: 220px aberto,
// 70px recolhido; texto #ccc, ativo em branco com borda à esquerda). O
// degradê segue a variante azul do white-label, com o azul do app.
export const LARGURA_MENU = 220;
export const LARGURA_MENU_RECOLHIDO = 70;
const DEGRADE = ["#0056CC", "#003A8C"] as const;
const TEXTO = "rgba(255,255,255,0.78)";
const TEXTO_ATIVO = "#FFFFFF";
const FUNDO_ATIVO = "rgba(0,0,0,0.22)";
const FUNDO_HOVER = "rgba(0,0,0,0.12)";

const PAPEL: Record<NonNullable<Sessao>["role"], string> = {
  paciente: "Paciente",
  clinica: "Clínica",
  profissional: "Profissional",
  prefeitura: "Prefeitura",
};

type Props = {
  menu: Menu;
  sessao: NonNullable<Sessao>;
  navigation: any;
  rotaAtual?: string;
  recolhido: boolean;
};

function Item({ item, ativo, recolhido, nivel, onPress }: { item: ItemMenu; ativo: boolean; recolhido: boolean; nivel: 1 | 2; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: ativo }}
      style={({ hovered }: any) => [
        styles.item,
        nivel === 2 && !recolhido && styles.itemNivel2,
        recolhido && styles.itemRecolhido,
        hovered && !ativo && { backgroundColor: FUNDO_HOVER },
        ativo && styles.itemAtivo,
      ]}
    >
      <Ionicons name={item.icon} size={recolhido ? 22 : 18} color={ativo ? TEXTO_ATIVO : TEXTO} />
      {!recolhido ? (
        <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo]} numberOfLines={1}>{item.label}</Text>
      ) : null}
    </Pressable>
  );
}

export default function WebSidebar({ menu, sessao, navigation, rotaAtual, recolhido }: Props) {
  const { clearSession } = useClinic();
  const [fechados, setFechados] = useState<Record<string, boolean>>({});

  // Navegação plana, como as rotas do painel: a pilha fica sempre
  // [início] ou [início, item], sem acumular histórico a cada clique.
  function abrir(item: ItemMenu) {
    const inicio = { name: menu.inicio.rota, params: menu.inicio.params };
    if (item.rota === menu.inicio.rota) {
      navigation.reset({ index: 0, routes: [inicio] });
    } else {
      navigation.reset({ index: 1, routes: [inicio, { name: item.rota, params: item.params }] });
    }
  }

  async function sair() {
    await authLogout();
    clearSession();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  const nome: string = sessao.user?.nome ?? "";
  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  return (
    <LinearGradient colors={DEGRADE} style={[styles.sidebar, { width: recolhido ? LARGURA_MENU_RECOLHIDO : LARGURA_MENU }]}>
      {/* Cabeçalho: marca + usuário (no recolhido, só o símbolo) */}
      <View style={[styles.header, recolhido && styles.headerRecolhido]}>
        <View style={styles.marca}>
          <Ionicons name="medical" size={recolhido ? 26 : 22} color={TEXTO_ATIVO} />
          {!recolhido ? <Text style={styles.marcaTexto} numberOfLines={2}>Gerenciamento de Clínicas</Text> : null}
        </View>
        {!recolhido ? (
          <View style={styles.usuario}>
            <View style={styles.avatar}><Text style={styles.avatarTexto}>{iniciais || "?"}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usuarioNome} numberOfLines={1}>{nome}</Text>
              <Text style={styles.usuarioEmail} numberOfLines={1}>{sessao.user?.email}</Text>
              <Text style={styles.papel}>{PAPEL[sessao.role]}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.sm }}>
        <Item item={menu.inicio} ativo={itemAtivo(menu.inicio, rotaAtual)} recolhido={recolhido} nivel={1} onPress={() => abrir(menu.inicio)} />

        {menu.grupos.map((grupo) => {
          const aberto = recolhido || !fechados[grupo.titulo];
          return (
            <View key={grupo.titulo}>
              {!recolhido ? (
                <Pressable
                  onPress={() => setFechados((f) => ({ ...f, [grupo.titulo]: !f[grupo.titulo] }))}
                  style={({ hovered }: any) => [styles.grupo, hovered && { backgroundColor: FUNDO_HOVER }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: aberto }}
                >
                  <Ionicons name={grupo.icon} size={18} color={TEXTO} />
                  <Text style={styles.grupoTexto}>{grupo.titulo}</Text>
                  <Ionicons name={aberto ? "chevron-down" : "chevron-back"} size={14} color={TEXTO} />
                </Pressable>
              ) : (
                <View style={styles.divisor} />
              )}
              {aberto
                ? grupo.itens.map((item) => (
                    <Item
                      key={item.rota}
                      item={item}
                      ativo={itemAtivo(item, rotaAtual)}
                      recolhido={recolhido}
                      nivel={2}
                      onPress={() => abrir(item)}
                    />
                  ))
                : null}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={sair}
        accessibilityRole="button"
        accessibilityLabel="Sair"
        style={({ hovered }: any) => [styles.item, styles.sair, recolhido && styles.itemRecolhido, hovered && { backgroundColor: FUNDO_HOVER }]}
      >
        <Ionicons name="log-out-outline" size={recolhido ? 22 : 18} color={TEXTO} />
        {!recolhido ? <Text style={styles.itemTexto}>Sair</Text> : null}
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sidebar: { height: "100%" },
  header: { paddingHorizontal: spacing.lg - 4, paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  headerRecolhido: { paddingHorizontal: 0, alignItems: "center" },
  marca: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  marcaTexto: { flex: 1, color: TEXTO_ATIVO, fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: 18 },
  usuario: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  avatarTexto: { color: TEXTO_ATIVO, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  usuarioNome: { color: TEXTO_ATIVO, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  usuarioEmail: { color: TEXTO, fontSize: 11.5 },
  papel: { color: TEXTO, fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },

  grupo: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingHorizontal: spacing.lg - 4, paddingVertical: 12, marginTop: spacing.xs },
  grupoTexto: { flex: 1, color: TEXTO, fontSize: 13, fontWeight: fontWeight.semibold },
  divisor: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: spacing.sm, marginHorizontal: spacing.md },

  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg - 4,
    paddingVertical: 11,
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
  },
  itemNivel2: { paddingLeft: spacing.lg + 8 },
  itemRecolhido: { justifyContent: "center", paddingHorizontal: 0, paddingVertical: 14 },
  itemAtivo: { backgroundColor: FUNDO_ATIVO, borderLeftColor: TEXTO_ATIVO },
  itemTexto: { flex: 1, color: TEXTO, fontSize: 13 },
  itemTextoAtivo: { color: TEXTO_ATIVO, fontWeight: fontWeight.semibold },
  sair: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", paddingVertical: 14 },
});
