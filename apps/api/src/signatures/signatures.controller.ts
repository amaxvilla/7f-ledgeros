import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ManualSignatureService } from './manual-signature.service';
import { UploadedFileLike } from '../admin-branding/admin-branding.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ListManualSignatureEnvelopesQueryDto } from './dto/signature.dto';

/** Digital Signature Providers, Checkpoint I — see ManualSignatureService's own doc comment. */
@ApiTags('signatures')
@ApiBearerAuth()
@Controller('signatures/manual-envelopes')
export class SignaturesController {
  constructor(private readonly manual: ManualSignatureService) {}

  /**
   * Checkpoint L — declared ahead of the ':id' route below (a static
   * segment must be registered before a dynamic one on the same base
   * path for Nest's router to match it correctly).
   */
  @Get()
  @RequirePermissions('signatures.view')
  @ApiOperation({
    summary: 'List manual signature envelopes',
    description: 'status is an optional filter; omit it to list envelopes in every status.',
  })
  findAll(@Query() query: ListManualSignatureEnvelopesQueryDto) {
    return this.manual.findAll(query.status);
  }

  @Get(':id')
  @RequirePermissions('signatures.view')
  @ApiOperation({ summary: 'Get a manual signature envelope by id' })
  findOne(@Param('id') id: string) {
    return this.manual.findEnvelope(id);
  }

  @Post(':id/complete')
  @RequirePermissions('signatures.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Record a manual envelope as completed, uploading the signed document',
    description:
      "For the no-vendor fallback path (a signer physically/manually signs outside any e-signature provider) — uploads the signed file via this app's own StorageProvider and marks the envelope COMPLETED. Rejected once the envelope is already COMPLETED, DECLINED, or VOIDED — there is nothing to complete on an envelope already in one of those terminal states.",
  })
  complete(@Param('id') id: string, @UploadedFile() file: UploadedFileLike) {
    return this.manual.recordCompletion(id, file);
  }

  // Digital Signature Providers, Checkpoint J.
  @Post(':id/decline')
  @RequirePermissions('signatures.manage')
  @ApiOperation({
    summary: 'Record a manual envelope as declined',
    description:
      'reason is optional. Same terminal-status guard as POST :id/complete above — rejected once the envelope is already COMPLETED, DECLINED, or VOIDED.',
  })
  decline(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.manual.recordDecline(id, reason);
  }
}
