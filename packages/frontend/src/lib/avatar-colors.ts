const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const AVATAR_PALETTES = [
  ["#f8fafc", "#cbd5e1", "#94a3b8", "#64748b", "#334155"],
  ["#f9fafb", "#d1d5db", "#9ca3af", "#6b7280", "#374151"],
  ["#f4f6f5", "#ccd3cf", "#9ca8a2", "#6f7b75", "#454f4a"],
  ["#eef2f7", "#c2ccd8", "#94a0b0", "#697588", "#3d4652"],
] as const;

export const getAvatarColors = (seed: string): string[] => {
  const hash = hashString(seed);
  const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
  const offset = (hash >> 3) % palette.length;

  return palette.map((_, index) => palette[(index + offset) % palette.length]);
};
