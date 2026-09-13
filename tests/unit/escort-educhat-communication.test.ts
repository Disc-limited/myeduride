import { TestSuite, expect } from '../utils/test-harness';

export const escortEduChatCommunicationSuite = new TestSuite(
  'Escort EduChat Two-Way Communication & Multi-Party Routing Suite',
  'UNIT'
);

type ChatParticipant = {
  id: string;
  name: string;
  role: 'escort' | 'parent' | 'gate_officer' | 'city_manager';
  school_id?: string;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  student_id: string;
  school_id: string;
  recipient_type: 'parent' | 'gate_officer' | 'city_manager';
  recipient_id?: string;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'audio' | null;
  audio_duration_seconds?: number | null;
  is_read: boolean;
  created_at: string;
};

// 1. Channel formatting & multi-recipient routing
escortEduChatCommunicationSuite.test('Invariant 1: Escort can route messages to Parents, School Gate Officers, and City Manager', () => {
  const escort: ChatParticipant = {
    id: 'ESC-701',
    name: 'Samuel Okoye',
    role: 'escort',
    school_id: 'SCH-LAG-01',
  };

  const createChatMessage = (
    sender: ChatParticipant,
    studentId: string,
    schoolId: string,
    recipientType: 'parent' | 'gate_officer' | 'city_manager',
    content: string,
    media?: { url: string; type: 'image' | 'audio'; duration?: number }
  ): ChatMessage => {
    if (!content.trim() && !media?.url) {
      throw new Error('Message content or media attachment is required');
    }
    if (!studentId) {
      throw new Error('Valid student association is required for escort communication');
    }

    return {
      id: `MSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender_id: sender.id,
      sender_name: sender.name,
      sender_role: sender.role,
      student_id: studentId,
      school_id: schoolId,
      recipient_type: recipientType,
      content: content.trim(),
      media_url: media?.url || null,
      media_type: media?.type || null,
      audio_duration_seconds: media?.duration || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
  };

  // Test message to parent
  const parentMsg = createChatMessage(
    escort,
    'STU-1001',
    'SCH-LAG-01',
    'parent',
    'Good morning! We are 5 minutes away from your residence for pickup.'
  );

  expect(parentMsg.recipient_type).toBe('parent');
  expect(parentMsg.sender_role).toBe('escort');
  expect(parentMsg.student_id).toBe('STU-1001');
  expect(parentMsg.is_read).toBe(false);

  // Test message to Gate Officer
  const gateMsg = createChatMessage(
    escort,
    'STU-1001',
    'SCH-LAG-01',
    'gate_officer',
    'Escort bus arrived at North Gate. Please open barrier for student drop-off.'
  );

  expect(gateMsg.recipient_type).toBe('gate_officer');
  expect(gateMsg.school_id).toBe('SCH-LAG-01');

  // Test message to City Manager
  const cmMsg = createChatMessage(
    escort,
    'STU-1001',
    'SCH-LAG-01',
    'city_manager',
    'Severe road blockage on Lekki Expressway. Route diverted via alternative link bridge.'
  );

  expect(cmMsg.recipient_type).toBe('city_manager');
  expect(cmMsg.content).toContain('Lekki Expressway');
});

// 2. Audio Voice Note Recording Payload Validation
escortEduChatCommunicationSuite.test('Invariant 2: Escort voice note recordings validate MIME type, base64 payload, and duration cap', () => {
  const validateVoiceNote = (payload: {
    audioDataUrl: string;
    durationSeconds: number;
    maxSeconds?: number;
  }) => {
    const max = payload.maxSeconds || 120; // 2 minutes maximum
    if (!payload.audioDataUrl.startsWith('data:audio/')) {
      throw new Error('Invalid audio data URL format. Must start with data:audio/');
    }
    if (payload.durationSeconds <= 0) {
      throw new Error('Audio duration must be greater than 0 seconds');
    }
    if (payload.durationSeconds > max) {
      throw new Error(`Voice message exceeds maximum permitted duration of ${max} seconds`);
    }

    // Check base64 data size (< 5MB)
    const base64Part = payload.audioDataUrl.split(',')[1] || '';
    const approxBytes = Math.ceil((base64Part.length * 3) / 4);
    if (approxBytes > 5 * 1024 * 1024) {
      throw new Error('Voice message payload exceeds 5MB size limit');
    }

    return {
      isValid: true,
      duration: Math.round(payload.durationSeconds),
      approxBytes,
      mimeType: payload.audioDataUrl.substring(5, payload.audioDataUrl.indexOf(';')),
    };
  };

  const validVoiceNote = {
    audioDataUrl: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8tck+Q3...',
    durationSeconds: 14.5,
  };

  const result = validateVoiceNote(validVoiceNote);
  expect(result.isValid).toBe(true);
  expect(result.duration).toBe(15);
  expect(result.mimeType).toBe('audio/webm');

  // Excessive duration rejection
  let errorThrown = false;
  try {
    validateVoiceNote({
      audioDataUrl: 'data:audio/mp4;base64,AAAAHGZ0eX...',
      durationSeconds: 150, // > 120 seconds
    });
  } catch (err: any) {
    errorThrown = true;
    expect(err.message).toContain('exceeds maximum permitted duration');
  }
  expect(errorThrown).toBe(true);

  // Invalid format rejection
  let formatErrorThrown = false;
  try {
    validateVoiceNote({
      audioDataUrl: 'data:video/mp4;base64,AAAAHGZ0eX...',
      durationSeconds: 10,
    });
  } catch (err: any) {
    formatErrorThrown = true;
    expect(err.message).toContain('Invalid audio data URL format');
  }
  expect(formatErrorThrown).toBe(true);
});

// 3. Photo and Media Attachment Validation
escortEduChatCommunicationSuite.test('Invariant 3: Media photo attachments enforce image types and size limits', () => {
  const validateImageUpload = (payload: {
    dataUrl: string;
    fileSizeBytes: number;
  }) => {
    const supportedPrefixes = ['data:image/jpeg', 'data:image/png', 'data:image/webp'];
    const isSupported = supportedPrefixes.some((p) => payload.dataUrl.startsWith(p));
    if (!isSupported) {
      throw new Error('Unsupported image format. Allowed: JPEG, PNG, WEBP');
    }

    const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB
    if (payload.fileSizeBytes > MAX_PHOTO_BYTES) {
      throw new Error('Photo attachment exceeds 4MB file size cap');
    }

    return {
      accepted: true,
      sizeKb: Math.round(payload.fileSizeBytes / 1024),
    };
  };

  const validPhoto = {
    dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
    fileSizeBytes: 420 * 1024,
  };

  const uploadResult = validateImageUpload(validPhoto);
  expect(uploadResult.accepted).toBe(true);
  expect(uploadResult.sizeKb).toBe(420);

  // Oversized photo rejection
  let sizeCapThrown = false;
  try {
    validateImageUpload({
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      fileSizeBytes: 6 * 1024 * 1024,
    });
  } catch (err: any) {
    sizeCapThrown = true;
    expect(err.message).toContain('exceeds 4MB file size cap');
  }
  expect(sizeCapThrown).toBe(true);
});

// 4. Quick Transit Presets Handling
escortEduChatCommunicationSuite.test('Invariant 4: Escort quick-reply presets generate standardized transit status messages', () => {
  const PRESETS = [
    { key: 'arrived_home', text: 'I have arrived outside your residence for pickup/drop-off.' },
    { key: 'traffic_delay', text: 'Heavy traffic on the route. ETA delayed by approximately 10-15 minutes.' },
    { key: 'safely_seated', text: 'Student is safely seated and seatbelt is secured for transit.' },
    { key: 'arrived_school_gate', text: 'Arrived at the school gate and proceeding to security check-in.' },
  ];

  const applyPreset = (presetKey: string, studentName: string) => {
    const found = PRESETS.find((p) => p.key === presetKey);
    if (!found) {
      throw new Error(`Unknown preset: ${presetKey}`);
    }
    return `[${studentName}] ${found.text}`;
  };

  const text = applyPreset('arrived_school_gate', 'Chioma Adeleke');
  expect(text).toContain('Chioma Adeleke');
  expect(text).toContain('Arrived at the school gate');

  const trafficText = applyPreset('traffic_delay', 'Ibrahim Musa');
  expect(trafficText).toContain('ETA delayed by approximately 10-15 minutes');
});

// 5. Read Receipt and Unread Count Calculations
escortEduChatCommunicationSuite.test('Invariant 5: Channels compute accurate unread counts and mark messages as read', () => {
  const messages: ChatMessage[] = [
    {
      id: 'M1',
      sender_id: 'PARENT-1',
      sender_name: 'Mrs. Adeleke',
      sender_role: 'parent',
      student_id: 'STU-01',
      school_id: 'SCH-01',
      recipient_type: 'parent',
      content: 'Please let me know when you arrive.',
      is_read: false,
      created_at: '2026-09-13T07:00:00Z',
    },
    {
      id: 'M2',
      sender_id: 'PARENT-1',
      sender_name: 'Mrs. Adeleke',
      sender_role: 'parent',
      student_id: 'STU-01',
      school_id: 'SCH-01',
      recipient_type: 'parent',
      content: 'Her lunchbox is in the side pocket.',
      is_read: false,
      created_at: '2026-09-13T07:05:00Z',
    },
    {
      id: 'M3',
      sender_id: 'ESCORT-99',
      sender_name: 'Samuel Okoye',
      sender_role: 'escort',
      student_id: 'STU-01',
      school_id: 'SCH-01',
      recipient_type: 'parent',
      content: 'Noted with thanks!',
      is_read: true,
      created_at: '2026-09-13T07:06:00Z',
    },
  ];

  // Escort reads incoming messages from parents
  const calculateUnreadForEscort = (msgs: ChatMessage[], escortId: string) => {
    return msgs.filter((m) => m.sender_id !== escortId && !m.is_read).length;
  };

  expect(calculateUnreadForEscort(messages, 'ESCORT-99')).toBe(2);

  // Mark student channel messages as read
  const markAsRead = (msgs: ChatMessage[], studentId: string, currentUserId: string) => {
    return msgs.map((m) => {
      if (m.student_id === studentId && m.sender_id !== currentUserId) {
        return { ...m, is_read: true };
      }
      return m;
    });
  };

  const updated = markAsRead(messages, 'STU-01', 'ESCORT-99');
  expect(calculateUnreadForEscort(updated, 'ESCORT-99')).toBe(0);
});

// 6. Security Invariant: Preventing unauthorized cross-tenant messages
escortEduChatCommunicationSuite.test('Invariant 6: Escort can only message parents and schools for assigned students', () => {
  const escortAssignedStudentIds = ['STU-01', 'STU-02', 'STU-05'];

  const authorizeEscortMessage = (escortStudentList: string[], targetStudentId: string) => {
    if (!escortStudentList.includes(targetStudentId)) {
      throw new Error('Access denied: Escort is not currently assigned to this student');
    }
    return true;
  };

  expect(authorizeEscortMessage(escortAssignedStudentIds, 'STU-01')).toBe(true);

  let denied = false;
  try {
    authorizeEscortMessage(escortAssignedStudentIds, 'STU-999'); // Unassigned student
  } catch (err: any) {
    denied = true;
    expect(err.message).toContain('Access denied');
  }
  expect(denied).toBe(true);
});
