import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Body, Get, Param, Query, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('template/:type')
  @ApiOperation({ summary: 'Download an import template' })
  downloadTemplate(@Param('type') type: string, @Query('format') format: string, @Res() res: Response) {
    if (!format) format = 'csv';
    return this.importsService.getTemplate(type, format, res);
  }

  @Post('parse')
  @ApiOperation({ summary: 'Parse a CSV or XLSX file into JSON rows' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx')) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only CSV and XLSX files are allowed'), false);
      }
    }
  }))
  parseFile(
    @UploadedFile() file: any,
    @Body('format') format?: 'csv' | 'xlsx'
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.importsService.parseFile(file, format);
  }
}
