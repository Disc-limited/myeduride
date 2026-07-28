'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Search,
  Send,
  ShieldCheck,
  Circle,
  Smile,
  Paperclip,
  CheckCheck,
  MessageSquare,
  Sparkles,
  Info,
  Users,
  User,
  Plus,
  Settings,
  X,
  Trash2,
  UserPlus,
  UserMinus,
  Edit2,
  ChevronRight,
  Menu,
  MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import { photoSrc } from '@/lib/photo';
import { toast } from 'sonner';
import { showWhatsAppToast } from '@/lib/notifications/whatsapp-toast';
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton';
import { ChatAttachmentPreview } from '@/components/chat/ChatAttachmentPreview';
import { ChatMediaBubble } from '@/components/chat/ChatMediaBubble';

interface StaffRosterItem {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  roles: string[];
  is_online: boolean;
  last_seen_at: string | null;
}

interface RosterItem {
  type: 'direct' | 'group';
  id: string; // user_id or room_id
  name: string;
  description?: string;
  avatar_url: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
  roles?: string[]; // for direct chats
  created_by?: string; // for groups
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  is_read?: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
}

export default function StaffPrivateChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth / session states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Unified Roster & Sidebar filter states
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unifiedRoster, setUnifiedRoster] = useState<RosterItem[]>([]);
  const [rawStaffRoster, setRawStaffRoster] = useState<StaffRosterItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<RosterItem | null>(null);

  // Messaging states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Media attachments & File uploads
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [showAttachInput, setShowAttachInput] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        toast.error('File size exceeds maximum limit of 25MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Modal / Drawer UI states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  
  // Group info participants details
  const [groupParticipants, setGroupParticipants] = useState<any[]>([]);
  const [isAddingParticipants, setIsAddingParticipants] = useState(false);
  const [selectedAddParticipants, setSelectedAddParticipants] = useState<string[]>([]);
  const [isEditingGroupDetails, setIsEditingGroupDetails] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');

  // 1. Initial Authentication & Role Guard check
  useEffect(() => {
    const session = getSession();
    if (!session || !session.user_id) {
      router.push('/auth/login');
      return;
    }

    const isStaff = session.roles.some((r: any) =>
      ['super_admin', 'school_admin', 'teacher', 'gate_officer', 'staff'].includes(r.role)
    );

    if (!isStaff) {
      router.push('/dashboard');
      return;
    }

    setCurrentUser(session);

    const activeRole = session.roles.find((r: any) => r.school_id);
    if (activeRole) {
      setSchoolId(activeRole.school_id);
      setIsAdminUser(
        session.roles.some(
          (r: any) => r.school_id === activeRole.school_id && ['school_admin', 'super_admin'].includes(r.role)
        )
      );
    }

    setIsLoading(false);
  }, [router]);

  // 2. Load all Roster data (Direct Staff + Group Rooms)
  const loadRosterData = async () => {
    if (!schoolId || !currentUser) return;
    try {
      // A. Load direct staff roster
      const rosterRes = await fetch('/api/chat/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_staff_roster',
          params: { school_id: schoolId },
        }),
      });
      const rosterData = await rosterRes.json();
      const rawStaff: StaffRosterItem[] = rosterData.roster || [];
      setRawStaffRoster(rawStaff);

      // B. Load direct unread counts
      const countsRes = await fetch('/api/chat/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_unread_counts',
          params: { school_id: schoolId },
        }),
      });
      const countsData = await countsRes.json();
      const countsMap = new Map<string, any>(
        (countsData.counts || []).map((c: any) => [c.sender_id, c])
      );

      // Map raw staff to Direct Roster Items
      const directItems: RosterItem[] = rawStaff.map((staff) => {
        const countData = countsMap.get(staff.id);
        return {
          type: 'direct',
          id: staff.id,
          name: staff.full_name,
          description: `@${staff.username}`,
          avatar_url: staff.avatar_url,
          is_online: staff.is_online,
          last_seen_at: staff.last_seen_at,
          unread_count: countData ? countData.unread_count : 0,
          last_message: countData ? countData.last_message : undefined,
          last_message_time: countData ? countData.last_message_time : undefined,
          roles: staff.roles,
        };
      });

      // C. Load group rooms
      const groupRes = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_rooms',
          params: { school_id: schoolId },
        }),
      });
      const groupData = await groupRes.json();
      const groupItems: RosterItem[] = (groupData.rooms || []).map((room: any) => ({
        type: 'group',
        id: room.id,
        name: room.name,
        description: room.description || 'Group Meeting Room',
        avatar_url: null,
        unread_count: room.unread_count || 0,
        last_message: room.last_message,
        last_message_time: room.last_message_time,
        created_by: room.created_by,
      }));

      // D. Combine both lists
      const combined = [...directItems, ...groupItems];

      // E. Sort: items with last_message_time first, then online status, then alphabetical
      combined.sort((a, b) => {
        const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
        const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
        
        if (timeA !== timeB) return timeB - timeA; // Descending message time
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return a.name.localeCompare(b.name);
      });

      setUnifiedRoster(combined);
    } catch (err) {
      console.error('[staff-chat] Failed to load roster data:', err);
    }
  };

  useEffect(() => {
    if (schoolId && currentUser) {
      loadRosterData();
      const timer = setInterval(loadRosterData, 30000);
      return () => clearInterval(timer);
    }
  }, [schoolId, currentUser]);

  // 3. Fetch History of Selected Thread (Group or Direct)
  const loadChatHistory = async (item: RosterItem) => {
    setIsLoadingHistory(true);
    try {
      if (item.type === 'direct') {
        const historyRes = await fetch('/api/chat/private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_private_history',
            params: { recipient_id: item.id },
          }),
        });
        const historyData = await historyRes.json();
        setMessages(historyData.messages || []);
      } else {
        // Group Room Chat History
        const historyRes = await fetch('/api/chat/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_room_history',
            params: { room_id: item.id },
          }),
        });
        const historyData = await historyRes.json();
        setMessages(historyData.messages || []);
        
        // Also fetch current participants for group details
        const partRes = await fetch('/api/chat/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_room_participants',
            params: { room_id: item.id },
          }),
        });
        const partData = await partRes.json();
        setGroupParticipants(partData.participants || []);
      }

      // Clear local unread counts in roster for this thread
      setUnifiedRoster((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      console.error('[staff-chat] Error fetching chat history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      loadChatHistory(selectedItem);
      setIsGroupInfoOpen(false);
      setIsEditingGroupDetails(false);
      setIsAddingParticipants(false);
    } else {
      setMessages([]);
      setGroupParticipants([]);
    }
  }, [selectedItem]);

  // 4. Real-time Subscriptions (Direct Messages & Group Messages)
  useEffect(() => {
    if (!currentUser || !schoolId) return;

    // A. Direct Messages channel
    const directChannel = supabase
      .channel('staff-private-messages-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staff_private_messages',
          filter: `school_id=eq.${schoolId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          const isSender = newMsg.sender_id === currentUser.user_id;
          const isRecipient = newMsg.recipient_id === currentUser.user_id;

          if (isSender || isRecipient) {
            const chatPartnerId = isSender ? newMsg.recipient_id : newMsg.sender_id;

            if (selectedItem?.type === 'direct' && selectedItem.id === chatPartnerId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              if (isRecipient) {
                // Clear unread on server asynchronously
                fetch('/api/chat/private', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'get_private_history',
                    params: { recipient_id: chatPartnerId },
                  }),
                }).catch(() => { });
              }
            } else {
              // Roster update: increment unread count for partner
              setUnifiedRoster((prev) =>
                prev.map((c) => {
                  if (c.type === 'direct' && c.id === chatPartnerId && isRecipient) {
                    return {
                      ...c,
                      unread_count: c.unread_count + 1,
                      last_message: newMsg.content,
                      last_message_time: newMsg.created_at,
                    };
                  }
                  return c;
                })
              );

              // WhatsApp toast alert for incoming 1-on-1 direct message
              if (isRecipient) {
                const partnerItem = rawStaffRoster.find((s) => s.id === chatPartnerId);
                showWhatsAppToast({
                  senderName: partnerItem?.full_name || 'Staff Member',
                  senderAvatar: partnerItem?.avatar_url,
                  roleBadge: 'Staff 1-on-1',
                  content: newMsg.content,
                  mediaType: newMsg.media_type,
                  onView: () => {
                    if (partnerItem) {
                      setSelectedItem({
                        type: 'direct',
                        id: partnerItem.id,
                        name: partnerItem.full_name,
                        avatar_url: partnerItem.avatar_url,
                        is_online: partnerItem.is_online,
                        last_seen_at: partnerItem.last_seen_at,
                        unread_count: 0,
                        roles: partnerItem.roles,
                      });
                    }
                  },
                });
              }
            }
          }
        }
      )
      .subscribe();

    // B. Group Messages channel
    const groupChannel = supabase
      .channel('staff-group-messages-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staff_room_messages',
          filter: `school_id=eq.${schoolId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const isSelf = newMsg.sender_id === currentUser.user_id;

          // Check if user is participant of this room
          const isPart = selectedItem?.type === 'group' && selectedItem.id === newMsg.room_id;
          
          if (isPart) {
            // Fetch sender profile details to enrich message
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();

            const enrichedMsg: ChatMessage = {
              ...newMsg,
              sender_name: profile?.full_name || 'Staff Member',
              sender_avatar: profile?.avatar_url || null,
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === enrichedMsg.id)) return prev;
              return [...prev, enrichedMsg];
            });

            // Mark read on backend
            if (!isSelf) {
              fetch('/api/chat/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'mark_room_read',
                  params: { room_id: newMsg.room_id },
                }),
              }).catch(() => {});
            }
          } else {
            // Update unread count for other rooms
            setUnifiedRoster((prev) =>
              prev.map((r) => {
                if (r.type === 'group' && r.id === newMsg.room_id && !isSelf) {
                  return {
                    ...r,
                    unread_count: r.unread_count + 1,
                    last_message: newMsg.content,
                    last_message_time: newMsg.created_at,
                  };
                }
                return r;
              })
            );

            // WhatsApp toast notification for group room message
            if (!isSelf) {
              const targetRoom = unifiedRoster.find((r) => r.type === 'group' && r.id === newMsg.room_id);
              if (targetRoom) {
                showWhatsAppToast({
                  senderName: targetRoom.name,
                  roleBadge: 'Group Room',
                  content: newMsg.content,
                  mediaType: newMsg.media_type,
                  onView: () => {
                    setSelectedItem(targetRoom);
                  },
                });
              }
            }
          }
        }
      )
      .subscribe();

    // C. Group Rooms Metadata updates (Create / Delete)
    const roomMetadataChannel = supabase
      .channel('staff-rooms-metadata-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_chat_rooms',
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          loadRosterData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(directChannel);
      supabase.removeChannel(groupChannel);
      supabase.removeChannel(roomMetadataChannel);
    };
  }, [supabase, currentUser, schoolId, selectedItem]);

  // 5. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingHistory]);

  // 6. Action: Send Message (Direct or Group)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() && !mediaUrlInput.trim() && !selectedFile) return;
    if (!selectedItem || !schoolId || !currentUser) return;

    setIsSending(true);

    let mediaUrl: string | null = mediaUrlInput.trim() || null;
    let mediaType: string | null = mediaUrl ? 'image' : null;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('folder', 'chat-attachments');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          toast.error(uploadData.error || 'Failed to upload attachment');
          setIsSending(false);
          return;
        }

        mediaUrl = uploadData.url;
        if (selectedFile.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (selectedFile.type.startsWith('audio/')) {
          mediaType = 'audio';
        } else {
          mediaType = 'document';
        }
      } catch (uploadErr) {
        console.error('[Staff Chat] File upload error:', uploadErr);
        toast.error('Failed to upload file attachment');
        setIsSending(false);
        return;
      }
    }

    const content = newMessageText.trim() || (
      mediaType === 'image' ? '📷 Photo' : mediaType === 'audio' ? '🎙️ Voice Note' : '📄 Attachment'
    );

    // Optimistic local append
    const optimisticMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      sender_id: currentUser.user_id,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
      sender_name: currentUser.full_name || 'You',
      sender_avatar: currentUser.avatar_url || null,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessageText('');
    setMediaUrlInput('');
    setSelectedFile(null);
    setShowAttachInput(false);

    try {
      if (selectedItem.type === 'direct') {
        const res = await fetch('/api/chat/private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_private',
            params: {
              school_id: schoolId,
              recipient_id: selectedItem.id,
              content,
              media_url: mediaUrl,
              media_type: mediaType,
            },
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticMsg.id ? { ...m, id: data.id } : m))
          );
        } else {
          toast.error(data.error || 'Failed to send private message');
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
          setNewMessageText(content);
        }
      } else {
        // Send Group Message
        const res = await fetch('/api/chat/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_room_message',
            params: {
              school_id: schoolId,
              room_id: selectedItem.id,
              content,
              media_url: mediaUrl,
              media_type: mediaType,
            },
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticMsg.id ? { ...m, id: data.id } : m))
          );
        } else {
          toast.error(data.error || 'Failed to send room message');
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
          setNewMessageText(content);
        }
      }
    } catch (err) {
      console.error('[staff-chat] Send error:', err);
      toast.error('Network error. Failed to send message.');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setNewMessageText(content);
    } finally {
      setIsSending(false);
    }
  };

  // 7. Action: Create Group Room (Admin Only)
  const handleCreateGroup = async () => {
    if (!groupNameInput.trim()) {
      toast.error('Group name is required');
      return;
    }
    try {
      const res = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_room',
          params: {
            school_id: schoolId,
            name: groupNameInput.trim(),
            description: groupDescInput.trim(),
            participant_ids: selectedGroupMembers,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Group room created successfully!');
        setIsCreateGroupOpen(false);
        setGroupNameInput('');
        setGroupDescInput('');
        setSelectedGroupMembers([]);
        loadRosterData();
      } else {
        toast.error(data.error || 'Failed to create group');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not create group');
    }
  };

  // 8. Action: Update Group Details (Admin Only)
  const handleUpdateGroupDetails = async () => {
    if (!selectedItem || !editGroupName.trim()) return;
    try {
      const res = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_room',
          params: {
            room_id: selectedItem.id,
            name: editGroupName.trim(),
            description: editGroupDesc.trim(),
          },
        }),
      });

      if (res.ok) {
        toast.success('Room details updated');
        setSelectedItem((prev) => prev ? { ...prev, name: editGroupName.trim(), description: editGroupDesc.trim() } : null);
        setIsEditingGroupDetails(false);
        loadRosterData();
      } else {
        toast.error('Failed to update details');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating details');
    }
  };

  // 9. Action: Add Group Participants (Admin Only)
  const handleAddParticipants = async () => {
    if (!selectedItem || selectedAddParticipants.length === 0) return;
    try {
      const res = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manage_participants',
          params: {
            room_id: selectedItem.id,
            add_ids: selectedAddParticipants,
          },
        }),
      });

      if (res.ok) {
        toast.success('Participants added successfully');
        setIsAddingParticipants(false);
        setSelectedAddParticipants([]);
        
        // Reload details
        const partRes = await fetch('/api/chat/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_room_participants',
            params: { room_id: selectedItem.id },
          }),
        });
        const partData = await partRes.json();
        setGroupParticipants(partData.participants || []);
      } else {
        toast.error('Failed to add participants');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error adding participants');
    }
  };

  // 10. Action: Remove Participant (Admin Only)
  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedItem) return;
    try {
      const res = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manage_participants',
          params: {
            room_id: selectedItem.id,
            remove_ids: [participantId],
          },
        }),
      });

      if (res.ok) {
        toast.success('Participant removed');
        setGroupParticipants((prev) => prev.filter((p) => p.id !== participantId));
      } else {
        toast.error('Failed to remove participant');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error removing participant');
    }
  };

  // 11. Action: Delete Group Room (Admin Only)
  const handleDeleteRoom = async () => {
    if (!selectedItem) return;
    if (!confirm('Are you sure you want to permanently delete this group room and all its messages?')) return;

    try {
      const res = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_room',
          params: { room_id: selectedItem.id },
        }),
      });

      if (res.ok) {
        toast.success('Group room deleted');
        setSelectedItem(null);
        setIsGroupInfoOpen(false);
        loadRosterData();
      } else {
        toast.error('Failed to delete room');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting room');
    }
  };

  // Roster lists filtered by query and tabs
  const filteredRoster = unifiedRoster.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'direct') return matchesSearch && item.type === 'direct';
    if (activeTab === 'groups') return matchesSearch && item.type === 'group';
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-slate-400 text-sm">Entering secure communications corridor...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col font-sans text-slate-100 antialiased overflow-hidden selection:bg-emerald-600 selection:text-white">
      <title>Staff Communications | MyEduRide</title>

      {/* Top Banner Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 h-16 shrink-0 px-6 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-all"
            title="Back to Dashboard"
            id="back_to_dashboard_btn"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Staff Communications <Sparkles size={14} className="text-emerald-400 animate-pulse" />
            </h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" /> End-to-end secure internal corridors
            </p>
          </div>
        </div>

        {/* Security Warning Notice */}
        <div className="hidden md:flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/20 rounded-xl px-4 py-1.5 text-xs text-emerald-400">
          <Info size={14} className="flex-shrink-0" />
          <span>Encrypted channel: School Administrators cannot monitor 1-on-1 messages.</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Sidebar (Chats List) */}
        <aside
          className={`h-full bg-slate-900/90 border-r border-slate-800 flex flex-col transition-all duration-300 w-full md:w-80 lg:w-96 shrink-0 overflow-hidden ${
            selectedItem ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Roster Search Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                id="search_staff_input"
                placeholder="Search staff or group rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs placeholder-slate-500 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Segmented Filter Control */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('direct')}
                className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'direct' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1-on-1
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'groups' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Groups
              </button>
            </div>
          </div>

          {/* Roster Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredRoster.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <MessageSquare size={24} className="mx-auto mb-2 text-slate-700" />
                No threads found
              </div>
            ) : (
              filteredRoster.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-slate-850/40 text-left transition-all relative ${
                    selectedItem?.id === item.id ? 'bg-slate-800/50 border-r-2 border-emerald-500' : ''
                  }`}
                >
                  {/* Left Column: Avatar */}
                  <div className="relative flex-shrink-0">
                    {item.type === 'direct' ? (
                      <>
                        {item.avatar_url ? (
                          <img
                            src={photoSrc(item.avatar_url) ?? ''}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-750"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-750 flex items-center justify-center font-bold text-slate-300 text-sm">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                            item.is_online ? 'bg-green-500' : 'bg-slate-600'
                          }`}
                        />
                      </>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800/30 flex items-center justify-center text-emerald-400">
                        <Users size={18} />
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-xs font-semibold text-white truncate">{item.name}</h3>
                      {item.last_message_time && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Role / Group Description */}
                    <div className="flex items-center gap-1.5 mb-1 min-w-0">
                      {item.type === 'direct' && item.roles ? (
                        item.roles.map((role) => (
                          <span key={role} className="text-[8px] bg-slate-950 border border-slate-800/80 text-slate-400 px-1 py-0.5 rounded font-mono">
                            {role.replace('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-[8px] bg-emerald-950/60 border border-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded font-medium truncate">
                          Room Chat
                        </span>
                      )}
                    </div>

                    {/* Content Snippet */}
                    <p className="text-[11px] text-slate-500 truncate leading-relaxed">
                      {item.last_message || item.description}
                    </p>
                  </div>

                  {/* Right Column: Unread badge */}
                  {item.unread_count > 0 && (
                    <span className="absolute right-4 bottom-4 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {item.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Admin Group Creator Panel at Sidebar Bottom */}
          {isAdminUser && (
            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <button
                onClick={() => setIsCreateGroupOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/20 active:scale-[0.98]"
              >
                <Plus size={16} />
                Create Meeting Room
              </button>
            </div>
          )}
        </aside>

        {/* Right Active Chat Stream */}
        <section
          className={`flex-1 bg-slate-950 flex flex-col overflow-hidden transition-all duration-350 ${
            !selectedItem ? 'hidden md:flex items-center justify-center p-8 text-center text-slate-400 bg-slate-950/80' : 'flex'
          }`}
        >
          {selectedItem ? (
            <>
              {/* Active Chat Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between shrink-0 h-16">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 md:hidden"
                    title="Back to Chats"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  {/* Avatar details */}
                  <div className="relative flex-shrink-0">
                    {selectedItem.type === 'direct' ? (
                      <>
                        {selectedItem.avatar_url ? (
                          <img
                            src={photoSrc(selectedItem.avatar_url) ?? ''}
                            alt={selectedItem.name}
                            className="w-9 h-9 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs border border-slate-750">
                            {selectedItem.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            selectedItem.is_online ? 'bg-green-500' : 'bg-slate-600'
                          }`}
                        />
                      </>
                    ) : (
                      <button
                        onClick={() => setIsGroupInfoOpen(true)}
                        className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-800/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-900 transition-colors"
                        title="Room info"
                      >
                        <Users size={16} />
                      </button>
                    )}
                  </div>

                  {/* Info Labels */}
                  <div className="min-w-0">
                    <h2
                      className={`text-xs font-bold text-white leading-tight ${
                        selectedItem.type === 'group' ? 'cursor-pointer hover:underline' : ''
                      }`}
                      onClick={() => selectedItem.type === 'group' && setIsGroupInfoOpen(true)}
                    >
                      {selectedItem.name}
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate leading-none">
                      {selectedItem.type === 'direct' ? (
                        selectedItem.is_online ? (
                          <span className="text-green-400 font-medium">Active now</span>
                        ) : selectedItem.last_seen_at ? (
                          `Active ${new Date(selectedItem.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date(selectedItem.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ) : (
                          'Offline'
                        )
                      ) : (
                        <span
                          className="cursor-pointer hover:text-slate-200"
                          onClick={() => setIsGroupInfoOpen(true)}
                        >
                          {groupParticipants.length} participants • Click for info
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedItem.type === 'group' ? (
                    <button
                      onClick={() => setIsGroupInfoOpen(!isGroupInfoOpen)}
                      className={`p-2 rounded-xl transition-all ${
                        isGroupInfoOpen ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                      }`}
                      title="Room Info & Management"
                    >
                      <Settings size={18} />
                    </button>
                  ) : (
                    <div className="text-[9px] text-emerald-500 flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/30 rounded-full px-2.5 py-1">
                      <ShieldCheck size={12} />
                      <span className="font-semibold">Private Thread</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Message scroll list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/30 flex flex-col">
                {isLoadingHistory ? (
                  <div className="my-auto flex items-center justify-center">
                    <div className="animate-pulse text-slate-500 text-xs">Decrypting conversation flow...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="my-auto flex flex-col items-center justify-center text-center text-slate-500 p-4 max-w-sm mx-auto">
                    <MessageSquare size={32} className="text-slate-700 mb-2" />
                    <p className="text-xs font-semibold">Start of safe corridor</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Send a message below to kickstart communications.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isSelf = m.sender_id === currentUser?.user_id;
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showSenderName = selectedItem.type === 'group' && !isSelf && prevMsg?.sender_id !== m.sender_id;

                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2.5 max-w-[85%] ${
                          isSelf ? 'ml-auto flex-row-reverse' : ''
                        }`}
                      >
                        {/* Received message avatar */}
                        {!isSelf && selectedItem.type === 'direct' && (
                          <div className="flex-shrink-0">
                            {selectedItem.avatar_url ? (
                              <img
                                src={photoSrc(selectedItem.avatar_url) ?? ''}
                                alt={selectedItem.name}
                                className="w-6 h-6 rounded-md object-cover border border-slate-750"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-[10px] border border-slate-750">
                                {selectedItem.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}

                        {!isSelf && selectedItem.type === 'group' && (
                          <div className="flex-shrink-0">
                            {m.sender_avatar ? (
                              <img
                                src={photoSrc(m.sender_avatar) ?? ''}
                                alt={m.sender_name}
                                className="w-6 h-6 rounded-md object-cover border border-slate-750"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-md bg-slate-850 flex items-center justify-center font-bold text-slate-400 text-[10px] border border-slate-750">
                                {m.sender_name?.charAt(0) || 'S'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Speech Bubble */}
                        <div className="flex flex-col">
                          {showSenderName && (
                            <span className="text-[9px] font-bold text-emerald-400 mb-1 ml-1">
                              {m.sender_name}
                            </span>
                          )}

                          <div
                            className={`rounded-2xl px-4 py-2 text-xs relative ${
                              isSelf
                                ? 'bg-emerald-700 text-white rounded-br-none shadow shadow-emerald-950/10'
                                : 'bg-slate-800 text-slate-100 rounded-bl-none shadow shadow-slate-950/10'
                            }`}
                          >
                            {m.media_url && (
                              <ChatMediaBubble
                                mediaUrl={m.media_url}
                                mediaType={m.media_type}
                                photoSrc={photoSrc}
                                isDark={true}
                              />
                            )}
                            <p className="leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>
                          </div>

                          {/* Time stamps */}
                          <div
                            className={`text-[9px] text-slate-500 mt-1 flex items-center gap-1 ${
                              isSelf ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isSelf && selectedItem.type === 'direct' && (
                              <CheckCheck
                                size={12}
                                className={m.is_read ? 'text-emerald-400' : 'text-slate-500'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Panel */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xls,.xlsx,.ppt,.pptx,text/plain,audio/*,.zip,.rar"
                  className="hidden"
                />

                {/* Pending Attachment Preview */}
                {selectedFile && (
                  <div className="mb-2">
                    <ChatAttachmentPreview
                      file={selectedFile}
                      onCancel={() => setSelectedFile(null)}
                    />
                  </div>
                )}

                {showAttachInput && (
                  <div className="mb-2 flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl">
                    <input
                      type="text"
                      placeholder="Paste image/media URL link..."
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      className="flex-1 bg-transparent border-none text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachInput(false);
                        setMediaUrlInput('');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isRecordingVoice}
                    className="p-3 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors flex-shrink-0 bg-slate-900 border border-slate-800/80 h-[46px] w-[46px] flex items-center justify-center"
                    title="Attach File (Image, PDF, Word, File)"
                  >
                    <Paperclip size={18} />
                  </button>

                  <div className="shrink-0 mb-0.5">
                    <VoiceRecordButton
                      onRecordComplete={(blob) => {
                        const voiceFile = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
                        setSelectedFile(voiceFile);
                      }}
                      onRecordingStateChange={setIsRecordingVoice}
                    />
                  </div>

                  <textarea
                    rows={1}
                    placeholder={isRecordingVoice ? 'Recording voice note...' : `Type message to ${selectedItem.name}...`}
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    disabled={isSending || isRecordingVoice}
                    className="flex-1 bg-slate-900 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none max-h-32 min-h-[46px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />

                  <button
                    type="submit"
                    disabled={isSending || isRecordingVoice || (!newMessageText.trim() && !mediaUrlInput.trim() && !selectedFile)}
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:hover:bg-emerald-600 shadow shadow-emerald-950/20 active:scale-95 h-[46px] w-[46px]"
                  >
                    <Send size={18} className={isSending ? 'animate-pulse' : ''} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="my-auto flex flex-col items-center justify-center p-8 max-w-sm">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow shadow-slate-950/30">
                <MessageSquare size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-sm font-semibold text-white mb-2">Staff Internal Channels</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Interact securely with other teachers, department heads, and school offices. Create rooms for board meetings, operations, or syllabus management.
              </p>
              <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800/50 rounded-2xl px-4 py-2 text-[10px] text-slate-400">
                <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0" />
                <span>Isolated networks: Encrypted and scoped per active school login.</span>
              </div>
            </div>
          )}
        </section>

        {/* Right Sidebar: Group Info Drawer */}
        {selectedItem && selectedItem.type === 'group' && isGroupInfoOpen && (
          <aside className="w-full md:w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 z-20 absolute md:relative right-0 top-0 shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users size={16} className="text-emerald-400" /> Room Details
              </h3>
              <button
                onClick={() => {
                  setIsGroupInfoOpen(false);
                  setIsEditingGroupDetails(false);
                  setIsAddingParticipants(false);
                }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Room details editing */}
              {isEditingGroupDetails ? (
                <div className="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Edit Details</h4>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Room Name</label>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Description</label>
                    <textarea
                      value={editGroupDesc}
                      onChange={(e) => setEditGroupDesc(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none h-16 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateGroupDetails}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded-lg text-[10px] font-bold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingGroupDetails(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 py-1 rounded-lg text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2.5">
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-bold text-white">{selectedItem.name}</h4>
                    {isAdminUser && (
                      <button
                        onClick={() => {
                          setEditGroupName(selectedItem.name);
                          setEditGroupDesc(selectedItem.description || '');
                          setIsEditingGroupDetails(true);
                        }}
                        className="text-slate-400 hover:text-emerald-400 p-1"
                        title="Edit Details"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {selectedItem.description || 'No description provided.'}
                  </p>
                </div>
              )}

              {/* Add Participants Inline Widget */}
              {isAdminUser && (
                <div>
                  {isAddingParticipants ? (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add Participants</h4>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {rawStaffRoster
                          .filter((staff) => !groupParticipants.some((p) => p.id === staff.id))
                          .map((staff) => (
                            <label
                              key={staff.id}
                              className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAddParticipants.includes(staff.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAddParticipants((prev) => [...prev, staff.id]);
                                  } else {
                                    setSelectedAddParticipants((prev) => prev.filter((id) => id !== staff.id));
                                  }
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-800 bg-slate-900"
                              />
                              <span className="truncate">{staff.full_name}</span>
                            </label>
                          ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddParticipants}
                          disabled={selectedAddParticipants.length === 0}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-1 rounded-lg text-[10px] font-bold"
                        >
                          Add Checked
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingParticipants(false);
                            setSelectedAddParticipants([]);
                          }}
                          className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 py-1 rounded-lg text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingParticipants(true)}
                      className="w-full flex items-center justify-center gap-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-350 hover:text-white py-2 rounded-xl text-xs font-semibold transition-colors"
                    >
                      <UserPlus size={14} /> Add Participant
                    </button>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Participants ({groupParticipants.length})
                </h4>
                <div className="space-y-1 bg-slate-950/40 rounded-xl divide-y divide-slate-850/50 max-h-80 overflow-y-auto border border-slate-850">
                  {groupParticipants.map((part) => (
                    <div key={part.id} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {part.avatar_url ? (
                          <img
                            src={photoSrc(part.avatar_url) ?? ''}
                            alt={part.full_name}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-[10px]">
                            {part.full_name?.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs text-white truncate font-medium">{part.full_name}</span>
                      </div>
                      
                      {/* Remove button (Only if admin, and not self) */}
                      {isAdminUser && part.id !== currentUser.user_id && (
                        <button
                          onClick={() => handleRemoveParticipant(part.id)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          title="Remove participant"
                        >
                          <UserMinus size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Room Deletion controls */}
            {isAdminUser && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                <button
                  onClick={handleDeleteRoom}
                  className="w-full flex items-center justify-center gap-1.5 bg-red-950/40 border border-red-900/30 hover:bg-red-900/50 text-red-400 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  <Trash2 size={15} /> Delete Room
                </button>
              </div>
            )}
          </aside>
        )}

      </div>

      {/* MODAL: Create New Room (Admin Only) */}
      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-emerald-400" /> New Chat Room / Group
              </h3>
              <button
                onClick={() => {
                  setIsCreateGroupOpen(false);
                  setGroupNameInput('');
                  setGroupDescInput('');
                  setSelectedGroupMembers([]);
                }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Room Name*</label>
                <input
                  type="text"
                  placeholder="e.g. Science Syllabus Meeting, Admin Board"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  placeholder="What is this group for? (department discussions, meetings, etc.)"
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 h-16 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Select Initial Participants
                </label>
                <p className="text-[9px] text-slate-500 mb-2">You will automatically be added as the room owner.</p>
                
                {/* Roster selector checkboxes */}
                <div className="border border-slate-800/80 bg-slate-950 rounded-xl divide-y divide-slate-850/40 max-h-48 overflow-y-auto">
                  {rawStaffRoster.length === 0 ? (
                    <p className="p-3 text-center text-slate-650 italic text-[11px]">No other staff members available</p>
                  ) : (
                    rawStaffRoster.map((staff) => (
                      <label
                        key={staff.id}
                        className="flex items-center gap-3 p-3 hover:bg-slate-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupMembers.includes(staff.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroupMembers((prev) => [...prev, staff.id]);
                            } else {
                              setSelectedGroupMembers((prev) => prev.filter((id) => id !== staff.id));
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-800 bg-slate-900"
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          {staff.avatar_url ? (
                            <img
                              src={photoSrc(staff.avatar_url) ?? ''}
                              alt={staff.full_name}
                              className="w-6 h-6 rounded-md object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-[10px]">
                              {staff.full_name.charAt(0)}
                            </div>
                          )}
                          <span className="text-slate-100 truncate">{staff.full_name}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex gap-2">
              <button
                onClick={() => {
                  setIsCreateGroupOpen(false);
                  setGroupNameInput('');
                  setGroupDescInput('');
                  setSelectedGroupMembers([]);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 py-2.5 rounded-xl font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupNameInput.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-55 disabled:hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
