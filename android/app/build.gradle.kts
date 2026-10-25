import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

fun propOrEnv(key: String, env: String): String? =
    keystoreProps.getProperty(key)?.takeIf { it.isNotBlank() }
        ?: System.getenv(env)?.takeIf { it.isNotBlank() }

android {
    namespace = "cn.zhuhedong.remote"
    compileSdk = 35

    defaultConfig {
        applicationId = "cn.zhuhedong.remote"
        minSdk = 28
        targetSdk = 35
        versionCode = 8
        versionName = "0.3.5"
        buildConfigField("String", "DEFAULT_HUB", "\"https://remote.zhuhedong.cn\"")
    }

    signingConfigs {
        create("release") {
            val store = propOrEnv("storeFile", "ANDROID_KEYSTORE_FILE")
            val storePass = propOrEnv("storePassword", "ANDROID_KEYSTORE_PASSWORD")
            val alias = propOrEnv("keyAlias", "ANDROID_KEY_ALIAS")
            val keyPass = propOrEnv("keyPassword", "ANDROID_KEY_PASSWORD")
            // Also accept Gradle injected signing (CI release.yml)
            val injStore = project.findProperty("android.injected.signing.store.file") as String?
            val injStorePass = project.findProperty("android.injected.signing.store.password") as String?
            val injAlias = project.findProperty("android.injected.signing.key.alias") as String?
            val injKeyPass = project.findProperty("android.injected.signing.key.password") as String?
            if (injStore != null && injStorePass != null && injAlias != null && injKeyPass != null) {
                storeFile = file(injStore)
                storePassword = injStorePass
                keyAlias = injAlias
                keyPassword = injKeyPass
            } else if (store != null && storePass != null && alias != null && keyPass != null) {
                storeFile = rootProject.file(store)
                storePassword = storePass
                keyAlias = alias
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val rel = signingConfigs.findByName("release")
            if (rel?.storeFile != null) {
                signingConfig = rel
            }
        }
        debug {
            // Keep debug keystore for local install; release signing is separate.
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions { unitTests.isIncludeAndroidResources = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.32.2")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.32.2")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

tasks.withType<Test>().configureEach {
    val shots = project.hasProperty("screenshots")
    systemProperty("roborazzi.test.record", shots.toString())
    systemProperty("shots.dir", rootProject.file("../docs/android-ui-v3").absolutePath)
    if (!shots) exclude("**/ScreenshotTest*")
}
