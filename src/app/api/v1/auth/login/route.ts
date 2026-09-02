import { loginForApi } from "@/lib/api-auth";
import { bad, ok } from "@/lib/api";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Cuerpo de la petición inválido.");
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) return bad("Escribe correo y contraseña.");

  const result = await loginForApi(email, password);
  if (!result) return bad("Correo o contraseña incorrectos.", 401);

  return ok({
    token: result.token,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      role: result.user.role,
    },
  });
}

export { OPTIONS } from "@/lib/api";
