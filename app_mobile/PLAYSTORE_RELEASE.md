# Play Store Release

## 1) Create upload keystore (one time)

```bash
keytool -genkeypair -v \
  -keystore /home/chems/Documents/mon_site/android/ime-friendly-upload.keystore \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

## 2) Create signing config file (one time)

Copy `android/keystore.properties.example` to `android/keystore.properties` and fill:

```properties
storeFile=/home/chems/Documents/mon_site/android/ime-friendly-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD
```

## 3) Build release AAB

```bash
cd /home/chems/Documents/mon_site
./app_mobile/scripts/build_playstore_bundle.sh
```

Output:

`android/app/build/outputs/bundle/release/app-release.aab`

## 4) Upload in Play Console

1. Go to `Production` or `Internal testing`.
2. Create new release.
3. Upload `app-release.aab`.
4. Complete release notes and rollout.
