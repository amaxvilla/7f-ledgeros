import { NextResponse } from 'next/server';
import { fetchApi, ApiError } from '../../../lib/api';

export const dynamic = 'force-dynamic';

interface Entity {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  baseCurrency?: string;
  isActive: boolean;
  isConsolidationParent?: boolean;
}

export async function GET() {
  try {
    const entities = await fetchApi<Entity[]>('/entities');

    return NextResponse.json(
      entities.filter((entity) => entity.isActive),
      { status: 200 },
    );
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : 'Failed to load entities.';

    return NextResponse.json({ message }, { status });
  }
}
