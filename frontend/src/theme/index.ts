// Cropido theme tokens
export const Colors = {
  primary: '#2E7D32',
  primary700: '#388E3C',
  primary600: '#43A047',
  primary500: '#4CAF50',
  primary100: '#C8E6C9',
  primary50: '#E8F5E9',
  secondary: '#FF9800',
  secondary700: '#F57C00',
  secondary100: '#FFE0B2',
  secondary50: '#FFF3E0',
  background: '#FFFFFF',
  surfaceSubtle: '#F9FAFB',
  surfaceHover: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderDark: '#D1D5DB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  overlay: 'rgba(0,0,0,0.5)',
  // Dark
  darkBg: '#0F1512',
  darkSurface: '#1A211D',
  darkSurfaceHover: '#242C27',
  darkBorder: '#2D3630',
  darkText: '#F9FAFB',
  darkTextSecondary: '#9CA3AF',
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

export type ThemeMode = 'light' | 'dark';

export const getPalette = (mode: ThemeMode) => ({
  bg: mode === 'dark' ? Colors.darkBg : Colors.background,
  surface: mode === 'dark' ? Colors.darkSurface : Colors.background,
  surfaceSubtle: mode === 'dark' ? Colors.darkSurfaceHover : Colors.surfaceSubtle,
  border: mode === 'dark' ? Colors.darkBorder : Colors.border,
  text: mode === 'dark' ? Colors.darkText : Colors.textPrimary,
  textSecondary: mode === 'dark' ? Colors.darkTextSecondary : Colors.textSecondary,
  textTertiary: mode === 'dark' ? '#6B7280' : Colors.textTertiary,
});
