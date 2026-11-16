# EXE Android · React Native

Baseline Mobile Web: `28f005c8f72af90673a43544c9877d5182a35b30`. The existing Vite entry under `mobile_app` stays available for parity and rollback. The native entry is `mobile_app/native/index.ts`.

## Windows

Install Node 22, JDK 17, Android SDK Platform 36 and NDK 27.1.12297006. For CMake/Ninja on Windows, use a short path for the checkout or a separate build copy (for example `C:\exe-rn\`). Set `JAVA_HOME` to JDK 17 for the build shell.

```powershell
cd mobile_app/native
npm ci
npm run typecheck
npm test
npx expo prebuild --platform android
npx expo run:android
```

A debug APK built with `android\gradlew.bat :app:assembleDebug` is under `android/app/build/outputs/apk/debug/`. Start Metro with `npx expo start --dev-client` to load the local JavaScript bundle. Install using `adb install -r PATH_TO_APK`. Android/emulator networking uses `adb reverse` when Metro runs on localhost.

On Windows, Android autolinking builds Expo GL from source so the APK contains the matching native library for both emulator and device. Metro resolves all Three.js imports to the same ESM instance for Hermes and the GLB loader.

## Account and Cloud Save

Copy `.env.example` to `.env.local` and use the publishable key for the configured Supabase staging project. Add `exe-boardgame://auth/callback` to the staged Supabase Auth redirect URL list before testing email confirmation on a real device. The API origin is the Fastify service. Game data is written through Fastify. The public key is used by Supabase Auth, with PKCE and token persistence using SecureStore. All attempts, canonical state, ownership and versions are enforced by Fastify. Local practice needs no account and saves with the existing schema 7 serializer.

The app defaults to canonical What-if with deterministic feedback. The What-if explanation flag permits the existing Fastify assistant to use its separately configured provider. Cáo always uses deterministic on-device learning and the existing verified game evidence.

For Android staging acceptance, use the confirmed test account directly in **Bắt đầu phiêu lưu → Đăng nhập để lưu ván**. Set `EXPO_PUBLIC_EXE_WHATIF_GEMINI=0` in the Metro environment. Keep the game synthetic and record its session ID and stateVersion before opening What-if. After confirming the alternative and viewing the comparison, reopen the original Cloud Save and compare those values and its official result. Sign out when done.

For a connected emulator or USB-debugging device, run `adb reverse tcp:8092 tcp:8092` and start Metro with `npx expo start --dev-client --localhost --port 8092`. Install the debug APK, then open the Expo development server at `http://127.0.0.1:8092` in the app. The APK needs Metro to load application code.

## Standalone Android staging test build

In the short-path build checkout, configure the three public staging settings from `.env.example` for the build process and set `EXPO_PUBLIC_EXE_WHATIF_GEMINI=0`. Use the staging project's publishable key. Gradle embeds the production-mode Hermes bundle and its assets.

```powershell
cd mobile_app/native
npx expo prebuild --platform android
cd android
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=x86_64,arm64-v8a'
adb install -r app/build/outputs/apk/release/app-release.apk
```

The generated Expo template signs this test APK with the local debug signing key. Launch **EXE · Mỏ Hỗn** from Android with Metro disconnected. The test APK has the same application ID as the debug client and can replace it on devices using the same signing key.

## Structure

| Native area | Reuses |
| --- | --- |
| Entrance and chapter map | Original art, Fredoka, chapter node coordinates |
| B18 board and HUD | 18 engine tiles, original background, board, pawn model, asset and dice controls |
| Decision layer | Canonical choices, funding options, quote endpoints and existing financial wording |
| START, recap and results | Canonical summaries, official Cloud Save result or canonical device selectors |
| Board Peek | Existing D6 destinations and an in-place hidden decision layer |
| Cáo and What-if | Local mascot learning and shared replay/alternative contracts |
| Device saves and accounts | Existing canonical save format and Fastify client, React Native storage adapters |

Expo continuous native generation makes Android build output reproducible from the committed app configuration. Expo Go and a local development build can run the JS app. The local development build provides the EXE-specific package and confirmation deep link. iOS has a bundle identifier and scheme and requires its own build and runtime QA.
