'use server';

import { cookies } from 'next/headers';

export async function parseImportFileAction(formData: FormData) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const token = cookies().get('accessToken')?.value;

  try {
    const res = await fetch(`${API_URL}/imports/parse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      try {
        const errorJson = JSON.parse(errorText);
        return { ok: false, error: errorJson.message || 'Failed to parse file' };
      } catch (e) {
        return { ok: false, error: errorText || 'Failed to parse file' };
      }
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
