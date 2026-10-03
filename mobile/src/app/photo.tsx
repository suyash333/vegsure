// Photograph an ingredient list and read it with ML Kit, on the phone.

import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { IngredientEditor } from "../components/IngredientEditor";
import { Body, Button, Loading, Notice, Screen } from "../components/ui";
import { readIngredientPhoto, type Script } from "../lib/ocr";
import { setChecked } from "../lib/session";
import { addHistory } from "../lib/store";
import { useTheme } from "../theme";

type State = { kind: "start" } | { kind: "reading"; uri: string } | { kind: "review"; uri: string; text: string } | { kind: "error"; message: string };

export default function Photo() {
  const t = useTheme();
  const [state, setState] = useState<State>({ kind: "start" });
  const [script, setScript] = useState<Script>("latin");

  const pick = async (source: "camera" | "library") => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, quality: 0.9 };
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setState({ kind: "error", message: "Camera permission was refused. Allow it in Settings, or choose a photo from your gallery." });
    }
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setState({ kind: "reading", uri });
    try {
      const text = await readIngredientPhoto(uri, script);
      if (!text.trim()) {
        setState({ kind: "error", message: "No text found in that photo. Try again closer, in good light, with the list flat and straight on." });
      } else {
        setState({ kind: "review", uri, text });
      }
    } catch {
      setState({ kind: "error", message: "Couldn't read that photo. Try again, or type the list." });
    }
  };

  if (state.kind === "reading") {
    return (
      <Screen>
        <Image source={{ uri: state.uri }} style={styles.preview} resizeMode="contain" />
        <Loading label="Reading the label…" />
      </Screen>
    );
  }

  if (state.kind === "review") {
    return (
      <Screen>
        <Image source={{ uri: state.uri }} style={styles.preview} resizeMode="contain" />
        <Notice>Text recognition makes mistakes. Compare this with the pack and fix anything that's wrong before checking.</Notice>
        <IngredientEditor
          initial={state.text}
          onCheck={async (text) => {
            await addHistory(null, text);
            setChecked({ product: null, ingredientsText: text });
            router.replace("/result");
          }}
        />
        <Button title="Retake photo" onPress={() => setState({ kind: "start" })} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body>Photograph just the ingredient list, close up and straight on. You can crop it after taking the photo.</Body>
      {state.kind === "error" && <Notice warn>{state.message}</Notice>}
      <Text style={{ color: t.muted, fontSize: 14 }}>Label language</Text>
      <View style={styles.segment}>
        {(["latin", "devanagari"] as const).map((s) => (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ selected: script === s }}
            onPress={() => setScript(s)}
            style={[styles.segmentItem, { borderColor: script === s ? t.brand : t.line, backgroundColor: script === s ? t.okBg : t.surface }]}
          >
            <Text style={{ color: t.text, fontWeight: script === s ? "700" : "400" }}>{s === "latin" ? "English" : "हिन्दी / मराठी"}</Text>
          </Pressable>
        ))}
      </View>
      <Button kind="primary" title="Take photo" onPress={() => pick("camera")} />
      <Button title="Choose from gallery" onPress={() => pick("library")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: "100%", height: 220, borderRadius: 12 },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
});
