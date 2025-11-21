import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMessagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  conversationId?: string;
}

