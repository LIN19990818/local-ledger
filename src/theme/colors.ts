export const colors = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  
  success: '#10B981',
  successLight: '#34D399',
  
  danger: '#EF4444',
  dangerLight: '#F87171',
  
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  
  background: {
    light: '#FFFFFF',
    dark: '#0F172A'
  },
  
  surface: {
    light: '#F8FAFC',
    dark: '#1E293B'
  },
  
  card: {
    light: '#FFFFFF',
    dark: '#1E293B'
  },
  
  text: {
    primary: {
      light: '#0F172A',
      dark: '#F8FAFC'
    },
    secondary: {
      light: '#64748B',
      dark: '#94A3B8'
    }
  },
  
  border: {
    light: '#E2E8F0',
    dark: '#334155'
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  }
};

export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500
  },
  easing: {
    ease: 'ease' as const,
    easeIn: 'ease-in' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const
  }
};
