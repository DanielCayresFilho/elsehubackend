export class TemplateResponseDto {
  id: string;
  name: string;
  body: string;
  metaTemplateId: string | null;
  language: string | null;
  variables: Record<string, any> | null;
  serviceInstanceId: string;
  serviceInstanceName?: string;
}

