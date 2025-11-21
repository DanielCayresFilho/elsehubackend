import { IsString, IsOptional } from 'class-validator';

export class UpdateTabulationDto {
  @IsString()
  @IsOptional()
  name?: string;
}

