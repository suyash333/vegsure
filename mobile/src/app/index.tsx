import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Body, Button, Screen } from "../components/ui";
import { analyze } from "../lib/core";
import { setChecked, useDiet } from "../lib/session";
import { clearHistory, type HistoryEntry, loadHistory } from "../lib/store";
import { useTheme, verdictColors } from "../theme";

export default function Home() {
  const t = useTheme();
  const { diet, ready, firstRun } = useDiet();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (ready && firstRun) router.push("/diet");
  }, [ready, firstRun]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setHistory);
    }, []),
  );

  const lookUp = () => {
    const value = code.trim();
    if (value) router.push({ pathname: "/lookup", params: { code: value } });
  };

  return (
    <Screen>
      <Action primary title="Scan barcode or QR code" subtitle="Point your camera at the pack" onPress={() => router.push("/scan")} />
      <Action title="Photograph ingredients" subtitle="Read on your phone, works offline" onPress={() => router.push("/photo")} />
      <Action title="Type or paste ingredients" subtitle="Check any list by hand" onPress={() => router.push("/text")} />

      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={setCode}
          onSubmitEditing={lookUp}
          placeholder="Barcode number"
          placeholderTextColor={t.muted}
          keyboardType="number-pad"
          returnKeyType="search"
          accessibilityLabel="Barcode number"
          style={[styles.input, { borderColor: t.line, backgroundColor: t.surface, color: t.text }]}
        />
        <Button title="Look up" onPress={lookUp} />
      </View>

      {history.length > 0 && (
        <View style={{ gap: 8, marginTop: 12 }}>
          <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Recent</Text>
            <Pressable onPress={() => clearHistory().then(() => setHistory([]))} accessibilityRole="button">
              <Text style={{ color: t.brand, fontSize: 15 }}>Clear</Text>
            </Pressable>
          </View>
          {history.map((entry) => {
            const verdict = analyze(entry.ingredientsText, diet).verdict;
            return (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                onPress={() => {
                  setChecked({ product: entry.product ? { ...entry.product, ingredients: [] } : null, ingredientsText: entry.ingredientsText });
                  router.push("/result");
                }}
                style={[styles.historyItem, { backgroundColor: t.surface, borderColor: t.line }]}
              >
                {entry.product?.imageUrl ? (
                  <Image source={{ uri: entry.product.imageUrl }} style={styles.thumb} resizeMode="contain" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: t.bg }]} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontWeight: "600", fontSize: 16 }}>
                    {entry.product?.name ?? "Ingredient list"}
                  </Text>
                  <Text numberOfLines={1} style={{ color: t.muted }}>
                    {entry.product?.brand || (entry.product ? "" : entry.ingredientsText)}
                  </Text>
                </View>
                <View style={[styles.dot, { backgroundColor: verdictColors(t, verdict).fg }]} />
              </Pressable>
            );
          })}
        </View>
      )}

      <Body muted style={{ fontSize: 13, marginTop: 16 }}>
        Product data from Open Food Facts, the free food database anyone can edit. Photos are read on your phone and never uploaded.
      </Body>
    </Screen>
  );
}

function Action({ title, subtitle, onPress, primary }: { title: string; subtitle: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? t.brand : t.surface, borderColor: primary ? t.brand : t.line, opacity: pressed ? 0.85 : 1 },
        primary && { paddingVertical: 24 },
      ]}
    >
      <Text style={{ color: primary ? t.brandInk : t.text, fontSize: 17, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: primary ? t.brandInk : t.muted, fontSize: 14, opacity: primary ? 0.85 : 1 }}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 2 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, minHeight: 48 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
