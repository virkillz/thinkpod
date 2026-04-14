# GitHub Actions Code Signing Setup

This guide explains how to set up code signing and notarization for macOS builds in GitHub Actions.

## Prerequisites

- Apple Developer Account with "Developer ID Application" certificate installed
- Access to your GitHub repository settings

## Step 1: Export Your Code Signing Certificate

### On your Mac:

1. **Open Keychain Access** (Applications > Utilities > Keychain Access)

2. **Find your certificate:**
   - In the left sidebar, select "login" keychain
   - Select "My Certificates" category
   - Find "Developer ID Application: Arif Yuliannur (2QW696JV44)"

3. **Export the certificate:**
   - Right-click on the certificate
   - Select "Export Developer ID Application: Arif Yuliannur..."
   - Save as: `Certificates.p12`
   - Choose a strong password (you'll need this for GitHub Secrets)
   - Click "Save"
   - Enter your Mac password to allow the export

4. **Convert to Base64:**
   ```bash
   base64 -i Certificates.p12 | pbcopy
   ```
   This copies the base64-encoded certificate to your clipboard.

## Step 2: Set Up GitHub Secrets

Go to your GitHub repository: `https://github.com/virkillz/thinkpod/settings/secrets/actions`

Add the following secrets (click "New repository secret" for each):

### Required Secrets:

1. **`MACOS_CERTIFICATE`**
   - Paste the base64-encoded certificate from Step 1
   - This is the output from the `base64` command

2. **`MACOS_CERTIFICATE_PASSWORD`**
   - The password you set when exporting the .p12 file
   - Example: `YourStrongPassword123`

3. **`KEYCHAIN_PASSWORD`**
   - A temporary password for the GitHub Actions keychain
   - Can be any strong random password (it's only used during the build)
   - Example: `TempKeychain2024!`

4. **`APPLE_ID`**
   - Your Apple ID email
   - Example: `virkill@gmail.com`

5. **`APPLE_ID_PASSWORD`**
   - Your app-specific password from appleid.apple.com
   - Format: `xxxx-xxxx-xxxx-xxxx`
   - Get it from: https://appleid.apple.com → Security → App-Specific Passwords

6. **`APPLE_TEAM_ID`**
   - Your Apple Developer Team ID
   - Value: `2QW696JV44`

## Step 3: Test the Workflow

1. **Create a new tag:**
   ```bash
   git tag v0.4.1
   git push origin v0.4.1
   ```

2. **Monitor the workflow:**
   - Go to: `https://github.com/virkillz/thinkpod/actions`
   - Watch the "Release" workflow run
   - Check for any errors in the "Import Code Signing Certificate" step

3. **Verify the build:**
   - The DMG should be signed and notarized
   - Download the DMG from the draft release
   - Right-click and open - it should open without warnings

## Troubleshooting

### Certificate Import Fails
- Verify `MACOS_CERTIFICATE` is correctly base64-encoded
- Check that `MACOS_CERTIFICATE_PASSWORD` matches the export password

### Notarization Fails
- Verify `APPLE_ID` and `APPLE_ID_PASSWORD` are correct
- Check that the app-specific password hasn't expired
- Ensure `APPLE_TEAM_ID` is correct: `2QW696JV44`

### Build Succeeds but App Won't Open
- The certificate might not be valid for distribution
- Check certificate expiration in Keychain Access
- Verify you're using "Developer ID Application" (not "Mac Development")

## Security Notes

- ✅ GitHub Secrets are encrypted and only exposed to workflow runs
- ✅ The temporary keychain is deleted after each build
- ✅ Never commit the .p12 file or passwords to the repository
- ✅ Rotate app-specific passwords periodically

## Certificate Renewal

Your Apple Developer Program renews on: **June 26, 2026**

When you renew or get a new certificate:
1. Export the new certificate following Step 1
2. Update the `MACOS_CERTIFICATE` secret in GitHub
3. Update `MACOS_CERTIFICATE_PASSWORD` if you used a different password
