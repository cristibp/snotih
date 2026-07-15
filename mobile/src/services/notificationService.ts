import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/client';

// Controleaza cum se comporta o notificare primita cat timp aplicatia e deschisa.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Cere permisiunea pentru notificari, obtine ExpoPushToken-ul si il trimite
 * catre backend pentru a fi inregistrat in lista de token-uri.
 * @returns token-ul obtinut, sau null daca permisiunea a fost refuzata / ruleaza pe simulator/emulator.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Notificarile push functioneaza doar pe un device fizic.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Permisiunea pentru notificari nu a fost acordata.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;

  try {
    await registerPushToken(token);
  } catch (error) {
    console.error('Nu s-a putut inregistra token-ul pe backend:', error);
  }

  return token;
}
