import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPin(pin) {
  return bcrypt.hash(String(pin), SALT_ROUNDS);
}

export async function verifyPin(pin, hash) {
  return bcrypt.compare(String(pin), hash);
}
