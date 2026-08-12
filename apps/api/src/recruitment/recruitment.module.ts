import { Module } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { CandidateService } from './candidate.service';
import { CandidateController } from './candidate.controller';
import { CandidatePortalController } from './candidate-portal.controller';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { BackgroundCheckService } from './background-check.service';
import { BackgroundCheckController } from './background-check.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { BudgetingModule } from '../budgeting/budgeting.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ContactsModule } from '../contacts/contacts.module';
import { PresenceModule } from '../presence/presence.module';
import { TeamsModule } from '../teams/teams.module';
import { WorkspaceAdminModule } from '../workspace-admin/workspace-admin.module';
import { SignaturesModule } from '../signatures/signatures.module';

@Module({
  imports: [WorkflowModule, BudgetingModule, CalendarModule, ContactsModule, PresenceModule, TeamsModule, WorkspaceAdminModule, SignaturesModule],
  controllers: [
    RecruitmentController,
    CandidateController,
    CandidatePortalController,
    InterviewController,
    OfferController,
    BackgroundCheckController,
  ],
  providers: [RecruitmentService, CandidateService, InterviewService, OfferService, BackgroundCheckService],
  exports: [RecruitmentService, CandidateService, InterviewService, OfferService, BackgroundCheckService],
})
export class RecruitmentModule {}
