import { Linking } from "react-native";
import { joinRoom } from "../api/client";
import { getErrorMessage } from "./errorMessage";
import { avisar } from "./dialog";

/**
 * Pede a entrada na sala ao backend (que valida vínculo, assinatura e
 * horário) e abre o link do Jitsi. Fora da janela, o backend responde com a
 * mensagem de quando a sala abre, que é exibida ao usuário.
 */
export async function entrarNaTeleconsulta(codigoConsulta: number): Promise<boolean> {
  try {
    const { meetingUrl } = await joinRoom(codigoConsulta);
    await Linking.openURL(meetingUrl);
    return true;
  } catch (err) {
    avisar("Teleconsulta", getErrorMessage(err, "Não foi possível entrar na sala."));
    return false;
  }
}
