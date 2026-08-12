import { Module } from '@nestjs/common';
import { InternalApiClient } from './internal-api-client';

@Module({
  providers: [InternalApiClient],
  exports: [InternalApiClient],
})
export class InternalApiModule {}
