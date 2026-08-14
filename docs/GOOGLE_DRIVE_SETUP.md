# Direct Google Drive import setup

Frame's Google Drive integration is designed for browser-side **read-only import**. It uses Google Identity Services (GIS) to request an OAuth access token only when the user chooses to connect Google Drive. Frame does not embed or require a Google OAuth client secret in browser code.

## 1. Create a Google OAuth web client

In a Google Cloud project:

1. Configure the OAuth consent screen for the intended users/testers.
2. Create an OAuth 2.0 client whose application type is **Web application**.
3. Add every Frame deployment origin that will request authorization to the client's **Authorized JavaScript origins**. Include the local development origin you actually use, for example `http://localhost:5173`.
4. Enable the Google Drive API for the project.

Do not place a client secret in Frame's frontend configuration.

## 2. Configure Frame

Set the public client ID in the Vite environment:

```bash
VITE_GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
```

For local development this can live in an uncommitted `.env.local` file:

```bash
VITE_GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
```

Restart Vite after changing environment variables.

If `VITE_GOOGLE_CLIENT_ID` is absent, Frame should continue to support the existing Google route: download a Google Doc/Sheet/Slides file as DOCX/XLSX/PPTX and use the normal Office import. Direct Google import should present a clear "not configured" state rather than failing silently.

## 3. Scope and token behavior

Frame requests:

```text
https://www.googleapis.com/auth/drive.readonly
```

The direct-import flow is intentionally read-only:

1. GIS returns an access token to the browser.
2. The token is held ephemerally by the import UI, not written into the Frame workspace/session.
3. Frame lists native Google Docs, Sheets and Slides through Drive.
4. The selected file is exported by Drive in memory to DOCX, XLSX or PPTX.
5. The exact same Office semantic planner used for local files produces the governed preview.
6. No semantic mutation is applied until the user approves that preview.

The current provider does not create, edit or delete Google Drive files.

## 4. Current code boundary

- `src/googleIdentity.ts` — loads GIS and obtains a read-only access token.
- `src/googleDriveProvider.ts` — Drive file discovery and native-file export transport.
- `src/googleWorkspaceImport.ts` — maps Google file kinds to Office export MIME types and invokes the Office planner.
- `src/officeImportSync.ts` — source-aware re-import synchronization for Google revisions.
- `src/components/GoogleDriveImportDialog.tsx` — chooser/search/pagination UI.
- `src/officeImportPlanner.ts` — common DOCX/PPTX/XLSX semantic conversion.

This split is deliberate: Google authentication/transport should never become a second document conversion engine.

## 5. Local verification

The focused tests include the identity and provider boundaries:

```bash
node --experimental-strip-types --test \
  tests/googleIdentity.test.mjs \
  tests/googleDriveProvider.test.mjs \
  tests/googleWorkspaceImport.test.mjs \
  tests/googleWorkspaceReimport.test.mjs
```

The tests use fake GIS/Drive transports; they do not require a real Google account or token.

For a real-account smoke test, use a dedicated non-sensitive test Drive containing sanitized Docs/Sheets/Slides fixtures. Verify that:

- the consent request is read-only;
- file search/listing works;
- selecting each native Google file produces the normal Frame semantic preview;
- fidelity warnings are visible before Apply; and
- re-importing a newer revision from the same Google source replaces the prior imported projection rather than duplicating it.

## 6. Deployment/security notes

- Keep the configured OAuth client ID public; it is an identifier, not a secret.
- Never add an OAuth client secret to `VITE_*` variables or frontend code.
- Restrict Authorized JavaScript origins to actual Frame deployments.
- Keep Drive permissions least-privilege; this importer currently needs read-only Drive access only.
- Do not persist Drive access tokens inside Frame workspace JSON, local semantic history, URLs, logs or source provenance.
- Treat exported DOCX/PPTX/XLSX bytes as untrusted Office input and pass them through the same bounded ZIP reader used for local imports.
