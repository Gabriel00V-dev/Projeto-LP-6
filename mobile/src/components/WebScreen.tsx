import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import WebSidebar from "./WebSidebar";
import { useSession } from "../session/sessionStore";
import { itemAtivo, menuDaSessao } from "../navigation/webMenu";

type Props = {
  children: React.ReactNode;
  navigation: any;
  routeName?: string;
};

// A partir desta largura a web usa o layout de painel, com menu lateral.
const LARGURA_PAINEL = 1024;

// Telas fora da área logada (ou ainda sem acesso liberado) não têm menu.
const ROTAS_SEM_MENU = ["Splash", "Login", "RegisterPatient", "RegisterClinic", "RegisterProfessional", "AwaitingApproval"];

const CHAVE_RECOLHIDO = "@clinica:menu-recolhido";

// Preferência de menu recolhido: lida de forma síncrona do localStorage (só
// existe na web) para a tela nova não piscar com o menu aberto.
function lerRecolhido(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_RECOLHIDO) === "1";
  } catch {
    return false;
  }
}

function salvarRecolhido(valor: boolean) {
  try {
    window.localStorage.setItem(CHAVE_RECOLHIDO, valor ? "1" : "0");
  } catch {
    // Sem armazenamento (aba anônima etc.): só não lembra a preferência.
  }
}

export default function WebScreen({ children, navigation, routeName }: Props) {
  const sessao = useSession();
  const { width } = useWindowDimensions();
  const [recolhido, setRecolhido] = useState(lerRecolhido);

  const menu = menuDaSessao(sessao);
  const cadastroLiberado = !sessao?.user?.status_cadastro || sessao.user.status_cadastro === "aprovado";
  const comMenu =
    Platform.OS === "web" &&
    width >= LARGURA_PAINEL &&
    !!menu &&
    !!sessao &&
    cadastroLiberado &&
    !ROTAS_SEM_MENU.includes(routeName ?? "");

  const podeVoltar = navigation?.canGoBack?.();

  if (comMenu && menu && sessao) {
    const itens = [menu.inicio, ...menu.grupos.flatMap((g) => g.itens)];
    const titulo = itens.find((item) => itemAtivo(item, routeName))?.label ?? "";

    const alternarMenu = () => {
      setRecolhido((atual) => {
        salvarRecolhido(!atual);
        return !atual;
      });
    };

    return (
      <View style={styles.painel}>
        <WebSidebar menu={menu} sessao={sessao} navigation={navigation} rotaAtual={routeName} recolhido={recolhido} />
        <View style={styles.area}>
          <View style={styles.topbar}>
            <Pressable
              onPress={alternarMenu}
              accessibilityRole="button"
              accessibilityLabel={recolhido ? "Expandir menu" : "Recolher menu"}
              style={({ hovered }: any) => [styles.iconButton, hovered && styles.iconButtonHover]}
            >
              <Ionicons name="menu" size={22} color="#1C1C1E" />
            </Pressable>
            {podeVoltar && routeName !== menu.inicio.rota ? (
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                style={({ hovered }: any) => [styles.backButton, styles.backButtonTopbar, hovered && styles.iconButtonHover]}
              >
                <Ionicons name="arrow-back" size={18} color="#1C1C1E" />
                <Text style={styles.backText}>Voltar</Text>
              </Pressable>
            ) : null}
            {titulo ? <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text> : null}
          </View>
          <View style={styles.conteudo}>{children}</View>
        </View>
      </View>
    );
  }

  const showBackButton =
    Platform.OS === "web" &&
    routeName !== "Login" &&
    podeVoltar;

  return (
    <View style={styles.viewport}>
      <View style={[styles.content, showBackButton && styles.contentWithToolbar]}>
        {children}
      </View>
      {showBackButton && (
        <View style={styles.toolbar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#1C1C1E" />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Layout de painel (web larga + sessão)
  painel: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F6FA",
  },
  area: {
    flex: 1,
    minWidth: 0,
  },
  topbar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF0",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonHover: {
    backgroundColor: "#F1F3F4",
  },
  titulo: {
    flex: 1,
    marginLeft: 8,
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  conteudo: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  // Layout original (celular, web estreita, telas sem login)
  viewport: {
    flex: 1,
    backgroundColor: "#F3F6FA",
  },
  content: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    ...(Platform.OS === "web"
      ? {
          maxWidth: 1440,
          backgroundColor: "#F8F9FA",
        }
      : {}),
  },
  contentWithToolbar: {
    paddingTop: 56,
  },
  toolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 20,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF0",
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
  },
  backButtonTopbar: {
    alignSelf: "center",
  },
  backText: {
    color: "#1C1C1E",
    fontSize: 15,
    fontWeight: "600",
  },
});
