export const APP_CONFIG = {
  STORAGE_KEYS: {
    TEMPLATES: '@device_templates',
    ACTIVE_TEMPLATE: '@active_template_id',
    STEALTH_MODE: '@stealth_mode',
    SESSIONS: '@device_usage_sessions',
  },
  LIMITS: {
    MAX_TEMPLATES: 50,
    MAX_DEVICES_PER_TEMPLATE: 20,
    MAX_STORED_SESSIONS: 50,
    MAX_RECENT_EVENTS: 100,
    MAX_ENUMERATION_DETAILS: 200,
  },
  TIMEOUTS: {
    VIDEO_LOAD: 10000,
    DEVICE_TEST: 2000,
    AUDIO_TEST_FRAMES: 40,
    AUDIO_TEST_INTERVAL: 50,
    PERMISSION_RETRY_DELAY: 500,
    WEBVIEW_RELOAD_DELAY: 100,
    ENUMERATION_DELAY: 100,
    ENUMERATION_RETRY_DELAY: 200,
  },
  SENSOR_INTERVALS: {
    DEFAULT: 50,
    HIGH_FREQUENCY: 16,
    LOW_FREQUENCY: 100,
  },
  ANIMATION: {
    SPRING_FRICTION: 10,
    PULSE_DURATION: 1000,
    FADE_DURATION: 300,
  },
  WEBVIEW: {
    DEFAULT_URL: 'https://example.com',
    TEST_URL: 'https://webcamtests.com/recorder',
  },
} as const;

export const THEME = {
  colors: {
    primary: '#00ff88',
    secondary: '#00aaff',
    danger: '#ff4757',
    warning: '#ffa502',
    background: {
      dark: '#0a0a0a',
      medium: '#1a1a1a',
      light: '#2a2a2a',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255,255,255,0.8)',
      muted: 'rgba(255,255,255,0.6)',
      disabled: 'rgba(255,255,255,0.4)',
    },
    border: {
      default: 'rgba(255,255,255,0.1)',
      active: 'rgba(0,255,136,0.3)',
      simulating: 'rgba(0,170,255,0.3)',
    },
    badge: {
      lens: 'rgba(255,165,0,0.15)',
      facing: 'rgba(0,255,136,0.1)',
      zoom: 'rgba(138,43,226,0.15)',
      mic: 'rgba(255,100,100,0.15)',
      sim: 'rgba(0,170,255,0.15)',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 999,
  },
  fontSize: {
    xs: 9,
    sm: 11,
    md: 13,
    lg: 14,
    xl: 16,
    xxl: 18,
    title: 20,
  },
} as const;

export type ThemeColors = typeof THEME.colors;
export type AppConfig = typeof APP_CONFIG;
