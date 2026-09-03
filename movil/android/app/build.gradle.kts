import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // Avisos de citas próximas por push: lee google-services.json.
    id("com.google.gms.google-services")
}

// Firma de release. Si existe android/key.properties se usa esa llave; si no,
// se firma con la de depuración para que `flutter build` siga funcionando.
// La llave real NO va al repositorio: ver INSTALAR.md.
val propiedadesFirma = Properties()
val archivoFirma = rootProject.file("key.properties")
if (archivoFirma.exists()) {
    propiedadesFirma.load(archivoFirma.inputStream())
}

android {
    namespace = "com.arialestudio.ariale_movil"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Los avisos de citas próximas (flutter_local_notifications) lo piden
        // para programar notificaciones en versiones viejas de Android.
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // Identificador de la app en el teléfono. No cambiarlo nunca: si
        // cambia, Android la trata como otra app distinta.
        applicationId = "com.arialestudio.ariale_movil"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("estudio") {
            if (archivoFirma.exists()) {
                storeFile = file(propiedadesFirma.getProperty("storeFile"))
                storePassword = propiedadesFirma.getProperty("storePassword")
                keyAlias = propiedadesFirma.getProperty("keyAlias")
                keyPassword = propiedadesFirma.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (archivoFirma.exists()) {
                signingConfigs.getByName("estudio")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}
