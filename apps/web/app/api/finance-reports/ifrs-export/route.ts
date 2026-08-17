import { NextRequest } from 'next/server';
import { fetchApi } from '../../../../lib/api';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const entityId = params.get('entityId') ?? '';
  const fiscalPeriodId = params.get('fiscalPeriodId') ?? '';
  const format = params.get('format') ?? 'pdf-ready';

  if (!entityId || !fiscalPeriodId) {
    return Response.json(
      { message: 'entityId and fiscalPeriodId are required' },
      { status: 400 },
    );
  }

  const result = await fetchApi(
    `/reporting/ifrs-notes/export?entityId=${encodeURIComponent(entityId)}&fiscalPeriodId=${encodeURIComponent(fiscalPeriodId)}&format=${encodeURIComponent(format)}`,
  );

  return Response.json(result);
}