import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Notice, Screen } from "../components/ui";
import { analyze, DIETS, type DietId, type Finding, packClaim, type Verdict } from "../lib/core";
import { getChecked, useDiet } from "../lib/session";
import { type Theme, useTheme, verdictColors } from "../theme";

const VERDICT: Record<Verdict, { title: string; body: (d: string) => string }> = {
  suitable: { title: "Looks suitable ✓", body: (d) => `Nothing in the ingredient list conflicts with ${d}.` },
  uncertain: { title: "Check before eating", body: () => "Some ingredients can come from animals or plants, and the label doesn't say which." },
  not_suitable: { title: "Not suitable", body: (d) => `Contains ingredients that aren't ${d}.` },
  unknown: { title: "No ingredients to check", body: () => "We couldn't find an ingredient list." },
};

const ADJECTIVE: Record<DietId, string> = { vegetarian: "vegetarian", lacto_ovo: "vegetarian", vegan: "vegan", jain: "Jain" };

interface Grouped {
  key: string;
  ingredient: string;
  within: string[];
  reasons: { name: string; reason: string }[];
  fromOff: boolean;
}

/** One row per ingredient: "cheese powder" flagged as milk and as cheese is one row with two reasons. */
function groupByIngredient(findings: Finding[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const f of findings) {
    const key = `${f.within.join(">")}>${f.ingredient}`;
    const g = map.get(key) ?? { key, ingredient: f.ingredient, within: f.within, reasons: [], fromOff: false };
    if (!g.reasons.some((r) => r.name === f.name)) g.reasons.push({ name: f.name, reason: f.reason });
    g.fromOff ||= f.source === "openfoodfacts";
    map.set(key, g);
  }
  return [...map.values()];
}

export default function Result() {
  const t = useTheme();
  const { diet } = useDiet();
  const checked = getChecked();
  const [showList, setShowList] = useState(false);
  const analysis = useMemo(
    () => (checked ? analyze(checked.ingredientsText, diet, { offIngredients: checked.product?.ingredients }) : null),
    [checked, diet],
  );

  if (!checked || !analysis) {
    return (
      <Screen>
        <Body>Nothing to show.</Body>
        <Button kind="primary" title="Back to start" onPress={() => router.dismissAll()} />
      </Screen>
    );
  }

  const { product } = checked;
  const adjective = ADJECTIVE[diet];
  const v = VERDICT[analysis.verdict];
  const colors = verdictColors(t, analysis.verdict);
  const claim = product ? packClaim(product) : null;
  const conflict =
    (claim === "vegan" && analysis.findings.some((f) => f.status === "avoid")) ||
    (claim === "vegetarian" && diet !== "vegan" && analysis.verdict === "not_suitable");
  const traceMentions = [...new Set(analysis.traces.flatMap((tr) => tr.mentions))];

  return (
    <Screen>
      {product && (
        <View style={styles.product}>
          {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={[styles.productImage, { borderColor: t.line }]} resizeMode="contain" /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: "700" }}>{product.name}</Text>
            {product.brand ? <Text style={{ color: t.muted }}>{product.brand}</Text> : null}
          </View>
        </View>
      )}

      <View style={[styles.verdict, { backgroundColor: colors.bg }]} accessibilityRole="summary">
        <Text style={[styles.verdictDiet, { color: colors.fg }]}>{DIETS.find((d) => d.id === diet)?.name.toUpperCase()}</Text>
        <Text style={[styles.verdictTitle, { color: colors.fg }]}>{v.title}</Text>
        <Body>{v.body(adjective)}</Body>
      </View>

      {claim && (
        <Notice warn={conflict || claim === "non_vegetarian"}>
          {claim === "non_vegetarian"
            ? "The pack is marked non-vegetarian."
            : `The pack is labelled ${claim}${conflict ? ", but the ingredient list says otherwise. Check the pack." : "."}`}
        </Notice>
      )}

      <FindingGroup t={t} title={`Not ${adjective}`} color={t.avoid} items={groupByIngredient(analysis.findings.filter((f) => f.status === "avoid"))} />
      <FindingGroup t={t} title="Could be animal-derived" color={t.check} items={groupByIngredient(analysis.findings.filter((f) => f.status === "check"))} />
      <FindingGroup t={t} title="Worth knowing" color={t.info} items={groupByIngredient(analysis.findings.filter((f) => f.status === "info"))} />

      {analysis.traces.length > 0 && (
        <View style={[styles.card, { borderColor: t.line, backgroundColor: t.surface, borderStyle: "dashed" }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>May contain</Text>
          {analysis.traces.map((tr) => (
            <Body key={tr.statement}>“{tr.statement}”</Body>
          ))}
          {traceMentions.length > 0 && (
            <Body muted>
              This is a cross-contamination warning ({traceMentions.join(", ").toLowerCase()}), not an ingredient. Most{" "}
              {diet === "vegan" ? "vegans" : "vegetarians"} accept it; it's your call.
            </Body>
          )}
        </View>
      )}

      <Pressable onPress={() => setShowList((s) => !s)} accessibilityRole="button" style={[styles.card, { borderColor: t.line, backgroundColor: t.surface }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>
          {showList ? "▾" : "▸"} Full ingredient list ({analysis.ingredientCount})
        </Text>
        {showList && (
          <Body selectable style={{ fontSize: 15 }}>
            {checked.ingredientsText}
          </Body>
        )}
      </Pressable>

      <Body muted style={{ fontSize: 13 }}>
        Checked against the printed ingredient list only. Labels can be wrong, incomplete or out of date, and hidden processing aids (such as bone-char sugar) are never
        listed. If it matters, contact the manufacturer.
      </Body>
      {product && (
        <Text style={{ color: t.muted, fontSize: 13 }}>
          Product data from{" "}
          <Text style={{ color: t.brand }} onPress={() => Linking.openURL(product.url)}>
            Open Food Facts
          </Text>{" "}
          (ODbL). Something wrong? You can fix it there.
        </Text>
      )}
      <Button kind="primary" title="Scan another" onPress={() => router.replace("/scan")} />
    </Screen>
  );
}

function FindingGroup({ t, title, color, items }: { t: Theme; title: string; color: string; items: Grouped[] }) {
  if (!items.length) return null;
  return (
    <View style={[styles.card, { borderColor: t.line, borderLeftColor: color, borderLeftWidth: 5, backgroundColor: t.surface }]}>
      <Text style={[styles.cardTitle, { color }]}>
        {title} · {items.length}
      </Text>
      {items.map((item) => (
        <View key={item.key} style={{ gap: 2 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }}>
            {item.ingredient}
            {item.within.length ? <Text style={{ color: t.muted, fontWeight: "400" }}> in {item.within.join(" › ")}</Text> : null}
          </Text>
          {item.reasons.map((r) => (
            <Text key={r.name} style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{r.name}: </Text>
              {r.reason}
            </Text>
          ))}
          {item.fromOff && <Text style={{ color: t.muted, fontSize: 12 }}>Flagged by Open Food Facts</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  product: { flexDirection: "row", alignItems: "center", gap: 12 },
  productImage: { width: 72, height: 72, borderRadius: 12, borderWidth: 1 },
  verdict: { borderRadius: 14, padding: 16, gap: 4 },
  verdictDiet: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  verdictTitle: { fontSize: 26, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
});
