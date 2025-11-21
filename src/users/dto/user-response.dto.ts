import { Role } from '../../common/enums/role.enum';

export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  isOnline: boolean;
  onlineSince: Date | null;
  lastConversationAssignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
