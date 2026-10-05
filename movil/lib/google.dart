import 'package:google_sign_in/google_sign_in.dart';

/// Entrar con la cuenta de Google del estudio.
///
/// La app no comprueba nada: le pide a Google un `idToken` y se lo pasa al
/// servidor, que es quien verifica la firma y decide de quién es. Aquí nunca
/// se decide quién entra.
///
/// El identificador del cliente va por `--dart-define` al compilar, no en el
/// código: cambia según el proyecto de Google y no tiene por qué vivir en el
/// repositorio. Si no se pasa, los botones de Google ni se enseñan —mejor
/// que no estén a que estén y den error.
const idClienteGoogle = String.fromEnvironment('GOOGLE_CLIENT_ID');

bool get hayGoogle => idClienteGoogle.isNotEmpty;

class ErrorGoogle implements Exception {
  ErrorGoogle(this.mensaje);
  final String mensaje;

  @override
  String toString() => mensaje;
}

final _google = GoogleSignIn(
  // El "client ID de tipo web" del proyecto. Android pide la sesión con el
  // suyo propio, pero sin esto Google no emite el `idToken` que el servidor
  // necesita: devuelve solo un token de acceso, que no dice quién es nadie.
  serverClientId: idClienteGoogle.isEmpty ? null : idClienteGoogle,
  scopes: const ['email'],
);

/// Abre el selector de cuentas y devuelve el token. Null si se arrepintió.
Future<String?> pedirTokenDeGoogle() async {
  if (!hayGoogle) {
    throw ErrorGoogle('Entrar con Google no está configurado en esta versión.');
  }

  try {
    // Se cierra la sesión anterior para que siempre pregunte con cuál: en un
    // teléfono con dos cuentas, entrar con la equivocada sin que te pregunte
    // es peor que un toque de más.
    await _google.signOut();

    final cuenta = await _google.signIn();
    if (cuenta == null) return null;

    final token = (await cuenta.authentication).idToken;
    if (token == null || token.isEmpty) {
      throw ErrorGoogle(
        'Google no devolvió la sesión. Revisa la configuración del proyecto.',
      );
    }
    return token;
  } on ErrorGoogle {
    rethrow;
  } catch (_) {
    throw ErrorGoogle('No pudimos hablar con Google. Inténtalo de nuevo.');
  }
}

/// Olvida la cuenta en el teléfono. Al desvincular, para que la próxima vez
/// no entre sola con la de antes.
Future<void> olvidarGoogle() async {
  try {
    await _google.disconnect();
  } catch (_) {
    // Si no había nada que olvidar, tampoco pasa nada.
  }
}
