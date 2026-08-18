// Public links shared outside the app.
//
// APP_INVITE_URL is appended to group-invite share messages so people
// without the app know where to get it. While empty, share messages fall
// back to the code-only text. Set it to the public TestFlight invite link
// (https://testflight.apple.com/join/XXXX) during beta, and switch to the
// store / landing page link at launch.
export const APP_INVITE_URL = "https://testflight.apple.com/join/sfucVba3";

// Builds the group-invite share text. `t` is the i18n translate function.
export function buildGroupInviteMessage(
  t: (key: string, options?: Record<string, string>) => string,
  code: string
): string {
  return APP_INVITE_URL
    ? t("waitingRoom.shareMessageWithLink", { code, link: APP_INVITE_URL })
    : t("waitingRoom.shareMessage", { code });
}

// Public legal pages, served by Firebase Hosting from the repo's hosting/ folder.
// nomi.app is registered but not yet pointed at Hosting (it 404s), so these use
// the Hosting domain for now — switch both to https://nomi.app/... once the
// custom domain is connected.
export const PRIVACY_URL = "https://nomi-mvp.web.app/privacy";
export const TERMS_URL = "https://nomi-mvp.web.app/terms";
