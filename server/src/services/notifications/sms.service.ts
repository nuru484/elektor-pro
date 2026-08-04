// src/services/notifications/sms.service.ts
// SMS delivery. In `mock` mode (default for dev/test) the message is logged
// instead of sent, so no real SMS is spent. In `live` mode it is sent via the
// Wigal FROG gateway.
import ENV from '../../config/env.js';
import logger from '../../utils/logger.js';

const FROG_SEND_URL = 'https://frogapi.wigal.com.gh/api/v3/sms/send';

export interface SmsResult {
  delivered: boolean;
  provider: 'frog' | 'mock';
}

export const sendSms = async (
  to: string,
  message: string,
): Promise<SmsResult> => {
  if (ENV.OTP_MODE === 'mock' || !ENV.FROG_API_KEY) {
    logger.info({ message, to }, '[SMS mock] message not actually sent');
    return { delivered: true, provider: 'mock' };
  }

  try {
    const response = await fetch(FROG_SEND_URL, {
      body: JSON.stringify({
        destinations: [{ destination: to, message }],
        senderid: ENV.FROG_SENDER_ID,
      }),
      headers: {
        'API-KEY': ENV.FROG_API_KEY,
        'Content-Type': 'application/json',
        USERNAME: ENV.FROG_USERNAME,
      },
      method: 'POST',
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger.error({ data, status: response.status }, 'SMS send failed');
      return { delivered: false, provider: 'frog' };
    }
    return { delivered: true, provider: 'frog' };
  } catch (error) {
    logger.error(error, 'SMS send threw');
    return { delivered: false, provider: 'frog' };
  }
};
