import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DeviceProfile = 'allview' | 'phone' | 'tablet' | 'desktop';
export type DeviceOverride = 'auto' | 'allview' | 'phone' | 'tablet' | 'desktop';

export const DEVICE_OVERRIDE_STORAGE_KEY = '@snotih_device_override';

export interface HardwareInfo {
  brand: string;
  manufacturer: string;
  modelName: string;
  osName: string;
  deviceType: Device.DeviceType;
  isAllviewHardware: boolean;
  userAgent: string;
}

/**
 * Detectează dacă dispozitivul curent este un hardware Allview sau asociat
 * (Allview / Visual Fan / Viva / AX Series / Kiosk Allview)
 */
export function isAllviewDeviceIdentifier(brand?: string | null, manufacturer?: string | null, modelName?: string | null, ua?: string): boolean {
  const b = (brand || '').toLowerCase();
  const m = (manufacturer || '').toLowerCase();
  const model = (modelName || '').toLowerCase();
  const userAgent = (ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();

  // Allview este marca înregistrată a companiei Visual Fan SRL (Brașov, România)
  if (
    b.includes('allview') ||
    m.includes('allview') ||
    m.includes('visual fan') ||
    model.includes('allview') ||
    model.includes('viva') ||
    model.includes('ax4') ||
    model.includes('ax5')
  ) {
    return true;
  }

  // Verificare User-Agent pe web/browser
  if (
    userAgent.includes('allview') ||
    userAgent.includes('visual fan') ||
    userAgent.includes('viva_') ||
    userAgent.includes('viva ') ||
    userAgent.includes('viva-') ||
    userAgent.includes('ax4') ||
    userAgent.includes('ax5') ||
    userAgent.includes('alldrive')
  ) {
    return true;
  }

  return false;
}

/**
 * Extrage informațiile hardware disponibile prin expo-device și navigator
 */
export function getHardwareInfo(): HardwareInfo {
  const brand = Device.brand || '';
  const manufacturer = Device.manufacturer || '';
  const modelName = Device.modelName || '';
  const osName = Device.osName || '';
  const deviceType = Device.deviceType || Device.DeviceType.UNKNOWN;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const isAllview = isAllviewDeviceIdentifier(brand, manufacturer, modelName, userAgent);

  return {
    brand,
    manufacturer,
    modelName,
    osName,
    deviceType,
    isAllviewHardware: isAllview,
    userAgent,
  };
}

/**
 * Determină profilul dispozitivului pe baza dimensiunilor ecranului și a hardware-ului
 */
export function resolveDeviceProfile(
  width: number,
  height: number,
  hardware: HardwareInfo,
  override: DeviceOverride = 'auto'
): DeviceProfile {
  if (override !== 'auto') {
    return override;
  }

  // Dacă hardware-ul este identificat cert ca Allview
  if (hardware.isAllviewHardware) {
    return 'allview';
  }

  const isLandscape = width >= height;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  // Rezoluții clasice de tabletă Allview Kiosk (ex: 800x480, 800x420, 1024x600, 1280x800)
  // Dacă rulează în orientare landscape pe ecran de tabletă compactă cu aspect ratio 16:9 sau 16:10
  if (
    isLandscape &&
    minDim >= 380 &&
    minDim <= 620 &&
    maxDim >= 740 &&
    maxDim <= 1040 &&
    (hardware.osName.toLowerCase().includes('android') || hardware.userAgent.toLowerCase().includes('android'))
  ) {
    // Profil compatibil Allview Kiosk
    return 'allview';
  }

  // Dacă e telefon mobil (în modul portrait lățimea e de regulă sub 680px)
  if (width < 680 && !isLandscape) {
    return 'phone';
  }

  // Telefon în modul landscape (înălțime mică sub 500px, lățime sub 950px, ecran alungit)
  if (isLandscape && height < 460 && width < 960 && (maxDim / minDim > 1.85)) {
    return 'phone';
  }

  // Tabletă (lățime între 680px și 1080px sau tip TABLET identificat)
  if (hardware.deviceType === Device.DeviceType.TABLET || (width >= 680 && width <= 1080)) {
    return 'tablet';
  }

  // Desktop / Ecran mare
  if (width > 1080) {
    return 'desktop';
  }

  return 'phone';
}

/**
 * Citește override-ul salvat din storage
 */
export async function loadDeviceOverride(): Promise<DeviceOverride> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(DEVICE_OVERRIDE_STORAGE_KEY);
      if (stored === 'auto' || stored === 'allview' || stored === 'phone' || stored === 'tablet' || stored === 'desktop') {
        return stored;
      }
    }
    const val = await AsyncStorage.getItem(DEVICE_OVERRIDE_STORAGE_KEY);
    if (val === 'auto' || val === 'allview' || val === 'phone' || val === 'tablet' || val === 'desktop') {
      return val;
    }
  } catch (e) {
    // fallback auto
  }
  return 'auto';
}

/**
 * Salvează override-ul în storage
 */
export async function saveDeviceOverride(override: DeviceOverride): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEVICE_OVERRIDE_STORAGE_KEY, override);
    }
    await AsyncStorage.setItem(DEVICE_OVERRIDE_STORAGE_KEY, override);
  } catch (e) {
    console.warn('Nu s-a putut salva device override:', e);
  }
}
