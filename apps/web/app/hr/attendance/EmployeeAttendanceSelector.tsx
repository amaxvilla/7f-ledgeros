'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';

export function EmployeeAttendanceSelector({
  employeeOptions,
  selectedId,
  entityId,
}: {
  employeeOptions: SelectOption[];
  selectedId?: string;
  entityId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('entityId', entityId);
    params.set('employeeId', e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{ marginBottom: tokens.space(4), maxWidth: '320px' }}>
      <Select label="Viewing attendance for" value={selectedId ?? ''} onChange={handleChange} options={employeeOptions} />
    </div>
  );
}
