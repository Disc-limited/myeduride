import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();

    // Query valid columns in schools table including logo_url
    const { data: schoolsData, error } = await supabase
      .from('schools')
      .select('id, name, address, logo_url')
      .order('name');

    if (error) {
      console.error('[public/schools] error:', error.message);
    }

    const registeredSchools = (schoolsData || [])
      .filter(
        (s) =>
          s.id !== '00000000-0000-0000-0000-000000000001' &&
          !/^[a-zA-Z]{15,}$/.test(s.name) // Filter out garbage test strings
      )
      .map((s) => {
        let logo = '';
        if (s.logo_url) {
          logo = s.logo_url.startsWith('http')
            ? s.logo_url
            : `/api/photo?path=${encodeURIComponent(s.logo_url)}`;
        }

        let city = 'Lagos';
        if (s.address) {
          const parts = s.address.split(',').map((p: string) => p.trim());
          if (parts.length >= 2) {
            city = parts.slice(-2).join(', ');
          } else {
            city = s.address;
          }
        }

        return {
          id: s.id,
          name: s.name,
          address: s.address || 'Address on file',
          city,
          logo_url: logo,
        };
      });

    return NextResponse.json({ schools: registeredSchools });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch schools';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
