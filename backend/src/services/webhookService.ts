import axios from 'axios';

const DISCORD_CONTENT_LIMIT = 2000;

export function splitDiscordContent(content: string): string[] {
  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > DISCORD_CONTENT_LIMIT) {
    const newline = remaining.lastIndexOf('\n', DISCORD_CONTENT_LIMIT - 1);
    let end = newline >= 0 ? newline + 1 : DISCORD_CONTENT_LIMIT;
    // Nu separam perechile UTF-16 folosite de emoji.
    const lastCodeUnit = remaining.charCodeAt(end - 1);
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }

  if (remaining || chunks.length === 0) chunks.push(remaining);
  return chunks;
}

export function describeWebhookError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const data = error.response?.data;
  // Nu includem configuratia Axios: contine URL-ul/token-ul si secretul proxy.
  return {
    message: error.message,
    status: error.response?.status,
    code: data?.code,
    upstreamMessage: typeof data === 'string' ? data.slice(0, 2000) : data?.message,
    errors: data?.errors,
  };
}

export async function sendRatesWebhook(
  webhookUrl: string,
  payload: Record<string, any>,
  chartBuffer: Buffer | null,
  headers: Record<string, string>
): Promise<{ chartAttached: boolean; webhookStatus: number }> {
  // Proxy-ul Discord foloseste /webhooks/... si adauga el prefixul /api.
  // Recunoastem si rutele directe /api/webhooks/... sau /api/v10/webhooks/...
  // pentru a aplica limita Discord indiferent de destinatie.
  // Webhook-urile generice pastreaza raportul JSON complet intr-o singura cerere.
  const isDiscord = /^\/(?:api\/(?:v\d+\/)?)?webhooks\//.test(new URL(webhookUrl).pathname);
  const contents = isDiscord && typeof payload.content === 'string'
    ? splitDiscordContent(payload.content)
    : [payload.content];
  let chartAttached = false;
  let webhookStatus = 200;

  for (const [index, content] of contents.entries()) {
    const messagePayload = { ...payload, content };
    if (index === 0 && chartBuffer) {
      try {
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(messagePayload));
        formData.append('files[0]', new Blob([chartBuffer], { type: 'image/png' }), 'chart.png');
        const response = await axios.post(webhookUrl, formData, { headers, timeout: 15000 });
        chartAttached = true;
        webhookStatus = response.status;
        continue;
      } catch (error) {
        console.warn(
          'Trimiterea webhook-ului cu fisier grafic atasat a esuat, se incearca fallback pe JSON simplu:',
          { ...describeWebhookError(error), contentLength: content?.length, chartBytes: chartBuffer.length }
        );
      }
    }

    // Fallback doar pentru mesajul curent; partile deja trimise nu se repeta.
    const response = await axios.post(webhookUrl, messagePayload, { headers, timeout: 10000 });
    webhookStatus = response.status;
  }

  return { chartAttached, webhookStatus };
}
