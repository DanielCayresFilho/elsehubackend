import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Formato E.164 estrito: + seguido de 1-9 e depois 10-14 dígitos
const PHONE_REGEX = /^\+[1-9]\d{10,14}$/;

export class CreateContactDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'Telefone deve estar no formato internacional (E.164)',
  })
  phone: string;

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
