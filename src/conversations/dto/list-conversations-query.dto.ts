import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListConversationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;

  @IsOptional()
  @IsString()
  operatorId?: string;

  @IsOptional()
  @IsString()
  serviceInstanceId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

