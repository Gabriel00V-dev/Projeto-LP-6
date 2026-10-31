import React, { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fontSize, fontWeight, spacing } from "../styles/theme";

/**
 * Gráficos simples em View, sem biblioteca. Regras (skill dataviz):
 * marcas finas (barra <= 24px, ponta 4px arredondada, base reta), 2px de
 * respiro entre marcas, texto sempre em cor de texto (nunca na cor do dado),
 * rótulo só onde importa e uma tabela equivalente para cada gráfico.
 */

export const CHART = {
  serie: "#2a78d6",      // série única (slot 1 da paleta validada)
  grade: "#e1e0d9",      // linha de grade (hairline)
  base: "#c3c2b7",       // linha de base
  textoMudo: "#898781",  // eixos e rótulos secundários
};

const numero = (valor: number) => valor.toLocaleString("pt-BR");

// ============================================================
// Números
// ============================================================

/** O número principal da tela. Um por visão. */
export function HeroFigure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroLabel}>{label}</Text>
      <Text style={styles.heroValue}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

// ============================================================
// Barras horizontais (categorias nominais, uma série = uma cor)
// ============================================================

export function HBarChart({ items, color = CHART.serie }: { items: { label: string; value: number }[]; color?: string }) {
  const ordenados = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...ordenados.map((i) => i.value));

  return (
    <View accessibilityRole="summary" accessibilityLabel={ordenados.map((i) => `${i.label}: ${i.value}`).join(", ")}>
      {ordenados.map((item) => (
        <View key={item.label} style={styles.hbarRow}>
          <Text style={styles.hbarLabel} numberOfLines={1}>{item.label}</Text>
          <View style={styles.hbarTrack}>
            {item.value > 0 ? (
              // Todas as barras na mesma escala, com o teto em 80% para o valor caber na ponta.
              <View style={[styles.hbar, { width: `${(item.value / max) * 80}%`, backgroundColor: color }]} />
            ) : null}
            {/* Valor na ponta da barra, em cor de texto */}
            <Text style={styles.hbarValue}>{numero(item.value)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// Colunas por dia (série temporal única)
// ============================================================

const ALTURA_COLUNAS = 120;

export function ColumnChart({
  points,
  color = CHART.serie,
  formatLabel,
}: {
  points: { key: string; value: number }[];
  color?: string;
  formatLabel: (key: string) => string;
}) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  const max = Math.max(1, ...points.map((p) => p.value));
  const indiceMax = points.reduce((melhor, p, i) => (p.value > points[melhor].value ? i : melhor), 0);
  // Rótulo seletivo: o pico, ou o ponto tocado.
  const destaque = selecionado ?? indiceMax;

  return (
    <View>
      <Text style={styles.caption}>
        {formatLabel(points[destaque].key)}: <Text style={styles.captionValue}>{numero(points[destaque].value)}</Text>
        {selecionado === null ? "  (pico do período; toque numa coluna)" : ""}
      </Text>

      <View style={styles.columns}>
        {/* Grade: só a linha do máximo, hairline */}
        <View style={[styles.gridLine, { bottom: ALTURA_COLUNAS }]} />
        {points.map((p, i) => (
          <Pressable
            key={p.key}
            onPress={() => setSelecionado(i === selecionado ? null : i)}
            style={styles.columnHit}
            accessibilityLabel={`${formatLabel(p.key)}: ${p.value}`}
          >
            {p.value > 0 ? (
              <View
                style={[
                  styles.column,
                  {
                    height: Math.max(2, (p.value / max) * ALTURA_COLUNAS),
                    backgroundColor: color,
                    opacity: selecionado === null || selecionado === i ? 1 : 0.35,
                  },
                ]}
              />
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.baseline} />
      <View style={styles.axis}>
        <Text style={styles.axisText}>{formatLabel(points[0].key)}</Text>
        <Text style={styles.axisText}>máx. {numero(max)}</Text>
        <Text style={styles.axisText}>{formatLabel(points[points.length - 1].key)}</Text>
      </View>

      <TouchableOpacity onPress={() => setTabela((t) => !t)} style={styles.tableToggle}>
        <Text style={styles.tableToggleText}>{tabela ? "Ocultar tabela" : "Ver tabela"}</Text>
      </TouchableOpacity>
      {tabela ? (
        <View style={styles.table}>
          {points.map((p) => (
            <View key={p.key} style={styles.tableRow}>
              <Text style={styles.tableCell}>{formatLabel(p.key)}</Text>
              <Text style={[styles.tableCell, styles.tableNumber]}>{numero(p.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// Barra segmentada alta (partes de um todo, até 6 partes)
// ============================================================

export type Segmento = { key: string; label: string; value: number; color: string; textoClaro?: boolean };

export function SegmentedBar({ parts }: { parts: Segmento[] }) {
  const [largura, setLargura] = useState(0);
  const total = parts.reduce((soma, p) => soma + p.value, 0);
  const visiveis = parts.filter((p) => p.value > 0);

  if (total === 0) return <Text style={styles.hint}>Sem registros no período.</Text>;

  return (
    <View>
      <View style={styles.segmented} onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}>
        {visiveis.map((p, i) => {
          const fracao = p.value / total;
          const larguraParte = fracao * (largura - (visiveis.length - 1) * 2);
          const pct = `${Math.round(fracao * 100)}%`;
          // Só escreve dentro se couber com folga; senão a tabela abaixo carrega o valor.
          const cabe = larguraParte >= 40;
          return (
            <View
              key={p.key}
              style={[styles.segment, { flex: fracao, backgroundColor: p.color, marginLeft: i === 0 ? 0 : 2 }]}
            >
              {cabe ? (
                <Text style={[styles.segmentText, { color: p.textoClaro ? "#1C1C1E" : "#fff" }]}>{pct}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Legenda e tabela juntas: nome, quantidade e parcela de cada parte */}
      <View style={styles.table}>
        {parts.map((p) => (
          <View key={p.key} style={styles.tableRow}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text style={[styles.tableCell, { flex: 1 }]}>{p.label}</Text>
            <Text style={[styles.tableCell, styles.tableNumber]}>{numero(p.value)}</Text>
            <Text style={[styles.tableCell, styles.tableNumber, styles.tablePct]}>
              {Math.round((p.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: spacing.sm },
  heroLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  heroValue: { fontSize: 52, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: 60 },
  hint: { fontSize: fontSize.xs, color: CHART.textoMudo, marginTop: 2 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  // Base fixa + crescimento: 2 por linha no celular, até 6 numa tela larga.
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tileLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  tileValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.semibold, color: colors.text, marginTop: 2 },

  hbarRow: { flexDirection: "row", alignItems: "center", marginBottom: 2, minHeight: 28 },
  hbarLabel: { width: 96, fontSize: fontSize.sm, color: colors.textSecondary },
  hbarTrack: { flex: 1, flexDirection: "row", alignItems: "center" },
  hbar: { height: 20, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  hbarValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium, marginLeft: spacing.sm },

  caption: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  captionValue: { color: colors.text, fontWeight: fontWeight.semibold },
  columns: { height: ALTURA_COLUNAS, flexDirection: "row", alignItems: "flex-end" },
  columnHit: { flex: 1, height: "100%", justifyContent: "flex-end", paddingHorizontal: 1 },
  column: { borderTopLeftRadius: 4, borderTopRightRadius: 4, maxWidth: 24, width: "100%", alignSelf: "center" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: CHART.grade },
  baseline: { height: 1, backgroundColor: CHART.base },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisText: { fontSize: fontSize.xs, color: CHART.textoMudo },

  tableToggle: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  tableToggleText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },
  table: { marginTop: spacing.sm },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: CHART.grade, gap: spacing.sm },
  tableCell: { fontSize: fontSize.sm, color: colors.text },
  tableNumber: { fontVariant: ["tabular-nums"], textAlign: "right", minWidth: 40, marginLeft: "auto" },
  tablePct: { color: colors.textSecondary, minWidth: 44, marginLeft: 0 },
  swatch: { width: 10, height: 10, borderRadius: 2 },

  segmented: { flexDirection: "row", height: 28, borderRadius: 4, overflow: "hidden" },
  segment: { justifyContent: "center", paddingLeft: 6, borderRadius: 4 },
  segmentText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
