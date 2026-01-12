---
description: Build Android APK
---

# Build Android APK

This workflow guides you through building a standalone Android APK for your Expo project.

## Prerequisites

- EAS CLI installed: `npm install -g eas-cli`
- Expo account logged in: `eas login`

## Steps

1. **Configure Build Profile**
   Ensure your `eas.json` has a preview profile with `buildType: "apk"`. (This has been done for you).

2. **Run Build Command**
   Run the following command in your terminal:

   ```powershell
   eas build -p android --profile preview
   ```

3. **Wait for Build**
   - The CLI will upload your code to EAS Build.
   - You can monitor the progress in the terminal or on the Expo dashboard.
   - Once complete, a download link for the `.apk` file will be provided.

4. **Install on Device**
   - Download the APK.
   - Transfer it to your Android device.
   - Install it (you may need to allow installation from unknown sources).
