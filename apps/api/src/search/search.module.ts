import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Global search (FE-1's last open gap). `PrismaService` comes from the
 * `@Global()` `PrismaModule` (see `prisma.module.ts`) — no import needed
 * here, same as every other simple module in this codebase.
 */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
