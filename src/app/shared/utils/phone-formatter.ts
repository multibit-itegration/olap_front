/**
 * Phone formatter utility for Russian phone numbers (+7XXXXXXXXXX format)
 */

export interface PhoneFormatResult {
  displayValue: string;
  rawValue: string;
}

/**
 * Formats phone input for login (compact format: +7XXXXXXXXXX)
 * @param input - The raw input value
 * @returns Formatted phone object with display and raw values
 */
export function formatPhoneForLogin(input: string): PhoneFormatResult {
  let value = input.replace(/\D/g, '');

  // Ensure it starts with 7
  if (value.length > 0 && value[0] !== '7') {
    value = '7' + value;
  }

  // Limit to 11 digits (7 + 10 digits)
  if (value.length > 11) {
    value = value.slice(0, 11);
  }

  // Format as +7XXXXXXXXXX
  const formatted = value.length > 0 ? '+' + value : '';

  return {
    displayValue: formatted,
    rawValue: formatted
  };
}

/**
 * Formats phone input for registration (spaced format: +7 XXX XXX XX XX)
 * @param input - The raw input value
 * @returns Formatted phone object with display and raw values
 */
export function formatPhoneForRegister(input: string): PhoneFormatResult {
  let value = input.replace(/\D/g, '');

  // Ensure it starts with 7
  if (value.length > 0 && value[0] !== '7') {
    value = '7' + value;
  }

  // Limit to 11 digits (7 + 10 digits)
  if (value.length > 11) {
    value = value.slice(0, 11);
  }

  // Format with spaces: +7 XXX XXX XX XX
  let formatted = '';
  if (value.length > 0) {
    formatted = '+7';
    if (value.length > 1) {
      formatted += ' ' + value.slice(1, 4);
    }
    if (value.length > 4) {
      formatted += ' ' + value.slice(4, 7);
    }
    if (value.length > 7) {
      formatted += ' ' + value.slice(7, 9);
    }
    if (value.length > 9) {
      formatted += ' ' + value.slice(9, 11);
    }
  }

  // Raw value for validation (no spaces)
  const rawPhone = value.length > 0 ? '+' + value : '';

  return {
    displayValue: formatted,
    rawValue: rawPhone
  };
}
