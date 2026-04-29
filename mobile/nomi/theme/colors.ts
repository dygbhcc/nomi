// Light Theme Colors
export const Colors = {
  // Primary
  accent: "#7F77DD",

  // Backgrounds
  background: "#F5F5F0",
  cardBackground: "#FFFFFF",

  // Text
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textOnAccent: "#FFFFFF",

  // States
  border: "transparent",
  borderActive: "#7F77DD",
  shadow: "#000000",

  // Progress & Indicators
  stepActive: "#7F77DD",
  stepInactive: "#E0E0E0",

  // Selected States
  selectedBackground: "rgba(127, 119, 221, 0.08)",
  selectedText: "#7F77DD",
  selectedHint: "#6B63B5",

  // Overlays
  overlay: "rgba(0, 0, 0, 0.5)",
};

export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const Typography = {
  // Font sizes
  title: 24,
  heading: 20,
  body: 15,
  caption: 13,
  small: 11,

  // Font weights
  regular: "400" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};
