// src/utils/validationRules.js
// Enterprise Live Input Validation Suite for Indian Logistics & Regulatory Compliance 🇮🇳🛡️

/**
 * Validates 10-digit Indian Mobile Number
 * e.g. 9823012345, 7020112233
 */
export const validateMobile = (mobile) => {
  if (!mobile) return { valid: false, message: 'Mobile number is required.' };
  const clean = String(mobile).replace(/[\s\-+]/g, '');
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(clean)) {
    return { valid: false, message: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' };
  }
  return { valid: true, clean };
};

/**
 * Validates Indian Motor Vehicle Registration Number
 * e.g. MH31FC4512, MH-31-FC-4512, MP09AB1234, DL01A1234
 */
export const validateVehicleNo = (vehicleNo) => {
  if (!vehicleNo) return { valid: false, message: 'Vehicle truck number is required.' };
  const clean = String(vehicleNo).toUpperCase().replace(/[\s\-]/g, '');
  const vehicleRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
  if (!vehicleRegex.test(clean)) {
    return { valid: false, message: 'Enter a valid Indian vehicle number (e.g. MH31FC4512 or MH-31-FC-4512).' };
  }
  return { valid: true, clean };
};

/**
 * Validates 6-digit Indian Postal PIN Code
 * e.g. 440028, 400001
 */
export const validatePincode = (pincode) => {
  if (!pincode) return { valid: false, message: 'PIN code is required.' };
  const clean = String(pincode).trim();
  const pinRegex = /^[1-9][0-9]{5}$/;
  if (!pinRegex.test(clean)) {
    return { valid: false, message: 'Enter a valid 6-digit Indian PIN code (e.g. 440028).' };
  }
  return { valid: true, clean };
};

/**
 * Validates 15-character Indian GSTIN Number
 * e.g. 27AAPCS1419M1ZV
 */
export const validateGSTIN = (gstin) => {
  if (!gstin) return { valid: false, message: 'GSTIN number is required.' };
  const clean = String(gstin).toUpperCase().trim();
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(clean)) {
    return { valid: false, message: 'Enter a valid 15-character Indian GSTIN (e.g. 27AAPCS1419M1ZV).' };
  }
  return { valid: true, clean };
};

/**
 * Validates 10-character Indian PAN Number
 * e.g. AAPCS1419M
 */
export const validatePAN = (pan) => {
  if (!pan) return { valid: false, message: 'PAN number is required.' };
  const clean = String(pan).toUpperCase().trim();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(clean)) {
    return { valid: false, message: 'Enter a valid 10-character Indian PAN (e.g. AAPCS1419M).' };
  }
  return { valid: true, clean };
};

/**
 * Validates Person Name (Min 2 chars, letters, spaces, dots)
 * e.g. Rajesh Kumar, S. K. Sharma
 */
export const validateName = (name) => {
  if (!name) return { valid: false, message: 'Name is required.' };
  const clean = String(name).trim();
  if (clean.length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters long.' };
  }
  const nameRegex = /^[a-zA-Z\s\.\,\'\-]+$/;
  if (!nameRegex.test(clean)) {
    return { valid: false, message: 'Name should only contain letters and standard characters.' };
  }
  return { valid: true, clean };
};

/**
 * Validates Email Address
 */
export const validateEmail = (email) => {
  if (!email) return { valid: false, message: 'Email address is required.' };
  const clean = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, message: 'Enter a valid email address (e.g. logistics@shalimar.com).' };
  }
  return { valid: true, clean };
};
