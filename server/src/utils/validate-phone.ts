// src/utils/phoneValidation.ts
import { parsePhoneNumberWithError, type CountryCode } from 'libphonenumber-js';
import { ValidationError } from '../middlewares/error-handler.js';

interface IPhoneValidationResult {
  e164Format: string;
  nationalFormat: string;
  countryCode: string;
}

export const validateAndFormatPhone = (phoneInput: string, defaultCountry: CountryCode = 'GH'): IPhoneValidationResult => {
  if (!phoneInput || phoneInput.trim().length === 0) {
    throw new ValidationError('Phone number is required', {
      layer: 'validation',
      code: 'PHONE_REQUIRED',
    });
  }

  try {
    const phoneNumber = parsePhoneNumberWithError(phoneInput, defaultCountry);

    return {
      e164Format: phoneNumber.format('E.164'),
      nationalFormat: phoneNumber.formatNational(),
      countryCode: phoneNumber.country || defaultCountry,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError('Invalid phone number format', {
      layer: 'validation',
      code: 'INVALID_PHONE_FORMAT',
      context: {
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
