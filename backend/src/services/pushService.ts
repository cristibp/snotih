import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

/**
 * Trimite o notificare push catre toate token-urile Expo valide.
 */
export async function sendPushToAll(tokens: string[], message: string): Promise<void> {
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

  if (validTokens.length === 0) {
    console.warn('Niciun token Expo valid gasit, nu se trimit notificari.');
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: 'Curs Valutar',
    body: message,
    data: { message },
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log('Tichete push primite:', tickets.length);
    } catch (error) {
      console.error('Eroare la trimiterea unui chunk de notificari push:', error);
    }
  }
}
