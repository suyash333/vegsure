import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { Body, Button, Heading, Loading, Screen } from "../components/ui";
import { addProductUrl, interpretScan, lookupProduct, type Product } from "../lib/core";
import { offFetch, setChecked } from "../lib/session";
import { addHistory } from "../lib/store";

type State =
  | { kind: "loading"; gtin: string }
  | { kind: "url"; url: string }
  | { kind: "text"; text: string }
  | { kind: "not_found"; gtin: string }
  | { kind: "no_ingredients"; product: Product }
  | { kind: "error"; gtin: string };

export default function Lookup() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [state, setState] = useState<State>(() => initial(code ?? ""));

  useEffect(() => {
    const target = interpretScan(code ?? "");
    if (target.kind !== "gtin") return;
    let cancelled = false;
    lookupProduct(target.candidates, offFetch)
      .then(async (product) => {
        if (cancelled) return;
        if (!product) return setState({ kind: "not_found", gtin: target.gtin });
        if (!product.ingredientsText) return setState({ kind: "no_ingredients", product });
        await addHistory(product, product.ingredientsText);
        setChecked({ product, ingredientsText: product.ingredientsText });
        router.replace("/result");
      })
      .catch(() => !cancelled && setState({ kind: "error", gtin: target.gtin }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const photoInstead = <Button kind="primary" title="Photograph ingredients" onPress={() => router.replace("/photo")} />;
  const scanAgain = <Button title="Scan again" onPress={() => router.replace("/scan")} />;

  switch (state.kind) {
    case "loading":
      return (
        <Screen>
          <Loading label={`Looking up ${state.gtin}…`} />
        </Screen>
      );
    case "url":
      return (
        <Screen>
          <Heading>This QR code isn't a product code</Heading>
          <Body>It links to a website rather than identifying the product:</Body>
          <Body muted selectable>
            {state.url}
          </Body>
          <Button title="Open link" onPress={() => Linking.openURL(state.url)} />
          <Body muted>Scan the striped barcode instead, or photograph the ingredient list.</Body>
          {scanAgain}
          {photoInstead}
        </Screen>
      );
    case "text":
      return (
        <Screen>
          <Heading>Not a product barcode</Heading>
          <Body muted selectable>
            {state.text}
          </Body>
          <Body>That isn't a valid retail barcode. Check the number and try again.</Body>
          {scanAgain}
          {photoInstead}
        </Screen>
      );
    case "not_found":
      return (
        <Screen>
          <Heading>Product not found</Heading>
          <Body>Barcode {state.gtin} isn't in Open Food Facts yet. Photograph the ingredient list and we'll check it.</Body>
          {photoInstead}
          {scanAgain}
          <Button title="Add it to Open Food Facts" onPress={() => Linking.openURL(addProductUrl(state.gtin))} />
        </Screen>
      );
    case "no_ingredients":
      return (
        <Screen>
          <Heading>{state.product.name}</Heading>
          <Body>This product is in the database, but nobody has added its ingredient list yet. Photograph the list on the pack and we'll check it.</Body>
          {photoInstead}
          <Button title="Add ingredients on Open Food Facts" onPress={() => Linking.openURL(state.product.url)} />
        </Screen>
      );
    case "error":
      return (
        <Screen>
          <Heading>Couldn't reach the product database</Heading>
          <Body>Check your internet connection and try again. Photographing the ingredients works offline.</Body>
          <Button title="Try again" onPress={() => router.replace({ pathname: "/lookup", params: { code: state.gtin } })} />
          {photoInstead}
        </Screen>
      );
  }
}

function initial(code: string): State {
  const target = interpretScan(code);
  if (target.kind === "url") return { kind: "url", url: target.url };
  if (target.kind === "text") return { kind: "text", text: target.text };
  return { kind: "loading", gtin: target.gtin };
}
