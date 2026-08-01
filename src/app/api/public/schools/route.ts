import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();

    // Query valid columns in schools table
    const { data: schoolsData, error } = await supabase
      .from('schools')
      .select('id, name, address')
      .order('name');

    if (error) {
      console.error('[public/schools] error:', error.message);
    }

    const defaultSchools = [
      { id: 'school-1', name: 'Greenfield International School', address: '23 Greenfield Road, Lekki Phase 1, Lagos', state: 'Lagos', city: 'Lekki' },
      { id: 'school-2', name: 'St. Nicholas College', address: '12 Catholic Mission Street, Lagos Island, Lagos', state: 'Lagos', city: 'Lagos Island' },
      { id: 'school-3', name: 'Corona Secondary School', address: 'Plot 5, Block 1, Agbara Estate, Ogun', state: 'Ogun', city: 'Agbara' },
      { id: 'school-4', name: 'Meadow Hall School', address: 'Meadow Hall Way, Alma Beach Estate, Lekki, Lagos', state: 'Lagos', city: 'Lekki' },
      { id: 'school-5', name: 'Atlantic Hall School', address: 'Poka, Epe, Lagos', state: 'Lagos', city: 'Epe' },
    ];

    const registeredSchools = (schoolsData || [])
      .filter((s) => s.id !== '00000000-0000-0000-0000-000000000001') // exclude platform root
      .map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address || 'Address on file',
        state: 'Lagos',
        city: 'Lagos',
      }));

    // Merge registered schools with default list avoiding duplicates
    const combined = [...registeredSchools];
    for (const d of defaultSchools) {
      if (!combined.some((c) => c.name.toLowerCase() === d.name.toLowerCase())) {
        combined.push(d);
      }
    }

    return NextResponse.json({ schools: combined });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch schools';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
