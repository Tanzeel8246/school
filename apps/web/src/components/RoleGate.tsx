import { type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface RoleGateProps {
  /** Permission required to render children (checked via useAuth().can). */
  permission?: string;
  /** Optionally restrict to one of these roles. */
  roles?: string[];
  children: ReactNode;
  /** Rendered when access is denied (defaults to nothing). */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions/role.
 * Used to hide nav items and gate sections. The server still enforces access.
 */
export function RoleGate({ permission, roles, children, fallback = null }: RoleGateProps) {
  const { can, user } = useAuth();

  const permOk = permission ? can(permission) : true;
  const roleOk = roles ? !!user && roles.includes(user.role) : true;

  return permOk && roleOk ? <>{children}</> : <>{fallback}</>;
}
