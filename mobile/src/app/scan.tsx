// Live barcode and QR scanning. expo-camera uses Google ML Kit for this on
// Android and Apple's built-in scanner on iOS; both run on the phone.

import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Body, Button, Screen } from "../components/ui";

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  if (!permission) return <Screen scroll={false}>{null}</Screen>;

  if (!permission.granted) {
    return (
      <Screen>
        <Body>VegSure needs the camera to read barcodes and QR codes. Nothing is recorded or uploaded.</Body>
        {permission.canAskAgain ? (
          <Button kind="primary" title="Allow camera" onPress={requestPermission} />
        ) : (
          <Button kind="primary" title="Open settings" onPress={() => Linking.openSettings()} />
        )}
        <Button title="Type the barcode number instead" onPress={() => router.back()} />
      </Screen>
    );
  }

  const onScanned = (result: BarcodeScanningResult) => {
    if (handled.current || !result.data?.trim()) return;
    handled.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: "/lookup", params: { code: result.data } });
  };

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr", "datamatrix", "code128"] }}
        onBarcodeScanned={onScanned}
      />
      <View pointerEvents="none" style={styles.frame} />
      <View style={styles.controls}>
        <Body style={styles.hint}>Hold the barcode or QR code inside the frame.</Body>
        <Button title={torch ? "Torch off" : "Torch on"} onPress={() => setTorch((v) => !v)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  frame: {
    position: "absolute",
    top: "28%",
    left: "10%",
    right: "10%",
    height: "24%",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
  },
  controls: { position: "absolute", left: 16, right: 16, bottom: 32, gap: 12 },
  hint: { color: "#fff", textAlign: "center", textShadowColor: "#000", textShadowRadius: 4 },
});
