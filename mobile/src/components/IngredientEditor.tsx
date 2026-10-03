import { useState } from "react";
import { TextInput } from "react-native";
import { useTheme } from "../theme";
import { Button } from "./ui";

export function IngredientEditor({ initial, onCheck, autoFocus }: { initial: string; onCheck: (text: string) => void; autoFocus?: boolean }) {
  const t = useTheme();
  const [text, setText] = useState(initial);
  return (
    <>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus={autoFocus}
        textAlignVertical="top"
        placeholder="e.g. Wheat flour, sugar, palm oil, milk solids, emulsifier (471), salt"
        placeholderTextColor={t.muted}
        accessibilityLabel="Ingredient list"
        style={{
          minHeight: 180,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 12,
          padding: 12,
          fontSize: 16,
          lineHeight: 22,
          color: t.text,
          backgroundColor: t.surface,
        }}
      />
      <Button kind="primary" title="Check ingredients" disabled={!text.trim()} onPress={() => onCheck(text.trim())} />
    </>
  );
}
