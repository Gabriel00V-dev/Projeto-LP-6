import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Slot } from "../types";
import { proximosDias } from "../utils/serviceFormat";
import { getErrorMessage } from "../utils/errorMessage";
import { fontWeight } from "../styles/theme";

type Props = {
  color: string;
  /** Busca os horários livres de um dia (YYYY-MM-DD). */
  loadSlots: (data: string) => Promise<Slot[]>;
  /** Mude este valor para recarregar (ex.: trocou o profissional ou a modalidade). */
  reloadKey: string;
  selected: Slot | null;
  onSelect: (slot: Slot | null) => void;
  /** Mostra o nome do profissional no slot (agenda de clínica com vários profissionais). */
  showProfessional?: boolean;
  days?: number;
};

export default function SlotPicker({ color, loadSlots, reloadKey, selected, onSelect, showProfessional, days = 14 }: Props) {
  const dias = useMemo(() => proximosDias(days), [days]);
  const [dia, setDia] = useState(dias[0].iso);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    onSelect(null);

    loadSlots(dia)
      .then((dados) => { if (ativo) setSlots(dados); })
      .catch((err) => { if (ativo) { setSlots([]); setErro(getErrorMessage(err, "Não foi possível carregar os horários.")); } })
      .finally(() => { if (ativo) setLoading(false); });

    return () => { ativo = false; };
    // loadSlots muda a cada render do pai; reloadKey é quem diz quando recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, reloadKey]);

  const chave = (slot: Slot) => `${slot.data_hora}-${slot.codigo_profissional ?? "c"}`;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {dias.map((d) => (
          <TouchableOpacity
            key={d.iso}
            onPress={() => setDia(d.iso)}
            style={[styles.date, dia === d.iso && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.dateText, dia === d.iso && styles.selectedText]}>{d.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} color={color} />
      ) : erro ? (
        <Text style={styles.message}>{erro}</Text>
      ) : slots.length === 0 ? (
        <Text style={styles.message}>Nenhum horário livre neste dia. Tente outra data.</Text>
      ) : (
        <View style={styles.slotGrid}>
          {slots.map((slot) => {
            const ativo = selected ? chave(selected) === chave(slot) : false;
            return (
              <TouchableOpacity
                key={chave(slot)}
                style={[styles.slot, ativo && { backgroundColor: color, borderColor: color }]}
                onPress={() => onSelect(slot)}
              >
                <Text style={[styles.slotText, { color: ativo ? "#fff" : color }]}>{slot.hora}</Text>
                {showProfessional && slot.profissional_nome ? (
                  <Text style={[styles.slotSub, ativo && { color: "#fff" }]} numberOfLines={1}>{slot.profissional_nome}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: { gap: 8, paddingBottom: 12 },
  date: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5EAF0", borderRadius: 9, paddingVertical: 11, paddingHorizontal: 14 },
  dateText: { color: "#475569", fontSize: 12, fontWeight: fontWeight.semibold },
  selectedText: { color: "#fff" },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  slot: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE5F0", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, minWidth: 92, alignItems: "center" },
  slotText: { fontWeight: fontWeight.semibold, fontSize: 13 },
  slotSub: { color: "#94A3B8", fontSize: 10, marginTop: 3, maxWidth: 110 },
  message: { color: "#94A3B8", fontSize: 13, paddingVertical: 16, textAlign: "center" },
});
