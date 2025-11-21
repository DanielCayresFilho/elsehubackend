import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { JwtFromRequestFunction, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtFromRequest: JwtFromRequestFunction = (req: Request) => {
      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        return null;
      }
      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) {
        return null;
      }
      return token;
    };

    const accessSecret = configService.get<string>('jwt.access.secret');

    if (!accessSecret) {
      throw new Error('JWT access secret não configurado');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    console.log('[JWT] Validating payload:', { sub: payload.sub, email: payload.email });
    
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      console.log('[JWT] User not found:', payload.sub);
      throw new UnauthorizedException('Usuário inexistente');
    }

    if (!user.isActive) {
      console.log('[JWT] User inactive:', user.email);
      throw new UnauthorizedException('Usuário inativo');
    }

    console.log('[JWT] User validated:', user.email);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
