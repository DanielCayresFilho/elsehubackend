import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
