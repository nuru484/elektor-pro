// src/utils/phoneValidation.ts
import { type CountryCode, parsePhoneNumberWithError } from 'libphonenumber-js';

import { ValidationError } from '../middlewares/error-handler.js';

interface IPhoneValidationResult {
  countryCode: string;
  e164Format: string;
  nationalFormat: string;
}

export const validateAndFormatPhone = (phoneInput: string, defaultCountry: CountryCode = 'GH'): IPhoneValidationResult => {
  if (!phoneInput || phoneInput.trim().length === 0) {
    throw new ValidationError('Phone number is required', {
      code: 'PHONE_REQUIRED',
      layer: 'validation',
    });
  }

  try {
    const phoneNumber = parsePhoneNumberWithError(phoneInput, defaultCountry);

    return {
      countryCode: phoneNumber.country || defaultCountry,
      e164Format: phoneNumber.format('E.164'),
      nationalFormat: phoneNumber.formatNational(),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError('Invalid phone number format', {
      code: 'INVALID_PHONE_FORMAT',
      context: {
        details: error instanceof Error ? error.message : String(error),
      },
      layer: 'validation',
    });
  }
};
