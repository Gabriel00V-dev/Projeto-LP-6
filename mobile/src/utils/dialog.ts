import { Alert, Platform } from "react-native";

/**
 * No react-native-web o Alert.alert não exibe nada, então as telas que
 * também rodam no navegador usam estes helpers, que caem para
 * window.alert / window.confirm na web.
 */
export function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

export function confirmar(titulo: string, mensagem: string, textoConfirmar = "Confirmar"): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  }

  return new Promise((resolve) => {
    Alert.alert(titulo, mensagem, [
      { text: "Voltar", style: "cancel", onPress: () => resolve(false) },
      { text: textoConfirmar, style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
