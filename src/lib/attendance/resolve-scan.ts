/** Normalize QR / ID scan input (MYEDURIDE:STAFF:STF-xxx → multiple lookup keys). */
export function scanLookupValues(raw: string): string[] {
  let trimmed = (raw || '').trim();
  // Strip surrounding quotes if JSON or URL encoded
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (!trimmed) return [];

  const values = new Set<string>([trimmed]);
  const upper = trimmed.toUpperCase();
  values.add(upper);

  if (upper.startsWith('MYEDURIDE:')) {
    const rest = trimmed.slice('MYEDURIDE:'.length).trim();
    if (rest) {
      values.add(rest);
      values.add(rest.toUpperCase());
    }
    if (rest.includes(':')) {
      const afterPrefix = rest.slice(rest.indexOf(':') + 1).trim();
      if (afterPrefix) {
        values.add(afterPrefix);
        values.add(afterPrefix.toUpperCase());
        values.add(`MYEDURIDE:${afterPrefix.toUpperCase()}`);
      }
    }
  } else {
    // If scanned value is just an ID number, also candidate the prefixed versions
    values.add(`MYEDURIDE:${trimmed}`);
    values.add(`MYEDURIDE:${upper}`);
    if (upper.startsWith('STF-') || upper.startsWith('STAFF-')) {
      values.add(`MYEDURIDE:STAFF:${trimmed}`);
      values.add(`MYEDURIDE:STAFF:${upper}`);
    }
    if (upper.startsWith('STU-') || upper.startsWith('STUDENT-')) {
      values.add(`MYEDURIDE:STUDENT:${trimmed}`);
      values.add(`MYEDURIDE:STUDENT:${upper}`);
    }
  }

  return [...values];
}

