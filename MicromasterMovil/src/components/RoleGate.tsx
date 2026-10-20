import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { canReadModule } from '@/constants/roles';
import { useSession } from '@/context/AuthContext';

interface RoleGateProps extends PropsWithChildren {
  module: string;
}

export function RoleGate({ module: moduleId, children }: RoleGateProps) {
  const { user, isLoading } = useSession();

  if (isLoading) return null;

  if (!user || !canReadModule(user, moduleId)) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}
