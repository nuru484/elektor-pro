// Pure hex/RGB conversions for the brand color editors.

export interface Rgb {
  b: number;
  g: number;
  r: number;
}

/** "#abc" or "#aabbcc" → RGB, else null. */
export const hexToRgb = (hex: string): null | Rgb => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(value, 16);
  return { b: num & 255, g: (num >> 8) & 255, r: (num >> 16) & 255 };
};

export const rgbToHex = ({ b, g, r }: Rgb): string =>
  `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`;

/** "34, 197, 94" or "rgb(34 197 94)" → RGB, else null. */
export const parseRgbString = (value: string): null | Rgb => {
  const numbers = value.match(/\d{1,3}/g);
  if (!numbers || numbers.length !== 3) return null;
  const [r, g, b] = numbers.map(Number);
  if ([r, g, b].some((channel) => channel > 255)) return null;
  return { b, g, r };
};

export const rgbToString = (rgb: Rgb): string => `${rgb.r}, ${rgb.g}, ${rgb.b}`;
