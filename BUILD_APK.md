# APK Build Guide - Yeniden 104

## 🚀 Optie 1: Lokaal builden (Makkelijk op Mac/Linux)

### Requirements:
- Node.js en npm (al geïnstalleerd)
- Java JDK 11+ 
- Android SDK

### Stappen:

```bash
# 1. Repository clonen (als je het nog niet hebt)
git clone https://github.com/aliteker42/afvallen.git
cd afvallen

# 2. Dependencies installeren
npm install

# 3. Android platform toevoegen (eerste keer)
npx cap add android

# 4. Sync bestanden naar Android
npx cap sync android

# 5. Build APK
cd android
./gradlew assembleRelease

# APK is nu in: android/app/build/outputs/apk/release/app-release.apk
```

## 🌐 Optie 2: Cloud Build (Makkelijk, gratis)

Gebruik **EAS Build** (Expo + Capacitor):

1. Ga naar https://eas.expo.dev/
2. Sign up met GitHub
3. `npm install -g eas-cli`
4. `eas build --platform android --local`

## 🔄 Auto-Updates Setup

Zodra APK gebuild is:

1. App opent https://aliteker42.github.io/afvallen/ als base
2. Service Worker checkt voor updates
3. Updates laden automatisch in de achtergrond
4. Geen herinstall nodig!

## 📱 Na Build:
- Transfer APK naar je telefoon
- Install APK
- App werkt nu offline + auto-updates!

## 🐛 Troubleshooting

**"Android SDK not found"**
- Install Android Studio
- Setup Android SDK path in ~/.bash_profile:
  ```
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
  ```

**"Gradle build failed"**
- Check Java version: `java -version` (need 11+)
- Run: `./gradlew clean` dan retry
