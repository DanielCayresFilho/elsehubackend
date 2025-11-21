import { CampaignStatus } from '@prisma/client';

export class CampaignResponseDto {
  id: string;
  name: string;
  serviceInstanceId: string;
  serviceInstanceName?: string;
  templateId: string | null;
  templateName?: string | null;
  supervisorId: string;
  supervisorName?: string;
  csvPath: string | null;
  status: CampaignStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  delaySeconds: number;
  totalContacts?: number;
  sentCount?: number;
  failedCount?: number;
  pendingCount?: number;
}

