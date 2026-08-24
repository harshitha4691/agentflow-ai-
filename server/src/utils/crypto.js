const crypto = require('crypto');
const env = require('../config/env');

function encryptionKey() {
  const source = env.credentialEncryptionKey || env.jwtSecret;
  return crypto.createHash('sha256').update(source).digest();
}

function encrypt(value = '') {
  if (!value) return '';
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decrypt(payload = '') {
  if (!payload) return '';
  const [ivHex, tagHex, ciphertext] = payload.split(':');
  if (!ivHex || !tagHex || !ciphertext) return '';
  const key = encryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
