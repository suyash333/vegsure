// Camera barcode and QR scanning. Uses the browser's built-in BarcodeDetector
// where it exists (Chrome on Android), and otherwise a WebAssembly build of ZXing
// with the same API (Safari, Firefox), loaded only when first needed.

import type { BarcodeFormat } from "barcode-detector/ponyfill";

interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]>;
}

const FORMATS: BarcodeFormat[] = ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "data_matrix", "code_128"];

let detectorPromise: Promise<Detector> | null = null;

export function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: any }).BarcodeDetector;
    if (Native) {
      try {
        const supported: string[] = await Native.getSupportedFormats();
        if (supported.includes("ean_13") && supported.includes("qr_code")) {
          return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) }) as Detector;
        }
      } catch {
        // fall through to the polyfill
      }
    }
    const { BarcodeDetector } = await import("barcode-detector/ponyfill");
    return new BarcodeDetector({ formats: FORMATS }) as unknown as Detector;
  })();
  return detectorPromise;
}

export interface ScanSession {
  stop(): void;
}

/**
 * Streams the rear camera into `video` and calls `onCode` once with the first
 * code read. Throws if the camera can't be opened (denied, none, insecure page).
 */
export async function startScan(video: HTMLVideoElement, onCode: (value: string) => void): Promise<ScanSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser can't open the camera here. Camera access needs HTTPS.");
  }
  const [stream, detector] = await Promise.all([
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }),
    getDetector(),
  ]);
  video.srcObject = stream;
  video.setAttribute("playsinline", "");
  video.muted = true;
  await video.play();

  let stopped = false;
  let timer = 0;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video);
        const hit = codes.find((c) => c.rawValue.trim());
        if (hit && !stopped) {
          stop();
          navigator.vibrate?.(60);
          onCode(hit.rawValue);
          return;
        }
      }
    } catch {
      // a frame that couldn't be read; try the next one
    }
    timer = window.setTimeout(tick, 120);
  };
  void tick();
  return { stop };
}

/** Reads a code from a still photo — the fallback when live camera access fails. */
export async function scanImage(file: Blob): Promise<string | null> {
  const [detector, bitmap] = await Promise.all([getDetector(), createImageBitmap(file)]);
  try {
    const codes = await detector.detect(bitmap);
    return codes.find((c) => c.rawValue.trim())?.rawValue ?? null;
  } finally {
    bitmap.close();
  }
}
