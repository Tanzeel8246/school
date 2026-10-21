import bcrypt from 'bcryptjs';

const COST = 12; // blueprint §3 — bcrypt cost >= 12

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
