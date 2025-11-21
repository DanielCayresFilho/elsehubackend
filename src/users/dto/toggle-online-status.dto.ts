import { IsBoolean } from 'class-validator';

export class ToggleOnlineStatusDto {
  @IsBoolean()
  isOnline: boolean;
}

