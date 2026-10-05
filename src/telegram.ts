/** Minimal Telegram Mini App bootstrap. Works as a normal web app too. */
export function initTelegramWebApp(): void {
  try {
    const webApp = (window as any).Telegram?.WebApp
    if (!webApp) return
    webApp.ready()
    webApp.expand()
  } catch {
    // Running outside Telegram: nothing to initialize.
  }
}
