import { Injectable } from '@nestjs/common';
import { PowerBiProviderRegistry } from './power-bi-provider.registry';
import { PublishDatasetDto, PushRowsDto, TriggerRefreshDto } from './dto/power-bi.dto';

/**
 * The piece PowerBiProviderRegistry and PowerBiProviderImpl were
 * missing: something that actually calls
 * publishDataset/pushRows/triggerRefresh/getRefreshStatus/getEmbedConfig.
 * Mirrors CalendarService/ContactsService/TasksService exactly,
 * including their scope decision: no Prisma persistence, and no opinion
 * on which of this codebase's data (GL trial balance? PMO dashboards?
 * HRMS headcount?) should be published as a dataset —
 * power-bi-provider.interface.ts's own design notes explicitly defer
 * that decision to whichever future caller needs it, same posture
 * ContactsService/TasksService took for their own "what should sync"
 * questions. The caller supplies the schema and rows; this layer only
 * makes the mechanism callable at all.
 */
@Injectable()
export class PowerBiService {
  constructor(private readonly registry: PowerBiProviderRegistry) {}

  async publishDataset(dto: PublishDatasetDto) {
    const { providerCode, ...params } = dto;
    return this.registry.get(providerCode).publishDataset(params);
  }

  pushRows(providerDatasetId: string, dto: PushRowsDto) {
    const { providerCode, ...params } = dto;
    return this.registry.get(providerCode).pushRows({ ...params, providerDatasetId });
  }

  triggerRefresh(providerDatasetId: string, dto: TriggerRefreshDto) {
    return this.registry.get(dto.providerCode).triggerRefresh({ providerDatasetId });
  }

  getRefreshStatus(providerDatasetId: string, providerCode: string) {
    return this.registry.get(providerCode).getRefreshStatus(providerDatasetId);
  }

  getEmbedConfig(providerReportId: string, providerCode: string) {
    return this.registry.get(providerCode).getEmbedConfig({ providerReportId });
  }
}
