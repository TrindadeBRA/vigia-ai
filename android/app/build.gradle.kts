plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    // Piso prático: DreamService existe desde API 17 e CATEGORY_HOME desde API 1;
    // API 21 (Android 5.0 Lollipop, 2014) cobre todo celular velho reaproveitável
    // e mantém Views XML puro sem Compose.
    namespace = "ai.vigia.monitor"
    compileSdk = 35

    defaultConfig {
        applicationId = "ai.vigia.monitor"
        minSdk = 21
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
        debug {
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// JSON/SSE via org.json + HttpURLConnection (framework). Única dependência
// externa: ZXing core (decode de QR puro-Java, sem Play Services) para o
// QrScanActivity ler o QR de /display/theme em celular velho offline.
dependencies {
    implementation("com.google.zxing:core:3.5.3")
}
