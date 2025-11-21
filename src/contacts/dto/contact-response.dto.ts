export class ContactResponseDto {
  id: string;
  name: string;
  phone: string;
  cpf?: string | null;
  additional1?: string | null;
  additional2?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
