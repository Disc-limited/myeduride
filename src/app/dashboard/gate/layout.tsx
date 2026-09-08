'use client';

import { RouteGuard } from '@/components/shared/RouteGuard';

const ALLOWED_GATE_ROLES = ['gate_officer', 'gate_manager', 'security_officer', 'school_admin'];

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard requiredRole={ALLOWED_GATE_ROLES}>{children}</RouteGuard>;
}
