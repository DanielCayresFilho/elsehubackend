import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTabulationDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

