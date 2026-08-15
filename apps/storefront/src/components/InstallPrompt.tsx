import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'redbird_pwa_install_dismissed'

/** A small bottom banner offering to install the storefront as an app —
 * only ever shown when the browser itself judges the page installable
 * (fires `beforeinstallprompt`), and only once per dismissal. */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!deferredPrompt) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDeferredPrompt(null)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 flex items-start gap-3">
      <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">Install this store</p>
        <p className="text-xs text-gray-500 mt-0.5">Add it to your home screen for quick access.</p>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => void install()}
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
