import 'package:flutter/material.dart';

import '../iconos.dart';

import '../sesion.dart';
import '../tema.dart';
import 'compras.dart';
import 'equipo.dart';
import 'catalogo_servicios.dart';
import 'gastos.dart';
import 'negocio.dart';
import 'proveedores.dart';
import 'recordatorios.dart';
import 'reportes.dart';
import 'ventas.dart';

/// El resto del panel. La agenda vive en las cuatro pestañas de siempre;
/// aquí queda todo lo que se consulta de vez en cuando, agrupado por tema.
class PantallaMas extends StatelessWidget {
  const PantallaMas({super.key});

  @override
  Widget build(BuildContext context) {
    final api = Sesion.de(context);
    final negocio = Sesion.catalogo?.negocio;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Text('Más', style: titulo(29)),
            const SizedBox(height: 4),
            Text(
              negocio?.nombre ?? 'Arialé Studio',
              style: const TextStyle(fontSize: 13.5, color: Marca.textoSuave),
            ),
            const SizedBox(height: 18),
            const _Grupo('Caja', [
              _Entrada(
                icono: Ico.ventas,
                rotulo: 'Ventas',
                apoyo: 'Lo que vendiste y lo que te pagaron',
                color: Marca.dorado,
                crear: PantallaVentas.new,
              ),
              _Entrada(
                icono: Ico.bajada,
                rotulo: 'Gastos',
                apoyo: 'En qué se va el dinero',
                color: Marca.durazno,
                crear: PantallaGastos.new,
              ),
              _Entrada(
                icono: Ico.compras,
                rotulo: 'Compras y pagos',
                apoyo: 'Material y lo que le debes a alguien',
                color: Marca.cielo,
                crear: PantallaCompras.new,
              ),
              _Entrada(
                icono: Ico.proveedores,
                rotulo: 'Proveedores',
                apoyo: 'A quién le compras',
                color: Marca.textoSuave,
                crear: PantallaProveedores.new,
              ),
            ]),
            const _Grupo('Clientas', [
              _Entrada(
                icono: Ico.recordatorios,
                rotulo: 'Recordatorios',
                apoyo: 'Mensajes de WhatsApp listos para enviar',
                color: Marca.exito,
                crear: PantallaRecordatorios.new,
              ),
            ]),
            const _Grupo('El estudio', [
              _Entrada(
                icono: Ico.reportes,
                rotulo: 'Reportes',
                apoyo: 'Cómo va el negocio',
                color: Marca.lavanda,
                crear: PantallaReportes.new,
              ),
              _Entrada(
                icono: Ico.servicios,
                rotulo: 'Servicios y bonos',
                apoyo: 'Precios, duraciones y paquetes',
                color: Marca.rosa,
                crear: PantallaCatalogoServicios.new,
              ),
              _Entrada(
                icono: Ico.equipo,
                rotulo: 'Equipo',
                apoyo: 'Especialistas y sus claves',
                color: Marca.salvia,
                crear: PantallaEquipo.new,
              ),
              _Entrada(
                icono: Ico.negocio,
                rotulo: 'Mi negocio',
                apoyo: 'Datos, horario y agenda',
                color: Marca.negro,
                crear: PantallaNegocio.new,
              ),
            ]),
            const SizedBox(height: 24),
            Center(
              child: Text(
                api.nombreUsuaria ?? '',
                style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: TextButton.icon(
                onPressed: () => _confirmarSalida(context),
                icon: const Icon(Ico.salir, size: 18),
                label: const Text('Cerrar sesión'),
                style: TextButton.styleFrom(foregroundColor: Marca.textoSuave),
              ),
            ),
            const SizedBox(height: 10),
            Center(
              child: Text(
                'Servidor: ${api.servidor}',
                style: const TextStyle(fontSize: 11, color: Marca.textoSuave),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmarSalida(BuildContext context) async {
    final api = Sesion.de(context);
    final salir = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Cerrar sesión?'),
        content: const Text('Tendrás que escribir tu correo y contraseña de nuevo.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Quedarme'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (salir == true) await api.salir();
  }
}

class _Grupo extends StatelessWidget {
  const _Grupo(this.rotulo, this.entradas);

  final String rotulo;
  final List<_Entrada> entradas;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8, top: 14),
          child: Text(rotulo.toUpperCase(), style: micro()),
        ),
        Card(
          child: Column(
            children: [
              for (var i = 0; i < entradas.length; i++) ...[
                if (i > 0) const Divider(indent: 60),
                entradas[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Entrada extends StatelessWidget {
  const _Entrada({
    required this.icono,
    required this.rotulo,
    required this.apoyo,
    required this.color,
    required this.crear,
  });

  final IconData icono;
  final String rotulo;
  final String apoyo;
  final Color color;
  final Widget Function({Key? key}) crear;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(9),
        ),
        child: Icon(icono, size: 18, color: Marca.contrasteSobre(color)),
      ),
      title: Text(
        rotulo,
        style: const TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 15.5,
          letterSpacing: -0.3,
        ),
      ),
      subtitle: Text(apoyo, style: sutil(12.5, color: Marca.textoTenue)),
      trailing: const Icon(Ico.siguiente, size: 20, color: Marca.textoTenue),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => crear()),
      ),
    );
  }
}
