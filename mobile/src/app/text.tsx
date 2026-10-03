import { router } from "expo-router";
import { IngredientEditor } from "../components/IngredientEditor";
import { Body, Screen } from "../components/ui";
import { setChecked } from "../lib/session";
import { addHistory } from "../lib/store";

export default function TypeIngredients() {
  return (
    <Screen>
      <Body muted>Type or paste the ingredient list exactly as printed.</Body>
      <IngredientEditor
        initial=""
        autoFocus
        onCheck={async (text) => {
          await addHistory(null, text);
          setChecked({ product: null, ingredientsText: text });
          router.replace("/result");
        }}
      />
    </Screen>
  );
}
