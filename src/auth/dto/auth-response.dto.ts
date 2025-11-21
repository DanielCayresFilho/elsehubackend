import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export class AuthResponseDto {
  user: UserResponseDto;
  tokens: AuthTokensDto;
}
