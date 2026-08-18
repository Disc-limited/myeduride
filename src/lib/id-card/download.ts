/** Download ID cards PDF from server (photos + QR embedded correctly). */
export async function downloadIdCardsPdf(params: {
  school_id: string;
  student_ids?: string[];
  staff_role_ids?: string[];
  fileName?: string;
  primary_color?: string;
  accent_color?: string;
  photo_bg_color?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/id-cards/download', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      school_id: params.school_id,
      student_ids: params.student_ids || [],
      staff_role_ids: params.staff_role_ids || [],
      primary_color: params.primary_color,
      accent_color: params.accent_color,
      photo_bg_color: params.photo_bg_color,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || 'Failed to generate PDF' };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = params.fileName || `id_cards_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { ok: true };
}
