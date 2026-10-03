// Works out what a scanned code points at. Food packs carry:
//   - a linear barcode: EAN-13, UPC-A, EAN-8 or UPC-E — just digits
//   - a GS1 Digital Link QR code: https://id.gs1.org/01/09506000134352/10/ABC
//   - a GS1 DataMatrix or QR with an element string: (01)09506000134352(17)251231
// All three carry a GTIN, which is what product databases are keyed on. Any other
// QR code (a brand's website, a recipe page) has no product number in it.

export type ScanTarget =
  | { kind: "gtin"; gtin: string; candidates: string[] }
  | { kind: "url"; url: string }
  | { kind: "text"; text: string };

export function interpretScan(raw: string): ScanTarget {
  const value = raw.trim().replace(/^\]([A-Za-z]\d)/, ""); // strip AIM symbology id, e.g. "]Q3"

  const digits = value.replace(/[\s-]/g, "");
  if (/^\d{6,14}$/.test(digits)) {
    const gtin = toGtin(digits);
    if (gtin) return { kind: "gtin", gtin, candidates: lookupCandidates(gtin) };
  }

  const fromLink = gtinFromDigitalLink(value);
  if (fromLink) return { kind: "gtin", gtin: fromLink, candidates: lookupCandidates(fromLink) };

  const fromElements = gtinFromElementString(value);
  if (fromElements) return { kind: "gtin", gtin: fromElements, candidates: lookupCandidates(fromElements) };

  if (/^https?:\/\//i.test(value)) return { kind: "url", url: value };
  return { kind: "text", text: value };
}

export function checkDigitOk(code: string): boolean {
  if (!/^\d+$/.test(code) || code.length < 2) return false;
  const body = code.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

/** Normalise any retail barcode to a GTIN (8, 12, 13 or 14 digits), or null if invalid. */
export function toGtin(digits: string): string | null {
  if (digits.length === 6 || digits.length === 7) return expandUpcE(digits.length === 6 ? `0${digits}` : digits, false);
  if (digits.length === 8) {
    if (checkDigitOk(digits)) return digits; // EAN-8
    return expandUpcE(digits, true);
  }
  if ([12, 13, 14].includes(digits.length) && checkDigitOk(digits)) return digits;
  return null;
}

/** UPC-E (number system + 6 digits [+ check]) to its 12-digit UPC-A. */
function expandUpcE(code: string, hasCheck: boolean): string | null {
  const ns = code[0];
  if (ns !== "0" && ns !== "1") return null;
  const d = code.slice(1, 7);
  if (d.length !== 6) return null;
  const last = d[5]!;
  let body: string;
  if (last <= "2") body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  else if (last === "3") body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  else if (last === "4") body = `${d.slice(0, 4)}00000${d[4]}`;
  else body = `${d.slice(0, 5)}0000${last}`;
  const partial = `${ns}${body}`;
  for (let c = 0; c <= 9; c++) {
    const full = `${partial}${c}`;
    if (checkDigitOk(full)) {
      if (hasCheck && code.length === 8 && code[7] !== String(c)) return null;
      return full;
    }
  }
  return null;
}

/** Databases key products by EAN-13 mostly; try the forms a GTIN is commonly stored under. */
export function lookupCandidates(gtin: string): string[] {
  const out = new Set<string>([gtin]);
  const stripped = gtin.replace(/^0+/, "");
  if (stripped.length >= 8) {
    if (stripped.length <= 13) out.add(stripped.padStart(13, "0"));
    if (stripped.length <= 12) out.add(stripped.padStart(12, "0"));
    if (stripped.length === 8) out.add(stripped);
  }
  return [...out];
}

function gtinFromDigitalLink(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === "01" || segments[i]?.toLowerCase() === "gtin") {
      const gtin = toGtin(decodeURIComponent(segments[i + 1]!));
      if (gtin) return gtin;
    }
  }
  const q = url.searchParams.get("01") ?? url.searchParams.get("gtin");
  return q ? toGtin(q) : null;
}

function gtinFromElementString(value: string): string | null {
  const bracketed = /\(01\)\s*(\d{14})/.exec(value);
  if (bracketed && checkDigitOk(bracketed[1]!)) return bracketed[1]!;
  // Raw form: "01" + 14 digits at the start, or after a group separator (ASCII 29).
  const raw = /(?:^|\x1d)01(\d{14})/.exec(value);
  if (raw && checkDigitOk(raw[1]!)) return raw[1]!;
  return null;
}
