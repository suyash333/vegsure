import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { DIETS, type DietId } from "../lib/core";
import { DietContext, useDiet } from "../lib/session";
import { loadDiet, saveDiet } from "../lib/store";
import { useTheme } from "../theme";

function DietChip() {
  const { diet } = useDiet();
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change diet"
      onPress={() => router.push("/diet")}
      style={{ borderWidth: 1, borderColor: t.brandInk, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}
    >
      <Text style={{ color: t.brandInk, fontSize: 13 }}>{DIETS.find((d) => d.id === diet)?.name}</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const t = useTheme();
  const [diet, setDietState] = useState<DietId>("vegetarian");
  const [ready, setReady] = useState(false);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    loadDiet().then((saved) => {
      if (saved) setDietState(saved);
      else setFirstRun(true);
      setReady(true);
    });
  }, []);

  const value = useMemo(
    () => ({
      diet,
      ready,
      firstRun,
      setDiet: (d: DietId) => {
        setDietState(d);
        setFirstRun(false);
        void saveDiet(d);
      },
    }),
    [diet, ready, firstRun],
  );

  return (
    <DietContext.Provider value={value}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.brand },
          headerTintColor: t.brandInk,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: t.bg },
          headerRight: () => <DietChip />,
        }}
      >
        <Stack.Screen name="index" options={{ title: "VegSure" }} />
        <Stack.Screen name="scan" options={{ title: "Scan" }} />
        <Stack.Screen name="lookup" options={{ title: "Looking up" }} />
        <Stack.Screen name="photo" options={{ title: "Ingredient photo" }} />
        <Stack.Screen name="text" options={{ title: "Ingredients" }} />
        <Stack.Screen name="result" options={{ title: "Result" }} />
        <Stack.Screen name="diet" options={{ title: "Your diet", presentation: "modal", headerRight: undefined }} />
      </Stack>
    </DietContext.Provider>
  );
}
