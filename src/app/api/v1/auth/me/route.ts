import { withUser } from "@/lib/api";

/** Sirve para que la app compruebe al arrancar si el token sigue vivo. */
export const GET = withUser(async ({ user }) => ({
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    // Cuál de las dos eres. La agenda es la misma para todas.
    specialistId: user.specialistId,
  },
}));

export { OPTIONS } from "@/lib/api";
