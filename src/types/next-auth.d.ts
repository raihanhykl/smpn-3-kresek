import type { Role } from '@/lib/auth/require-role';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      mustChangePassword: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    mustChangePassword: boolean;
  }
}
