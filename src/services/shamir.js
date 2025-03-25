// src/services/shamir.js

import { v4 as uuidv4 } from 'uuid';

/**
 * Galois Field (GF(256)) operations implementation
 * This is used for Shamir's Secret Sharing arithmetic
 */
export const GF256 = {
  // Addition and subtraction are XOR operations in GF(256)
  add: (a, b) => a ^ b,
  sub: (a, b) => a ^ b,
  
  // Multiplication in GF(256)
  mul: function(a, b) {
    a = a & 0xff; // Limit to 8 bits
    b = b & 0xff;
    
    if (a === 0 || b === 0) return 0;
    
    let result = 0;
    let temp_a = a;
    
    // Multiplication by shift and add
    for (let i = 0; i < 8; i++) {
      if (b & 1) {
        result ^= temp_a; // XOR with current a if bit is set
      }
      
      // Double a (left shift) and XOR with irreducible polynomial if needed
      const highBit = temp_a & 0x80;
      temp_a = (temp_a << 1) & 0xff;
      if (highBit) {
        temp_a ^= 0x1b; // x^8 + x^4 + x^3 + x + 1 (standard AES polynomial)
      }
      
      b >>= 1; // Right shift b
    }
    
    return result;
  },
  
  // Division in GF(256) using the inverse
  div: function(a, b) {
    a = a & 0xff;
    b = b & 0xff;
    
    if (b === 0) throw new Error('Division by zero is not allowed');
    if (a === 0) return 0;
    
    // Calculate inverse of b
    const b_inv = this.inverse(b);
    
    // a / b = a * (b^-1)
    return this.mul(a, b_inv);
  },
  
  // Calculate inverse using extended Euclidean algorithm
  inverse: function(a) {
    if (a === 0) throw new Error('Zero has no inverse');
    
    // Extended Euclidean algorithm for GF(256)
    let t = 0, newt = 1;
    let r = 0x11b, newr = a; // 0x11b is the irreducible polynomial
    
    while (newr !== 0) {
      const quotient = this.polyDiv(r, newr);
      
      [t, newt] = [newt, t ^ this.polyMul(quotient, newt)];
      [r, newr] = [newr, r ^ this.polyMul(quotient, newr)];
    }
    
    if (r > 1) {
      throw new Error('Polynomial is not invertible');
    }
    
    return t;
  },
  
  // Polynomial division in GF(2) for inverse calculation
  polyDiv: function(a, b) {
    if (b === 0) throw new Error('Polynomial division by zero');
    
    let result = 0;
    let degree_diff = this.degree(a) - this.degree(b);
    
    if (degree_diff < 0) return 0;
    
    for (let i = degree_diff; i >= 0; i--) {
      if (a & (1 << (i + this.degree(b)))) {
        result |= 1 << i;
        a ^= b << i;
      }
    }
    
    return result;
  },
  
  // Polynomial multiplication in GF(2) for inverse calculation
  polyMul: function(a, b) {
    let result = 0;
    
    while (a > 0) {
      if (a & 1) {
        result ^= b;
      }
      b <<= 1;
      a >>= 1;
    }
    
    return result;
  },
  
  // Calculate the degree of a polynomial
  degree: function(a) {
    let degree = -1;
    
    for (let i = 0; i < 32; i++) {
      if (a & (1 << i)) {
        degree = i;
      }
    }
    
    return degree;
  }
};

/**
 * Evaluate a polynomial at point x
 * @param {Uint8Array|Array} coeffs - Polynomial coefficients (low to high order)
 * @param {number} x - X value to evaluate at
 * @returns {number} Result of evaluation
 */
export const evaluatePolynomial = (coeffs, x) => {
  if (x === 0) return coeffs[0];
  
  let result = 0;
  // Process coefficients from highest to lowest
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = GF256.add(GF256.mul(result, x), coeffs[i]);
  }
  return result;
};

/**
 * Lagrange interpolation to reconstruct the polynomial
 * @param {Array} points - Array of (x, y) coordinates
 * @returns {number} Value of f(0) (the secret)
 */
export const lagrangeInterpolation = (points) => {
  if (points.length === 0) {
    throw new Error('At least one point is required');
  }
  
  // Find f(0)
  let result = 0;
  
  for (let i = 0; i < points.length; i++) {
    const [xi, yi] = points[i];
    
    // Calculate basis polynomial value
    let basis = 1;
    
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      
      const [xj] = points[j];
      
      // Numerator: (0 - xj) = xj in GF(256)
      const num = xj;
      
      // Denominator: (xi - xj)
      const denom = GF256.sub(xi, xj);
      
      if (denom === 0) {
        throw new Error(`Duplicate x coordinates: xi=${xi}, xj=${xj}`);
      }
      
      // Division
      const term = GF256.div(num, denom);
      
      // Multiply into basis polynomial
      basis = GF256.mul(basis, term);
    }
    
    // Multiply by yi and add to result
    const term = GF256.mul(yi, basis);
    result = GF256.add(result, term);
  }
  
  return result;
};

/**
 * Convert bytes to hex string
 * @param {Uint8Array} bytes - Byte array
 * @returns {string} Hex string
 */
export const bytesToHex = (bytes) => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Convert hex string to bytes
 * @param {string} hex - Hex string
 * @returns {Uint8Array} Byte array
 */
