import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '@repo/db';
import { Repository } from 'typeorm';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';
import { PASSWORD_MAX, PASSWORD_MIN } from './auth.constants';
import type { AuthUser } from './auth.decorators';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  private validate(email: unknown, password: unknown) {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new BadRequestException('email and password are required');
    }
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
      throw new BadRequestException('Invalid email');
    }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      throw new BadRequestException(
        `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`,
      );
    }
    return { email: normalized, password };
  }

  async register(rawEmail: unknown, rawPassword: unknown) {
    const { email, password } = this.validate(rawEmail, rawPassword);
    if (await this.users.existsBy({ email })) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.users.save(
      this.users.create({ email, passwordHash: await hashPassword(password) }),
    );
    return this.issue({ id: user.id, email: user.email });
  }

  async login(rawEmail: unknown, rawPassword: unknown) {
    if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
      throw new UnauthorizedException('Invalid email or password');
    }
    const email = rawEmail.trim().toLowerCase();
    const user = await this.users.findOne({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
    // Always run one hash so response time does not reveal whether the email exists.
    const ok = await verifyPassword(
      rawPassword,
      user?.passwordHash ?? (await DUMMY_HASH),
    );
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue({ id: user.id, email: user.email });
  }

  private async issue(user: AuthUser) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user, token };
  }
}
