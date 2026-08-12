import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SignatureService } from './signature.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { UploadedFileLike } from '../admin-branding/admin-branding.service';
import { GetSignatureStatusQueryDto, DownloadSignedDocumentQueryDto, VoidEnvelopeDto } from './dto/signature.dto';

/**
 * Digital Signature Providers, Checkpoint K — see SignatureService's own
 * doc comment for how this relates to OfferService's existing hardcoded
 * flow and to SignaturesController's separate manual-envelope path.
 *
 * sendForSignature's fields are deliberately plain @Body(...) params,
 * not a class-validated DTO, matching SignaturesController.decline's
 * own established convention for this module — multipart bodies mix a
 * binary file with form fields, and `signers` needs to arrive as a JSON
 * string within that form (there is no native way to post a structured
 * array alongside a file in a single multipart request), parsed here
 * rather than deferred to a pipe.
 */
@ApiTags('signatures')
@ApiBearerAuth()
@Controller('signatures/envelopes')
export class SignatureController {
  constructor(private readonly signatures: SignatureService) {}

  @Post()
  @RequirePermissions('signatures.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Send a document out for e-signature via a provider (e.g. DocuSign, Adobe Sign)',
    description:
      "Multipart upload: the document file plus providerCode/documentName/subject/message form fields and a signers field carrying a JSON-encoded array ({ email, name }[]) — there is no native way to post a structured array alongside a file in one multipart request, so it's parsed from its JSON-string form here rather than via a class-validated DTO.",
  })
  async sendForSignature(
    @UploadedFile() file: UploadedFileLike,
    @Body('providerCode') providerCode: string,
    @Body('documentName') documentName: string,
    @Body('signers') signersJson: string,
    @Body('subject') subject?: string,
    @Body('message') message?: string,
  ) {
    const signers = JSON.parse(signersJson) as { email: string; name: string }[];
    return this.signatures.sendForSignature(providerCode, {
      documentName,
      documentBuffer: file.buffer,
      documentContentType: file.mimetype,
      signers,
      subject,
      message,
    });
  }

  @Get(':providerEnvelopeId/status')
  @RequirePermissions('signatures.view')
  @ApiOperation({ summary: "Get a provider envelope's current signature status" })
  getStatus(@Param('providerEnvelopeId') providerEnvelopeId: string, @Query() query: GetSignatureStatusQueryDto) {
    return this.signatures.getStatus(providerEnvelopeId, query.providerCode);
  }

  @Get(':providerEnvelopeId/document')
  @RequirePermissions('signatures.view')
  @ApiOperation({
    summary: 'Download the signed document once the envelope is complete',
    description:
      'Streams the raw bytes as a generic application/octet-stream download — no provider returns filename/content-type metadata alongside the download, so this deliberately avoids guessing a content type (e.g. assuming PDF) a given provider may not have actually used.',
  })
  async downloadSignedDocument(
    @Param('providerEnvelopeId') providerEnvelopeId: string,
    @Query() query: DownloadSignedDocumentQueryDto,
    @Res() res: Response,
  ) {
    // The interface returns only raw bytes — no filename/content-type
    // metadata comes back from any provider's download call — so this
    // deliberately serves a generic octet-stream rather than guessing a
    // PDF/Content-Type a provider may not have actually used.
    const buffer = await this.signatures.downloadSignedDocument(providerEnvelopeId, query.providerCode);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${providerEnvelopeId}-signed"`,
    });
    res.send(buffer);
  }

  @Post(':providerEnvelopeId/void')
  @RequirePermissions('signatures.manage')
  @ApiOperation({ summary: 'Void an in-progress envelope, cancelling the signature request' })
  voidEnvelope(@Param('providerEnvelopeId') providerEnvelopeId: string, @Body() dto: VoidEnvelopeDto) {
    return this.signatures.voidEnvelope(providerEnvelopeId, dto.providerCode, dto.reason);
  }
}
