import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  if (!scroll) return <View style={[styles.screen, { backgroundColor: t.bg }]}>{children}</View>;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Button({
  title,
  onPress,
  kind = "secondary",
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? t.brand : t.surface,
          borderColor: primary ? t.brand : t.line,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? t.brandInk : t.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Body({ children, muted, style, selectable }: { children: ReactNode; muted?: boolean; style?: object; selectable?: boolean }) {
  const t = useTheme();
  return (
    <Text selectable={selectable} style={[styles.body, { color: muted ? t.muted : t.text }, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.heading, { color: t.text }]}>{children}</Text>;
}

export function Notice({ children, warn }: { children: ReactNode; warn?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: warn ? t.checkBg : t.infoBg }]}>
      <Text style={[styles.body, { color: t.text }]}>{children}</Text>
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={t.brand} size="large" />
      <Body muted>{label}</Body>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, flexGrow: 1 },
  button: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 23 },
  heading: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
  notice: { borderRadius: 12, padding: 12 },
  loading: { alignItems: "center", gap: 12, paddingVertical: 32 },
});
