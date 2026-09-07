export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  nav: string;
  navBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  divider: string;
  segmentBackground: string;
  segmentActive: string;
  segmentText: string;
  segmentTextActive: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  chipBackground: string;
  chipBorder: string;
  chipText: string;
  chipRemoveBtn: string;
  chipRemoveText: string;
  modalOverlay: string;
  modalContent: string;
  modalHeaderBorder: string;
  optionItemActive: string;
  optionText: string;
  optionTextActive: string;
  chartBackground: string;
  chartLines: string;
  chartLabel: string;
  chartDotFill: string;
  statusBar: 'light-content' | 'dark-content';
  primary: string;
  accentPurple: string;
  accentBlue: string;
  accentIndigo: string;
  danger: string;
  success: string;
  tierOverboughtBg: string;
  tierOversoldBg: string;
  tierNeutralBg: string;
  tierBullishBg: string;
  tierBearishBg: string;
  tierOverboughtText: string;
  tierOversoldText: string;
  tierNeutralText: string;
  tierBullishText: string;
  tierBearishText: string;
  progressBarBg: string;
  legendCardBg: string;
  actionCardBg: string;
  responseBannerBg: string;
  responseBannerBorder: string;
  responseTitle: string;
  responseText: string;
  errorBoxBg: string;
  errorBoxBorder: string;
  errorBoxText: string;
  toggleBtnBg: string;
  toggleBtnBorder: string;
}

export const lightColors: ThemeColors = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  cardBorder: '#E5E7EB',
  nav: '#FFFFFF',
  navBorder: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F0F0F0',
  segmentBackground: '#F3F4F6',
  segmentActive: '#FFFFFF',
  segmentText: '#6B7280',
  segmentTextActive: '#111827',
  inputBackground: '#F9FAFB',
  inputBorder: '#D1D5DB',
  inputText: '#111827',
  inputPlaceholder: '#9CA3AF',
  chipBackground: '#F3F4F6',
  chipBorder: '#D1D5DB',
  chipText: '#1F2937',
  chipRemoveBtn: '#E5E7EB',
  chipRemoveText: '#4B5563',
  modalOverlay: 'rgba(0, 0, 0, 0.4)',
  modalContent: '#FFFFFF',
  modalHeaderBorder: '#F3F4F6',
  optionItemActive: '#F0FDF4',
  optionText: '#374151',
  optionTextActive: '#2E7D32',
  chartBackground: '#FFFFFF',
  chartLines: '#F0F0F0',
  chartLabel: 'rgba(75, 85, 99, 1)',
  chartDotFill: '#FFFFFF',
  statusBar: 'dark-content',
  primary: '#2E7D32',
  accentPurple: '#8B5CF6',
  accentBlue: '#1D4ED8',
  accentIndigo: '#4F46E5',
  danger: '#DC2626',
  success: '#10B981',
  tierOverboughtBg: '#FEE2E2',
  tierOversoldBg: '#D1FAE5',
  tierNeutralBg: '#F3F4F6',
  tierBullishBg: '#DBEAFE',
  tierBearishBg: '#FFEDD5',
  tierOverboughtText: '#B91C1C',
  tierOversoldText: '#047857',
  tierNeutralText: '#4B5563',
  tierBullishText: '#1D4ED8',
  tierBearishText: '#C2410C',
  progressBarBg: '#E5E7EB',
  legendCardBg: '#FFFFFF',
  actionCardBg: '#FFFFFF',
  responseBannerBg: '#F8FAFC',
  responseBannerBorder: '#2563EB',
  responseTitle: '#1E293B',
  responseText: '#475569',
  errorBoxBg: '#FEE2E2',
  errorBoxBorder: '#FCA5A5',
  errorBoxText: '#B91C1C',
  toggleBtnBg: '#F3F4F6',
  toggleBtnBorder: '#E5E7EB',
};

export const blackColors: ThemeColors = {
  background: '#000000',
  card: '#121212',
  cardBorder: '#262626',
  nav: '#0A0A0A',
  navBorder: '#222222',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
  border: '#262626',
  divider: '#1F1F1F',
  segmentBackground: '#161618',
  segmentActive: '#27272A',
  segmentText: '#9CA3AF',
  segmentTextActive: '#FFFFFF',
  inputBackground: '#161618',
  inputBorder: '#333338',
  inputText: '#F9FAFB',
  inputPlaceholder: '#6B7280',
  chipBackground: '#1C1C1F',
  chipBorder: '#333338',
  chipText: '#E5E7EB',
  chipRemoveBtn: '#2E2E33',
  chipRemoveText: '#A1A1AA',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  modalContent: '#161618',
  modalHeaderBorder: '#262626',
  optionItemActive: '#064E3B',
  optionText: '#D1D5DB',
  optionTextActive: '#34D399',
  chartBackground: '#121212',
  chartLines: '#222222',
  chartLabel: 'rgba(156, 163, 175, 1)',
  chartDotFill: '#121212',
  statusBar: 'light-content',
  primary: '#22C55E',
  accentPurple: '#A78BFA',
  accentBlue: '#3B82F6',
  accentIndigo: '#6366F1',
  danger: '#F87171',
  success: '#34D399',
  tierOverboughtBg: 'rgba(239, 68, 68, 0.2)',
  tierOversoldBg: 'rgba(16, 185, 129, 0.2)',
  tierNeutralBg: 'rgba(107, 114, 128, 0.2)',
  tierBullishBg: 'rgba(59, 130, 246, 0.2)',
  tierBearishBg: 'rgba(249, 115, 22, 0.2)',
  tierOverboughtText: '#F87171',
  tierOversoldText: '#34D399',
  tierNeutralText: '#9CA3AF',
  tierBullishText: '#60A5FA',
  tierBearishText: '#FB923C',
  progressBarBg: '#27272A',
  legendCardBg: '#121212',
  actionCardBg: '#121212',
  responseBannerBg: '#16161A',
  responseBannerBorder: '#3B82F6',
  responseTitle: '#F1F5F9',
  responseText: '#94A3B8',
  errorBoxBg: 'rgba(239, 68, 68, 0.15)',
  errorBoxBorder: '#7F1D1D',
  errorBoxText: '#FCA5A5',
  toggleBtnBg: '#1E1E22',
  toggleBtnBorder: '#333338',
};
