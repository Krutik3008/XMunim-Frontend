// Theme configuration for XMunim App
// Matching the web app's gradient and glass design

export const colors = {
  // Primary gradient colors
  primary: {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
    indigo: '#6366F1',
  },
  // Status colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  // Neutral colors
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  white: '#FFFFFF',
  black: '#000000',
  // Transparent
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const gradients = {
  primary: ['#3B82F6', '#8B5CF6', '#EC4899'],
  blue: ['#3B82F6', '#6366F1'],
  green: ['#22C55E', '#3B82F6', '#8B5CF6'],
  auth: ['#4338CA', '#3B82F6', '#6366F1'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
  hero: 36,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

export default {
  colors,
  gradients,
  spacing,
  borderRadius,
  fontSize,
  shadows,
};
