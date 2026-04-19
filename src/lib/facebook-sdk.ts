// ─────────────────────────────────────────────────────────────
// Facebook SDK loader + typed wrappers for FB.login.
//
// Loaded on-demand the first time the user clicks "Connecter
// WhatsApp", not on every page render.
// ─────────────────────────────────────────────────────────────

export type FBLoginResponse = {
  status: 'connected' | 'not_authorized' | 'unknown'
  authResponse?: {
    accessToken: string
    userID: string
    expiresIn: number
    signedRequest?: string
    graphDomain?: string
    data_access_expiration_time?: number
  }
}

type FBApi = {
  init: (opts: {
    appId: string
    cookie?: boolean
    xfbml?: boolean
    version: string
  }) => void
  login: (
    cb: (response: FBLoginResponse) => void,
    opts?: { scope?: string; config_id?: string; auth_type?: string; extras?: Record<string, unknown> },
  ) => void
  getLoginStatus: (cb: (response: FBLoginResponse) => void) => void
}

declare global {
  interface Window {
    FB?: FBApi
    fbAsyncInit?: () => void
  }
}

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js'
const SCRIPT_ID = 'facebook-jssdk'
const API_VERSION = 'v21.0'

let loadPromise: Promise<FBApi> | null = null

export function loadFacebookSDK(appId: string): Promise<FBApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('FB SDK requires a browser'))
  if (loadPromise) return loadPromise

  loadPromise = new Promise<FBApi>((resolve, reject) => {
    // Already loaded?
    if (window.FB) {
      try {
        window.FB.init({ appId, version: API_VERSION, cookie: true, xfbml: false })
      } catch { /* already inited */ }
      resolve(window.FB)
      return
    }

    window.fbAsyncInit = () => {
      try {
        window.FB!.init({ appId, version: API_VERSION, cookie: true, xfbml: false })
        resolve(window.FB!)
      } catch (err) {
        reject(err)
      }
    }

    // Inject the SDK script once
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      script.defer = true
      script.crossOrigin = 'anonymous'
      script.src = SDK_URL
      script.onerror = () => reject(new Error('Impossible de charger le SDK Facebook'))
      document.body.appendChild(script)
    }
  })

  return loadPromise
}

export function fbLogin(fb: FBApi, scope: string): Promise<FBLoginResponse> {
  return new Promise((resolve) => {
    fb.login((response) => resolve(response), {
      scope,
      auth_type: 'rerequest',
      extras: { feature: 'whatsapp_embedded_signup' },
    })
  })
}
