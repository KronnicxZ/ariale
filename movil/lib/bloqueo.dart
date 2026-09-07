import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// El candado de la app.
///
/// La app se abre en la agenda del día, con los teléfonos de las clientas y
/// lo que se ha cobrado. El teléfono pasa el día en el mostrador, así que
/// quien lo coja lo tiene todo. Esto pide huella o PIN antes de enseñar
/// nada.
///
/// El PIN manda y la huella es un atajo: un lector que no lee, un dedo
/// mojado o un teléfono sin sensor no pueden dejar a nadie fuera de su
/// propia agenda. Por eso no se puede activar el candado sin poner PIN.
///
/// No guarda el PIN, guarda su huella digital: sal aleatoria + SHA-256. Aun
/// leyendo el archivo de preferencias no se saca el número.
class Bloqueo {
  const Bloqueo._();

  static const _claveActivo = 'bloqueo_activo';
  static const _clavePin = 'bloqueo_pin';
  static const _claveSal = 'bloqueo_sal';
  static const _claveHuella = 'bloqueo_huella';
  static const _claveEspera = 'bloqueo_espera';
  static const _claveFallos = 'bloqueo_fallos';
  static const _claveCastigo = 'bloqueo_castigo';

  /// Cuánto puede estar la app en segundo plano antes de volver a pedir el
  /// PIN. Cero es "al momento".
  ///
  /// El valor por defecto no es cero a propósito: la app abre WhatsApp para
  /// cada aviso a una clienta, y volver de WhatsApp es lo más normal del
  /// mundo. Con cero, el candado se convertiría en un peaje cada dos
  /// minutos y acabarían quitándolo.
  static const esperasPosibles = <int>[0, 60, 300];
  static const _esperaPorDefecto = 60;

  static final _auth = LocalAuthentication();

  static Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */

  static Future<bool> get activo async =>
      (await _prefs).getBool(_claveActivo) ?? false;

  static Future<bool> get conHuella async =>
      (await _prefs).getBool(_claveHuella) ?? true;

  static Future<int> get espera async =>
      (await _prefs).getInt(_claveEspera) ?? _esperaPorDefecto;

  /// Si el teléfono tiene lector y hay algo registrado en él.
  static Future<bool> get hayHuellaEnElTelefono async {
    if (kIsWeb) return false;
    try {
      if (!await _auth.isDeviceSupported()) return false;
      return (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Poner y quitar                                                      */
  /* ------------------------------------------------------------------ */

  /// Enciende el candado con un PIN nuevo. Sin PIN no hay candado.
  static Future<void> activar(String pin, {required bool huella}) async {
    final prefs = await _prefs;
    final sal = _salNueva();
    await prefs.setString(_claveSal, sal);
    await prefs.setString(_clavePin, _resumen(pin, sal));
    await prefs.setBool(_claveActivo, true);
    await prefs.setBool(_claveHuella, huella);
    await prefs.setInt(_claveEspera, prefs.getInt(_claveEspera) ?? _esperaPorDefecto);
    await _olvidarFallos();
  }

  /// Apaga el candado y borra el PIN. Solo desde Seguridad y con el PIN en
  /// la mano: quien tenga el teléfono abierto no puede quitarlo a ciegas.
  static Future<void> desactivar() async {
    final prefs = await _prefs;
    await prefs.remove(_claveActivo);
    await prefs.remove(_clavePin);
    await prefs.remove(_claveSal);
    await _olvidarFallos();
  }

  static Future<void> cambiarHuella(bool valor) async =>
      (await _prefs).setBool(_claveHuella, valor);

  static Future<void> cambiarEspera(int segundos) async =>
      (await _prefs).setInt(_claveEspera, segundos);

  /* ------------------------------------------------------------------ */
  /* Comprobar                                                           */
  /* ------------------------------------------------------------------ */

  /// Cuántos segundos quedan de castigo por fallar el PIN. Cero si ninguno.
  static Future<int> get castigoRestante async {
    final hasta = (await _prefs).getInt(_claveCastigo) ?? 0;
    final quedan = (hasta - DateTime.now().millisecondsSinceEpoch) ~/ 1000;
    return quedan > 0 ? quedan : 0;
  }

  /// Comprueba el PIN. Falla varias veces seguidas y hay que esperar: es lo
  /// único que separa un PIN de cuatro cifras de probarlas todas.
  static Future<bool> comprobarPin(String pin) async {
    final prefs = await _prefs;
    final guardado = prefs.getString(_clavePin);
    final sal = prefs.getString(_claveSal);
    if (guardado == null || sal == null) return false;

    if (_resumen(pin, sal) == guardado) {
      await _olvidarFallos();
      return true;
    }

    final fallos = (prefs.getInt(_claveFallos) ?? 0) + 1;
    await prefs.setInt(_claveFallos, fallos);
    final castigo = _castigoPor(fallos);
    if (castigo > 0) {
      await prefs.setInt(
        _claveCastigo,
        DateTime.now().add(Duration(seconds: castigo)).millisecondsSinceEpoch,
      );
    }
    return false;
  }

  /// Pide la huella. Devuelve false si no se pudo o si la rechazaron; el PIN
  /// sigue estando debajo, así que un false nunca deja a nadie fuera.
  static Future<bool> pedirHuella() async {
    if (!await conHuella) return false;
    try {
      return await _auth.authenticate(
        localizedReason: 'Desbloquea Arialé Studio',
        options: const AuthenticationOptions(
          stickyAuth: true,
          // Solo biometría: el patrón del teléfono no vale aquí, porque
          // quien tiene el teléfono desbloqueado ya lo sabe.
          biometricOnly: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */

  /// 5 fallos, medio minuto; 10, cinco minutos. Antes, nada: equivocarse una
  /// vez tecleando es normal y castigarlo solo molesta.
  static int _castigoPor(int fallos) {
    if (fallos >= 10) return 300;
    if (fallos >= 5) return 30;
    return 0;
  }

  static Future<void> _olvidarFallos() async {
    final prefs = await _prefs;
    await prefs.remove(_claveFallos);
    await prefs.remove(_claveCastigo);
  }

  static String _salNueva() {
    final azar = Random.secure();
    return base64Url.encode(List<int>.generate(16, (_) => azar.nextInt(256)));
  }

  static String _resumen(String pin, String sal) =>
      sha256.convert(utf8.encode('$sal:$pin')).toString();
}
