import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'Telefone deve estar no formato internacional (E.164)',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  additional1?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  additional2?: string | null;
}
