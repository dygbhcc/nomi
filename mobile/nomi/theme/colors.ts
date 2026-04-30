// Terracotta & Orange Theme
export const Colors = {
  // Primary
  accent: '#E06A4F',           // Terracotta — primary buttons, CTA
  accentSecondary: '#FF8A3D',  // Orange — secondary accent
  accentLight: '#FFC98A',      // Light orange — vurgu

  // Backgrounds
  background: '#FFFFFF',       // Pure white — main background
  cardBackground: '#FFFFFF',   // Pure white — cards, surfaces

  // Text
  textPrimary: '#2B2B2B',      // Near black — main text
  textSecondary: '#888888',    // Gray — secondary text
  textTertiary: '#888888',
  textOnAccent: '#FFFFFF',

  // States
  border: '#F0F0F0',           // Neutral border
  borderActive: '#E06A4F',
  shadow: '#000000',

  // Progress & Indicators
  stepActive: '#E06A4F',
  stepInactive: '#E8E8E8',     // Neutral inactive

  // Selected States
  selectedBackground: 'rgba(224, 106, 79, 0.06)',
  selectedText: '#E06A4F',
  selectedHint: '#C25A41',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Semantic
  success: '#4CAF50',
  error: '#E74C3C',

  // Mood badge
  badgeBackground: 'rgba(224, 106, 79, 0.10)',
  badgeText: '#E06A4F',

  // Why for you box
  reasonBackground: 'rgba(224, 106, 79, 0.08)',
  reasonBorder: 'rgba(224, 106, 79, 0.2)',
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
