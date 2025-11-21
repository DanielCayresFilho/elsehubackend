import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async login(payload: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.usersService.toResponse(user),
      tokens,
    };
  }

  async refreshTokens(payload: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(
        payload.refreshToken,
        {
          secret: this.configService.get<string>('jwt.refresh.secret'),
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.active) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      const tokens = await this.generateTokens(user);

      return {
        user: this.usersService.toResponse(user),
        tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido ou expirado', {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return this.usersService.toResponse(user);
  }

  private async generateTokens(user: User): Promise<AuthTokensDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessExpires = this.configService.get<string>(
      'jwt.access.expiresIn',
    ) ?? '900s';
    const refreshExpires = this.configService.get<string>(
      'jwt.refresh.expiresIn',
    ) ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.access.secret') ?? 'change-me-access',
        expiresIn: accessExpires as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refresh.secret') ?? 'change-me-refresh',
        expiresIn: refreshExpires as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessExpires,
      refreshTokenExpiresIn: refreshExpires,
    };
  }
}
