import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Body, Screen } from "../components/ui";
import { DIETS } from "../lib/core";
import { useDiet } from "../lib/session";
import { useTheme } from "../theme";

export default function DietPicker() {
  const t = useTheme();
  const { diet, firstRun, setDiet } = useDiet();
  return (
    <Screen>
      <Body muted>
        {firstRun ? "What do you eat? " : ""}Products are checked against this. You can change it any time.
      </Body>
      {DIETS.map((d) => {
        const selected = d.id === diet && !firstRun;
        return (
          <Pressable
            key={d.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              setDiet(d.id);
              router.back();
            }}
            style={{
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? t.brand : t.line,
              backgroundColor: t.surface,
              borderRadius: 12,
              padding: 14,
              gap: 2,
            }}
          >
            <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{d.name}</Text>
            <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>{d.summary}</Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}
