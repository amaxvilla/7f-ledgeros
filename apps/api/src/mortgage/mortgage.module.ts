import { Module } from '@nestjs/common';
import { MortgageService } from './mortgage.service';
import { MortgageController } from './mortgage.controller';
import { RevenueRecognitionModule } from '../revenue-recognition/revenue-recognition.module';

@Module({
  imports: [RevenueRecognitionModule],
  controllers: [MortgageController],
  providers: [MortgageService],
  exports: [MortgageService],
})
export class MortgageModule {}
