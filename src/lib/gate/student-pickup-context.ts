import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkArray } from '@/lib/db/fetch-all';
import { todayInLagos } from '@/lib/timezone';

export type PickupPersonRow = {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  photo_url: string | null;
};

export type StudentPickupContext = {
  pickup_notice: Record<string, unknown> | null;
  pickup_request: Record<string, unknown> | null;
  pickup_persons: PickupPersonRow[];
};

const PICKUP_PERSON_SELECT = `
  pickup_person:pickup_persons!pickup_person_id(id, name, relationship, phone, photo_url)
`;

export function normalizePickupPerson(raw: unknown): PickupPersonRow | null {
  if (!raw) return null;
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== 'object') return null;
  const row = p as PickupPersonRow;
  return row.id ? row : null;
}

export function matchPickupPhoto(
  name: string | null | undefined,
  phone: string | null | undefined,
  persons: PickupPersonRow[]
): string | null {
  if (!name && !phone) return null;
  const n = (name || '').trim().toLowerCase();
  const ph = (phone || '').replace(/\s/g, '');
  for (const p of persons) {
    if (n && p.name?.trim().toLowerCase() === n) return p.photo_url;
    if (ph && p.phone && p.phone.replace(/\s/g, '') === ph) return p.photo_url;
  }
  return null;
}

async function loadPickupPersonRowsDirect(
  supabase: SupabaseClient,
  schoolId: string,
  personIds: string[]
): Promise<PickupPersonRow[]> {
  if (!personIds.length) return [];
  const { data } = await supabase
    .from('pickup_persons')
    .select('id, name, relationship, phone, photo_url')
    .eq('school_id', schoolId)
    .in('id', personIds);

  const rows: PickupPersonRow[] = [];
  for (const row of data || []) {
    const person = normalizePickupPerson(row);
    if (person) rows.push(person);
  }
  return rows;
}

/** Authorised pickup persons for one student (embed + direct fallback + 3-slot parent pickup authorizations). */
export async function loadPickupPersonsForStudent(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string
): Promise<PickupPersonRow[]> {
  const persons: PickupPersonRow[] = [];

  // 1. Query modern 3-slot parent pickup authorizations
  try {
    const { data: authRows } = await supabase
      .from('pickup_authorizations')
      .select('id, name, relationship, phone, photo_url, slot_number, category_label')
      .eq('student_id', studentId)
      .order('slot_number', { ascending: true });

    if (authRows && authRows.length > 0) {
      for (const row of authRows) {
        persons.push({
          id: row.id,
          name: row.name,
          relationship: row.relationship || row.category_label || `Slot ${row.slot_number}`,
          phone: row.phone || null,
          photo_url: row.photo_url || null,
        });
      }
    }
  } catch (authErr) {
    console.warn('[student-pickup-context] pickup_authorizations query notice:', authErr);
  }

  // 2. Query legacy pickup_person_students if available
  const { data: ppLinks } = await supabase
    .from('pickup_person_students')
    .select(`pickup_person_id, ${PICKUP_PERSON_SELECT}`)
    .eq('school_id', schoolId)
    .eq('student_id', studentId);

  const fallbackIds: string[] = [];

  for (const link of ppLinks || []) {
    const person = normalizePickupPerson(link.pickup_person);
    if (person && !persons.some((p) => p.name.toLowerCase() === person.name.toLowerCase())) {
      persons.push(person);
    } else if (link.pickup_person_id) {
      fallbackIds.push(link.pickup_person_id);
    }
  }

  if (fallbackIds.length > 0) {
    const directRows = await loadPickupPersonRowsDirect(supabase, schoolId, fallbackIds);
    for (const r of directRows) {
      if (!persons.some((p) => p.name.toLowerCase() === r.name.toLowerCase())) {
        persons.push(r);
      }
    }
  }

  return persons;
}

