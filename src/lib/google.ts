import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Comprobar que un token de Google es de verdad y de quién es.
 *
 * El teléfono manda un `idToken` firmado por Google. Aquí se comprueba la
 * firma contra las claves públicas de Google y que venga para *nuestra*
 * aplicación: sin esa segunda comprobación, un token legítimo sacado de
 * cualquier otra app serviría para entrar aquí.
 *
 * Nunca se cree nada de lo que diga el teléfono sobre quién es: el correo y
 * el identificador salen del token ya verificado.
 */

const CLAVES = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Google firma con dos emisores según el camino; los dos son suyos. */
const EMISORES = ["https://accounts.google.com", "accounts.google.com"];

export class ErrorGoogle extends Error {}

/**
 * Para quién tiene que venir el token.
 *
 * Es el "client ID de tipo web" del proyecto de Google, el mismo que la app
 * manda como `serverClientId`. Android usa el suyo propio para pedirlo, pero
 * el token sale emitido para este.
 */
function clientesValidos() {
  const crudo = process.env.GOOGLE_CLIENT_ID ?? "";
  const ids = crudo
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    throw new ErrorGoogle(
      "Entrar con Google todavía no está configurado en el servidor.",
    );
  }
  return ids;
}

export type CuentaDeGoogle = {
  /** El identificador de la cuenta. No cambia aunque cambie el correo. */
  sub: string;
  email: string;
  nombre: string | null;
};

export async function leerTokenDeGoogle(idToken: string): Promise<CuentaDeGoogle> {
  if (!idToken.trim()) throw new ErrorGoogle("No llegó el token de Google.");

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, CLAVES, {
      issuer: EMISORES,
      audience: clientesValidos(),
    }));
  } catch (error) {
    if (error instanceof ErrorGoogle) throw error;
    throw new ErrorGoogle("Google no reconoció esa sesión. Inténtalo de nuevo.");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!sub || !email) throw new ErrorGoogle("Esa cuenta de Google no trae correo.");

  // Un correo sin verificar no identifica a nadie: cualquiera puede poner el
  // de otra persona al crear una cuenta de Google con dominio propio.
  if (payload.email_verified === false) {
    throw new ErrorGoogle("Ese correo de Google no está verificado.");
  }

  return {
    sub,
    email: email.toLowerCase(),
    nombre: typeof payload.name === "string" ? payload.name : null,
  };
}
