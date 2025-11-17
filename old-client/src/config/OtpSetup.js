// src/config/OtpSetup.js
import ENV from "./env.js";

const apiKey = ENV.FROG_API_KEY;
const username = ENV.FROG_USERNAME;
const senderId = ENV.FROG_SENDER_ID;

const otpData = {
  expiry: 1,
  length: 6,
  messagetemplate:
    "Hello, your OTP is : %OTPCODE%. It will expire after %EXPIRY% mins",
  type: "NUMERIC",
  senderid: senderId,
};

export const sendOTP = async (phoneNumber) => {
  try {
    const response = await fetch(
      "https://frogapi.wigal.com.gh/api/v3/sms/otp/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-KEY": apiKey,
          USERNAME: username,
        },
        body: JSON.stringify({ ...otpData, number: phoneNumber }),
      }
    );
    const data = await response.json();

    console.log("OTP Response:", data);
    return data;
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
};

export const verifyOTP = async (otpcode, number) => {
  try {
    const response = await fetch(
      "https://frogapi.wigal.com.gh/api/v3/sms/otp/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-KEY": apiKey,
          USERNAME: username,
        },
        body: JSON.stringify({ otpcode, number }),
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
};
