import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../styles/theme";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  /** Estilo do texto. As margens dele passam para a linha inteira. */
  style?: StyleProp<TextStyle>;
  /** Cor do ícone; sem ela, usa a cor do texto. */
  color?: string;
  size?: number;
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
};

/** Ícone + texto numa linha. Substitui os emojis usados como ícone. */
export default function IconText({ icon, children, style, color, size = 16, containerStyle, numberOfLines }: Props) {
  const {
    margin, marginTop, marginBottom, marginVertical, marginLeft, marginRight, marginHorizontal,
    ...textStyle
  } = StyleSheet.flatten(style) ?? {};

  return (
    <View
      style={[
        styles.row,
        { margin, marginTop, marginBottom, marginVertical, marginLeft, marginRight, marginHorizontal } as ViewStyle,
        containerStyle,
      ]}
    >
      <Ionicons name={icon} size={size} color={color ?? (textStyle.color as string) ?? colors.textSecondary} />
      <Text style={[textStyle, styles.text]} numberOfLines={numberOfLines}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  text: { flexShrink: 1 },
});
