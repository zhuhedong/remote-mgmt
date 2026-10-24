# Android signing

Release APKs are signed with a dedicated **upload keystore** so side-loaded updates keep the same signature.

## Local release build

1. Place `keystore.properties` next to this folder’s `settings.gradle.kts` (gitignored). Example:

```
storeFile=keystore/dsh-remote-upload.p12
storePassword=…
keyAlias=dsh_remote_upload
keyPassword=…
```

2. Put the `.p12` under `android/keystore/` (gitignored).
3. `./gradlew :app:assembleRelease` → `app/build/outputs/apk/release/app-release.apk`

## CI

GitHub Actions secrets (repo `zhuhedong/remote-mgmt`):

- `ANDROID_KEYSTORE_BASE64` — base64 of the `.p12`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD` (same as store password for PKCS12)

On push to `master`, CI uploads artifact `app-release` when those secrets are present. Tag releases use the same secrets via `release.yml`.

## Important

- Never commit the keystore or passwords.
- Switching from the old **debug**-signed CI APK to this release key requires uninstalling the old app once (Android rejects signature mismatch). After that, future release builds update in place.
