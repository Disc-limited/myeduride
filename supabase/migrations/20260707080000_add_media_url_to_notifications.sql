-- Migration: Add media_url column to notifications table for EduChart attachments
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS media_url TEXT;
