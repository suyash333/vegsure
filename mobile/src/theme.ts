import { useColorScheme } from "react-native";
import type { Verdict } from "./lib/core";

const light = {
  bg: "#f6f8f5",
  surface: "#ffffff",
  text: "#17201b",
  muted: "#5d6b63",
  line: "#dfe6e0",
  brand: "#1f7a4d",
  brandInk: "#ffffff",
  ok: "#1f7a4d",
  okBg: "#e4f4ea",
  check: "#9a5b00",
  checkBg: "#fff2d9",
  avoid: "#b3261e",
  avoidBg: "#fde7e5",
  info: "#4a5a6a",
  infoBg: "#eef1f4",
};

const dark: typeof light = {
  bg: "#0f1411",
  surface: "#18201b",
  text: "#e8eee9",
  muted: "#9aaba1",
  line: "#2b362f",
  brand: "#3fb27a",
  brandInk: "#06140c",
  ok: "#5fd197",
  okBg: "#143323",
  check: "#f2b45a",
  checkBg: "#3a2a10",
  avoid: "#ff8a80",
  avoidBg: "#3d1614",
  info: "#b5c2cf",
  infoBg: "#222a31",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export function verdictColors(t: Theme, v: Verdict): { fg: string; bg: string } {
  switch (v) {
    case "suitable":
      return { fg: t.ok, bg: t.okBg };
    case "uncertain":
      return { fg: t.check, bg: t.checkBg };
    case "not_suitable":
      return { fg: t.avoid, bg: t.avoidBg };
    default:
      return { fg: t.info, bg: t.infoBg };
  }
}