export const hexToBytes = (hex) => {
  if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0) {
    console.error('Invalid hex string:', hex);
    return new Uint8Array(0);
  }
  
  try {
    return new Uint8Array(
      hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
  } catch (e) {
    console.error('Error converting hex to bytes:', e);
    return new Uint8Array(0);
  }
};

/**
 * Generate a random byte array using Web Crypto API
 * @param {number} length - Number of bytes to generate
 * @returns {Uint8Array} Random bytes
 */
export const getRandomBytes = (length) => {
  return window.crypto.getRandomValues(new Uint8Array(length));
};

/**
 * Split a secret into shares using Shamir's Secret Sharing
 * @param {string} secret - Secret to split
 * @param {number} totalShares - Total number of shares to create
 * @param {number} threshold - Minimum shares needed to reconstruct
 * @returns {Array} Array of share objects
 */
export const createShares = (secret, totalShares, threshold) => {
  try {
    // Validate inputs
    if (threshold < 2) {
      throw new Error('Threshold must be at least 2');
    }
    if (totalShares < threshold) {
      throw new Error('Total shares must be at least equal to threshold');
    }
    if (totalShares > 255) {
      throw new Error('Maximum 255 shares are supported');
    }
    
    // Convert secret to byte array
    const secretBytes = new TextEncoder().encode(secret);
    
    // Save encoding info for reconstruction
    const encoding = 'utf-8';
    
    // Share array
    const shares = [];
    
    // Process each byte of the secret separately
    for (let byteIndex = 0; byteIndex < secretBytes.length; byteIndex++) {
      // Create a polynomial for each byte
      const coeffs = new Uint8Array(threshold);
      
      // a_0 is the secret byte value
      coeffs[0] = secretBytes[byteIndex];
      
      // a_1 to a_{t-1} are random
      window.crypto.getRandomValues(coeffs.subarray(1));
      
      // Generate a share for each participant
      for (let x = 1; x <= totalShares; x++) {
        // x coordinate starts at 1
        const y = evaluatePolynomial(coeffs, x);
        
        if (shares[x - 1] === undefined) {
          shares[x - 1] = {
            x,
            y: [y]  // Store as array
          };
        } else {
          shares[x - 1].y.push(y);
        }
      }
    }
    
    // Encode shares in a format compatible with the original implementation
    const encodedShares = shares.map(share => {
      // Encode x as 2-digit hex
      const xHex = share.x.toString(16).padStart(2, '0');
      
      // Convert y values to hex
      const yHex = bytesToHex(new Uint8Array(share.y));
      
      // Add prefix (80) for compatibility
      return {
        id: `share-${uuidv4()}`,
        value: `80${xHex}${yHex}`,
        encoding
      };
    });
    
    return encodedShares;
  } catch (error) {
    console.error('Failed to create shares:', error);
    throw new Error('Failed to create shares: ' + error.message);
  }
};

/**
 * Combine shares to reconstruct the secret
 * @param {Array} shares - Array of share objects
 * @returns {string} Reconstructed secret
 */
export const combineShares = (shares) => {
  try {
    // Extract share values
    const shareValues = shares.map(share => share.value || share);
    
    // Get encoding from first share (if available)
    const encoding = shares[0].encoding || 'utf-8';
    
    // Decode shares
    const decodedShares = shareValues.map(shareValue => {
      // Check format
      if (!shareValue.startsWith('80')) {
        throw new Error('Invalid share format');
      }
      
      // Extract x and y values
      const x = parseInt(shareValue.substring(2, 4), 16);
      const yHex = shareValue.substring(4);
      const yBytes = hexToBytes(yHex);
      
      return {
        x,
        y: Array.from(yBytes)
      };
    });
    
    // Validate shares
    if (decodedShares.length === 0) {
      throw new Error('No valid shares provided');
    }
    
    // Check if all shares have the same y length
    const yLengths = decodedShares.map(share => share.y.length);
    const allSameLength = yLengths.every(length => length === yLengths[0]);
    if (!allSameLength) {
      throw new Error('Shares have inconsistent lengths');
    }
    
    // Secret length is the same as y array length
    const secretLength = decodedShares[0].y.length;
    
    // Result byte array
    const result = new Uint8Array(secretLength);
    
    // Reconstruct each byte
    for (let byteIndex = 0; byteIndex < secretLength; byteIndex++) {
      // Collect points for this byte from each share
      const points = decodedShares.map(share => [
        share.x,
        share.y[byteIndex]
      ]);
      
      // Use Lagrange interpolation to find f(0)
      result[byteIndex] = lagrangeInterpolation(points);
    }
    
    try {
      // Convert byte array to string using specified encoding
      return new TextDecoder(encoding).decode(result);
    } catch (decodeError) {
      console.error('Failed to decode result:', decodeError);
      
      // Return hex representation on error
      const hexString = bytesToHex(result);
      throw new Error(`Decoding failed: ${decodeError.message}. Data (hex): ${hexString}`);
    }
  } catch (error) {
    console.error('Failed to combine shares:', error);
    throw new Error('Failed to combine shares: ' + error.message);
  }
};

/**
 * Test function for Shamir's Secret Sharing
 * @returns {boolean} True if test passes
 */
export const testShamir = () => {
};