/** Batch load authorised pickup persons keyed by student id. */
export async function loadPickupPersonsByStudents(
  supabase: SupabaseClient,
  schoolId: string,
  studentIds: string[]
): Promise<Record<string, PickupPersonRow[]>> {
  const personsByStudent: Record<string, PickupPersonRow[]> = {};
  if (!studentIds.length) return personsByStudent;

  for (const batch of chunkArray(studentIds)) {
    // 1. Batch query 3-slot parent pickup authorizations
    try {
      const { data: authRows } = await supabase
        .from('pickup_authorizations')
        .select('id, student_id, name, relationship, phone, photo_url, slot_number, category_label')
        .in('student_id', batch)
        .order('slot_number', { ascending: true });

      if (authRows && authRows.length > 0) {
        for (const row of authRows) {
          const sid = String(row.student_id);
          if (!personsByStudent[sid]) personsByStudent[sid] = [];
          personsByStudent[sid].push({
            id: row.id,
            name: row.name,
            relationship: row.relationship || row.category_label || `Slot ${row.slot_number}`,
            phone: row.phone || null,
            photo_url: row.photo_url || null,
          });
        }
      }
    } catch (authErr) {
      console.warn('[student-pickup-context] batch pickup_authorizations notice:', authErr);
    }

    // 2. Batch query legacy pickup_person_students
    const { data: ppLinks } = await supabase
      .from('pickup_person_students')
      .select(`student_id, pickup_person_id, ${PICKUP_PERSON_SELECT}`)
      .eq('school_id', schoolId)
      .in('student_id', batch);

    const fallbackByStudent = new Map<string, string[]>();

    for (const link of ppLinks || []) {
      const sid = String(link.student_id);
      const person = normalizePickupPerson(link.pickup_person);
      if (person) {
        if (!personsByStudent[sid]) personsByStudent[sid] = [];
        if (!personsByStudent[sid].some((p) => p.name.toLowerCase() === person.name.toLowerCase())) {
          personsByStudent[sid].push(person);
        }
      } else if (link.pickup_person_id) {
        if (!fallbackByStudent.has(sid)) fallbackByStudent.set(sid, []);
        fallbackByStudent.get(sid)!.push(link.pickup_person_id);
      }
    }

    if (fallbackByStudent.size > 0) {
      const allIds = [...new Set([...fallbackByStudent.values()].flat())];
      const directRows = await loadPickupPersonRowsDirect(supabase, schoolId, allIds);
      const byId = new Map(directRows.map((p) => [p.id, p]));

      for (const [sid, ids] of fallbackByStudent) {
        if (personsByStudent[sid]?.length) continue;
        for (const id of ids) {
          const person = byId.get(id);
          if (!person) continue;
          if (!personsByStudent[sid]) personsByStudent[sid] = [];
          if (!personsByStudent[sid].some((p) => p.id === person.id)) {
            personsByStudent[sid].push(person);
          }
        }
      }
    }
  }

  return personsByStudent;
}

/** Today's pickup notice, request, and authorised persons for gate release UI. */
export async function fetchStudentPickupContext(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string,
  dateStr?: string
): Promise<StudentPickupContext> {
  const day = dateStr || todayInLagos();

  const pickup_persons = await loadPickupPersonsForStudent(supabase, schoolId, studentId);

  const { data: noticeRow } = await supabase
    .from('pickup_notices')
    .select('*')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('notice_date', day)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: requestRow } = await supabase
    .from('pickup_requests')
    .select('*')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('request_date', day)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let pickup_notice: Record<string, unknown> | null = null;
  if (noticeRow) {
    pickup_notice = {
      ...noticeRow,
      pickup_person_photo:
        matchPickupPhoto(noticeRow.pickup_person_name, noticeRow.pickup_person_phone, pickup_persons) ||
        null,
    };
  }

  let pickup_request: Record<string, unknown> | null = null;
  if (requestRow) {
    pickup_request = {
      ...requestRow,
      pickup_person_photo:
        matchPickupPhoto(requestRow.pickup_person_name, requestRow.pickup_person_phone, pickup_persons) ||
        null,
    };
  }

  return { pickup_notice, pickup_request, pickup_persons };
}
