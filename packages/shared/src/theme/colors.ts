export const zinc = {
  50: "#FAFAFA",
  100: "#F4F4F5",
  200: "#E4E4E7",
  300: "#D4D4D8",
  400: "#A1A1AA",
  500: "#71717A",
  600: "#52525B",
  700: "#3F3F46",
  800: "#27272A",
  900: "#18181B",
  950: "#09090B",
} as const;

export const status = {
  success: {
    DEFAULT: "#22C55E",
    dark: "#4ADE80",
    bg: "#DCFCE7",
  },
  error: {
    DEFAULT: "#EF4444",
    dark: "#F87171",
    bg: "#FEE2E2",
  },
  warning: {
    DEFAULT: "#F59E0B",
    dark: "#FCD34D",
    bg: "#FEF3C7",
  },
  info: {
    DEFAULT: "#0EA5E9",
    dark: "#38BDF8",
    bg: "#E0F2FE",
  },
} as const;

export const lightTheme = {
  bg: {
    primary: "#FFFFFF",
    secondary: zinc[50],
    tertiary: zinc[100],
  },
  text: {
    primary: zinc[900],
    secondary: zinc[600],
    muted: zinc[500],
    disabled: zinc[400],
  },
  border: {
    DEFAULT: zinc[200],
    hover: zinc[300],
    focus: zinc[400],
  },
} as const;

export const darkTheme = {
  bg: {
    primary: zinc[950],
    secondary: zinc[900],
    tertiary: zinc[800],
  },
  text: {
    primary: zinc[50],
    secondary: zinc[200],
    muted: zinc[400],
    disabled: zinc[600],
  },
  border: {
    DEFAULT: zinc[800],
    hover: zinc[700],
    focus: zinc[600],
  },
} as const;
