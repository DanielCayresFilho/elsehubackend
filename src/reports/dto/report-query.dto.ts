import { IsOptional, IsDateString, IsString } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  operatorId?: string;

  @IsOptional()
  @IsString()
  tabulationId?: string;

  @IsOptional()
  @IsString()
  serviceInstanceId?: string;
}

