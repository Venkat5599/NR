plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.lunar.keyboard"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.lunar.keyboard"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.3.2"
        buildConfigField("String", "PAY_CONTRACT", "\"${providers.gradleProperty("lunar.payContract").getOrElse("lunarpay-0111.testnet")}\"")
        buildConfigField("String", "API_BASE", "\"${providers.gradleProperty("lunar.apiBase").getOrElse("")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the debug key until a release key exists, so the APK installs.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }

    testOptions { unitTests.isReturnDefaultValues = true }

    packaging { resources { excludes += setOf("META-INF/versions/9/OSGI-INF/MANIFEST.MF") } }
}

dependencies {
    implementation("org.bouncycastle:bcprov-jdk18on:1.78.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

// the unit tests read the cases shared with the web keyboard; rerun them when that file changes
tasks.withType<Test>().configureEach {
    inputs.files(rootProject.file("../shared-fixtures/cases.json")).withPropertyName("sharedFixtures")
}
