import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  DeviceOverride,
  DeviceProfile,
  getHardwareInfo,
  HardwareInfo,
  loadDeviceOverride,
  resolveDeviceProfile,
  saveDeviceOverride,
} from '../services/deviceDetection';

export interface DeviceContextType {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  isPortrait: boolean;
  isLandscape: boolean;
  isAllview: boolean;
  isMobile: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  activeProfile: DeviceProfile;
  deviceOverride: DeviceOverride;
  setDeviceOverride: (override: DeviceOverride) => void;
  cycleDeviceProfile: () => void;
  hardware: HardwareInfo;
  profileLabel: string;
  profileShortLabel: string;
  profileIcon: string;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [deviceOverride, setDeviceOverrideState] = useState<DeviceOverride>('auto');
  const [hardware] = useState<HardwareInfo>(() => getHardwareInfo());

  // Incarcare configuratie salvata
  useEffect(() => {
    let isMounted = true;
    loadDeviceOverride().then((saved) => {
      if (isMounted && saved) {
        setDeviceOverrideState(saved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setDeviceOverride = (newOverride: DeviceOverride) => {
    setDeviceOverrideState(newOverride);
    saveDeviceOverride(newOverride);
  };

  const isLandscape = width >= height;
  const isPortrait = !isLandscape;

  const activeProfile = useMemo(() => {
    return resolveDeviceProfile(width, height, hardware, deviceOverride);
  }, [width, height, hardware, deviceOverride]);

  const isAllview = activeProfile === 'allview';
  const isPhone = activeProfile === 'phone';
  const isTablet = activeProfile === 'tablet' || activeProfile === 'allview';
  const isDesktop = activeProfile === 'desktop';
  const isMobile = isPhone || (width < 680 && !isAllview);

  const { profileLabel, profileShortLabel, profileIcon } = useMemo(() => {
    switch (activeProfile) {
      case 'allview':
        return {
          profileLabel: 'Allview Kiosk',
          profileShortLabel: 'Allview',
          profileIcon: '📟',
        };
      case 'phone':
        return {
          profileLabel: 'Telefon Mobil',
          profileShortLabel: 'Mobil',
          profileIcon: '📱',
        };
      case 'tablet':
        return {
          profileLabel: 'Tabletă',
          profileShortLabel: 'Tabletă',
          profileIcon: '📋',
        };
      case 'desktop':
      default:
        return {
          profileLabel: 'Desktop / PC',
          profileShortLabel: 'Desktop',
          profileIcon: '💻',
        };
    }
  }, [activeProfile]);

  const cycleDeviceProfile = () => {
    const sequence: DeviceOverride[] = ['auto', 'allview', 'phone', 'tablet', 'desktop'];
    const currentIdx = sequence.indexOf(deviceOverride);
    const nextIdx = (currentIdx + 1) % sequence.length;
    setDeviceOverride(sequence[nextIdx]);
  };

  const contextValue: DeviceContextType = {
    width,
    height,
    orientation: isLandscape ? 'landscape' : 'portrait',
    isPortrait,
    isLandscape,
    isAllview,
    isMobile,
    isPhone,
    isTablet,
    isDesktop,
    activeProfile,
    deviceOverride,
    setDeviceOverride,
    cycleDeviceProfile,
    hardware,
    profileLabel,
    profileShortLabel,
    profileIcon,
  };

  return <DeviceContext.Provider value={contextValue}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceContextType {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice trebuie folosit in interiorul unui DeviceProvider');
  }
  return context;
}
