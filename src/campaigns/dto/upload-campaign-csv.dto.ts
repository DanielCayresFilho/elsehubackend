import { IsString, IsNotEmpty } from 'class-validator';

export class UploadCampaignCsvDto {
  @IsString()
  @IsNotEmpty()
  campaignId: string;
}

