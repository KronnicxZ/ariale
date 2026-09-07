package com.arialestudio.ariale_movil

import io.flutter.embedding.android.FlutterFragmentActivity

// Fragment y no Activity a secas: el diálogo de huella de Android se dibuja
// como un fragmento, y sin esto local_auth no puede enseñarlo.
class MainActivity : FlutterFragmentActivity()
