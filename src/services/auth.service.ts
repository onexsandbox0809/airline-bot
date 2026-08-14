import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { Errors } from '../utils/errors';

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function signToken(userId: string, email: string) {
  return jwt.sign({ sub: userId, email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as any);
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw Errors.userExists();

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash,
      },
    });

    const token = signToken(user.id, user.email);
    return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) throw Errors.invalidCredentials();

    const match = await bcrypt.compare(input.password, user.passwordHash);
    if (!match) throw Errors.invalidCredentials();

    const token = signToken(user.id, user.email);
    return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Errors.unauthorized('User no longer exists.');
    return { id: user.id, name: user.name, email: user.email, phone: user.phone };
  },
};
