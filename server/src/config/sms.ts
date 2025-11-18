// src/config/sms.ts
import ENV from './env.js';

const apiKey = ENV.FROG_API_KEY;
const username = ENV.FROG_USERNAME;
const senderId = ENV.FROG_SENDER_ID;

const otpData = {
  expiry: 5,
  length: 6,
  messagetemplate:
    'Elektor Pro: Your verification code is %OTPCODE%. This code will expire in %EXPIRY% minutes. If you did not request this code, please disregard this message.',
  type: 'NUMERIC',
  senderid: senderId,
};

export const sendOTP = async (phoneNumber: number) => {
  try {
    const response = await fetch('https://frogapi.wigal.com.gh/api/v3/sms/otp/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': apiKey,
        USERNAME: username,
      },
      body: JSON.stringify({ ...otpData, number: phoneNumber }),
    });
    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

export const verifyOTP = async (otpcode: number, number: number) => {
  try {
    const response = await fetch('https://frogapi.wigal.com.gh/api/v3/sms/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': apiKey,
        USERNAME: username,
      },
      body: JSON.stringify({ otpcode, number }),
    });

    if (!response.ok) {
      throw new Error(`SMS API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};
