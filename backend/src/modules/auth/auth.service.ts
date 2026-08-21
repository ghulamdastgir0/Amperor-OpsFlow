import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

interface Authenticatable {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.tenantId, dto.email);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash ?? '',
    );
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    return this.buildAuthResult(user);
  }

  buildAuthResult(user: Authenticatable) {
    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return { accessToken: this.jwtService.sign(payload), user: payload };
  }

  issueToken(user: Authenticatable) {
    return this.buildAuthResult(user).accessToken;
  }
}
