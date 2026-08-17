/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENTRA AUTH — Institutional sign-in via Microsoft Entra (MSAL Browser)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wraps the vendored MSAL Browser bundle in a small, generic sign-in module so
 * that any tool needing an institutional identity can share one account, one
 * app registration and one token cache. Foundry is the first consumer; a future
 * Ally reporting Worker joins by adding one line to SCOPES and one scope to the
 * same registration, without touching anything else in here.
 *
 * INERT UNTIL init() IS CALLED. Loading this file constructs nothing, contacts
 * nobody, registers no listener and writes no storage. There is deliberately no
 * DOMContentLoaded branch and no self-initialisation at the end of the IIFE, so
 * a normal page load never reaches Microsoft. The sign-in card wires init() in a
 * later stage; until then this module is dead weight by design.
 *
 * MUST LOAD AFTER THE MSAL BUNDLE. The <script> tag in tools.html carries
 * `defer` and sits immediately after auth/msal-browser-5.17.1.min.js. Deferred
 * scripts execute in document order, which is what guarantees window.msal
 * exists by the time init() can be reached. If it is absent anyway, init()
 * logs an ERROR naming the dependency and returns rather than throwing.
 *
 * Public API (window.EntraAuth):
 *   init()                  → Promise<void>    idempotent; safe to call n times
 *   signIn()                → void             navigates away (redirect flow)
 *   signOut()               → void             navigates away (redirect flow)
 *   getToken(scopeName)     → Promise<string|null>  cached, else acquired
 *   ensureFresh(scopeName)  → Promise<string|null>  renews first if it is due
 *   isSignedIn()            → boolean          synchronous
 *   getAccount()            → object|null      the current MSAL account
 *   getCachedToken(scope)   → string|null      SYNCHRONOUS; never a promise
 *   CHANGE_EVENT            → string           the state-change event name
 *
 * Architecture: IIFE with a window global. No NPM — loaded via a <script> tag.
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.EntraAuth = (function () {
  "use strict";

  // ── Logging (own sink; British spelling) ──────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[EntraAuth]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[EntraAuth]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[EntraAuth]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[EntraAuth]", message, ...args);
  }

  // ── App registration (measured during the F2 spike) ───────────────────────
  const TENANT_ID = "4a5378f9-29f4-4d3e-be89-669d03ada9d8";
  const CLIENT_ID = "c5a32fae-3bc3-4337-9be3-52ddccfd6256";
  const AUTHORITY = "https://login.microsoftonline.com/" + TENANT_ID;

  // Named scopes, so a second Worker joins by adding one line here rather than
  // by changing any call site.
  //
  // LOAD-BEARING: the `api://` form below is the Application ID URI, and it is
  // what MSAL must be asked for. It is NOT the audience that arrives in the
  // issued token — that is the bare client id, because the registration pins
  // requestedAccessTokenVersion to 2, and the Cloudflare Worker validates `aud`
  // against the bare form. The two strings differ on purpose; do not "tidy"
  // one into the other.
  //
  // Never mix a Microsoft Graph scope into the same request. One access token
  // carries exactly one audience, so asking for Graph alongside Foundry.Access
  // yields a token the Worker will reject.
  const SCOPES = {
    foundry: "api://c5a32fae-3bc3-4337-9be3-52ddccfd6256/Foundry.Access",
    // The Ally scope exists on the app registration, with consent set to
    // "Admins and users". NOTHING requests it yet — it is registered here so a
    // later stage can ask for it by name without touching any call site.
    // signIn() deliberately requests SCOPES.foundry ALONE, because one access
    // token carries exactly one audience; adding this scope to that request
    // would yield a token the Foundry Worker rejects.
    ally: "api://c5a32fae-3bc3-4337-9be3-52ddccfd6256/Ally.Access",
  };

  // The state-change event name.
  //
  // LOAD-BEARING: consumers subscribe with
  //   window.addEventListener(EntraAuth.CHANGE_EVENT, handler)
  // There is deliberately no subscribe() method, matching the
  // `provider:changed` precedent in openrouter-embed/provider-switcher.js.
  const CHANGE_EVENT = "entra:changed";

  // ── Token lifetime (measured, not assumed) ────────────────────────────────
  // The spike measured exp minus iat at 4,078 seconds — about 68 minutes. Entra
  // randomises access token lifetime roughly between 60 and 90 minutes, so a
  // hardcoded 3,600 would schedule some renewals AFTER the token had already
  // expired. Every timer here is computed from the token's own claims.
  //
  // iat and nbf were identical in the measured token, so the start of the
  // validity window needs no special handling.
  const RENEWAL_FRACTION = 0.75;
  const CLOCK_SKEW_SECONDS = 60;
  const CONSERVATIVE_LIFETIME_SECONDS = 3600; // see cacheToken() for why 3,600
  const MAX_TIMER_MS = 2147483647; // setTimeout overflows past a signed 32-bit ms

  // ── Module state ──────────────────────────────────────────────────────────
  let msalClient = null;
  let initPromise = null;
  let account = null;
  let payloadLogged = false;
  // True only while runInit is priming the token cache — see fireChange().
  let suppressChangeEvents = false;

  // scope name → { token, iat, exp, renewAt } — seconds since the epoch.
  const tokenCache = new Map();
  // scope name → setTimeout handle for the scheduled renewal.
  const renewalTimers = new Map();

  /**
   * The redirect URI is computed, never hardcoded, because the same file has to
   * work at http://localhost:8080/tools.html and at
   * https://matthewdeeprose.github.io/tools.html. Both are registered.
   */
  function computeRedirectUri() {
    const uri = window.location.origin + window.location.pathname;
    if (!window.location.pathname.endsWith("tools.html")) {
      logWarn(
        "Computed redirect URI does not end in tools.html and will not match a " +
          "registered redirect URI — sign-in will fail with AADSTS50011. Computed: " +
          uri,
      );
    }
    return uri;
  }

  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Decode a JWT payload without pulling in a library: split on ".", then
   * base64url-decode the middle segment. The percent-escape dance preserves
   * non-ASCII characters that a bare atob() would mangle.
   */
  function decodeTokenPayload(token) {
    try {
      const segments = String(token).split(".");
      if (segments.length !== 3) return null;

      let encoded = segments[1].replace(/-/g, "+").replace(/_/g, "/");
      while (encoded.length % 4 !== 0) encoded += "=";

      const binary = atob(encoded);
      const escaped = Array.prototype.map
        .call(binary, function (character) {
          return "%" + ("00" + character.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("");

      return JSON.parse(decodeURIComponent(escaped));
    } catch (error) {
      logWarn("Could not decode the token payload", error);
      return null;
    }
  }

  /**
   * Publish the current sign-in state. The detail carries the state and, when
   * signed in, the username — and never a token.
   *
   * Silent while runInit is priming. A priming failure runs acquire()'s own
   * catch, which fires "renewal-failed"; the sign-in card maps that to its
   * EXPIRED state, and runInit's finally then fires "init" and settles the card
   * on SIGNED_IN. Both states reach the card because they differ, so a screen
   * reader user hears, back to back:
   *
   *   "University sign-in: Sign-in expired, please sign in again."
   *   "University sign-in: Signed in as …"
   *
   * The first is untrue — the sign-in has not expired, we merely failed to
   * fetch a token — and it tells somebody to do something that will not help,
   * a second before contradicting itself. Suppressing the intermediate event
   * loses nothing, because the finally fires "init" on every path and the card
   * settles from that. THIS IS WHY THE FLAG EXISTS; do not remove it.
   */
  function fireChange(reason) {
    if (suppressChangeEvents) {
      logDebug(
        "Suppressed " + CHANGE_EVENT + " (reason '" + reason + "') during " +
          "priming — the card would otherwise announce a false 'expired' " +
          "state immediately before 'init' corrects it",
      );
      return;
    }

    const detail = {
      reason: reason,
      isSignedIn: account !== null,
      username: account ? account.username : null,
    };
    logDebug("Dispatching " + CHANGE_EVENT, detail);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: detail }));
  }

  function clearRenewalTimer(scopeName) {
    if (renewalTimers.has(scopeName)) {
      clearTimeout(renewalTimers.get(scopeName));
      renewalTimers.delete(scopeName);
    }
  }

  function clearAllTokens() {
    Array.from(renewalTimers.keys()).forEach(clearRenewalTimer);
    tokenCache.clear();
  }

  /** Schedule a silent renewal at roughly 75 per cent of the token's life. */
  function scheduleRenewal(scopeName) {
    clearRenewalTimer(scopeName);

    const entry = tokenCache.get(scopeName);
    if (!entry) return;

    const delayMs = Math.min(
      Math.max((entry.renewAt - nowSeconds()) * 1000, 0),
      MAX_TIMER_MS,
    );

    const handle = setTimeout(function () {
      renewalTimers.delete(scopeName);
      acquire(scopeName, true).catch(function () {
        // acquire() has already logged and fired the change event.
      });
    }, delayMs);

    renewalTimers.set(scopeName, handle);
    logDebug(
      "Renewal for scope '" + scopeName + "' scheduled in " + Math.round(delayMs / 1000) + "s",
    );
  }

  function cacheToken(scopeName, token) {
    const claims = decodeTokenPayload(token);
    const hasIssuedAt = Boolean(claims && claims.iat);
    const hasExpiry = Boolean(claims && claims.exp);

    // Fall back to a conservative lifetime when the claims cannot be read.
    // 3,600 seconds is the SHORT end of the 60-to-90-minute range Entra
    // randomises within, so renewal at RENEWAL_FRACTION lands at 45 minutes and
    // therefore always precedes a real expiry — a decode failure renews early
    // rather than late. When iat is unreadable too, the interval is measured
    // from the current time rather than from an absent claim, so a renewal time
    // is never computed from undefined.
    const issuedAt = hasIssuedAt ? claims.iat : nowSeconds();
    const expiresAt = hasExpiry
      ? claims.exp
      : issuedAt + CONSERVATIVE_LIFETIME_SECONDS;

    if (!hasExpiry) {
      // Names the claims that failed and the assumption made. Never the token,
      // and never the payload — the payload is DEBUG-only, in one place below.
      logWarn(
        "The exp claim could not be read from the token" +
          (hasIssuedAt ? "" : " (nor could iat)") +
          " — assuming a conservative lifetime of " +
          CONSERVATIVE_LIFETIME_SECONDS +
          " seconds measured from " +
          (hasIssuedAt ? "iat" : "the current time") +
          ", so renewal happens early rather than late.",
      );
    }

    tokenCache.set(scopeName, {
      token: token,
      iat: issuedAt,
      exp: expiresAt,
      renewAt: issuedAt + Math.floor((expiresAt - issuedAt) * RENEWAL_FRACTION),
    });

    if (!payloadLogged && claims) {
      // The only place anything about the token is logged, and only at DEBUG.
      // The token string itself is never logged at any level.
      logDebug("Decoded token payload on first successful sign-in", claims);
      payloadLogged = true;
    }

    scheduleRenewal(scopeName);
  }

  function isUsable(entry) {
    return Boolean(entry) && nowSeconds() < entry.exp - CLOCK_SKEW_SECONDS;
  }

  function isDueForRenewal(entry) {
    return !entry || nowSeconds() >= entry.renewAt;
  }

  /**
   * Acquire a token for one named scope. `force` bypasses the cache but still
   * goes through acquireTokenSilent — never ssoSilent, and never
   * CacheLookupPolicy.Skip.
   */
  async function acquire(scopeName, force) {
    const scope = SCOPES[scopeName];
    if (!scope) {
      logError("Unknown scope name '" + scopeName + "' — known names: " + Object.keys(SCOPES).join(", "));
      return null;
    }
    if (!msalClient || !account) {
      logWarn("Cannot acquire a token for '" + scopeName + "' — not signed in");
      return null;
    }

    if (!force) {
      const cached = tokenCache.get(scopeName);
      if (isUsable(cached)) {
        logDebug("Serving scope '" + scopeName + "' from the module cache");
        return cached.token;
      }
    }

    try {
      const result = await msalClient.acquireTokenSilent({
        scopes: [scope],
        account: account,
      });
      cacheToken(scopeName, result.accessToken);
      logInfo("Token acquired for scope '" + scopeName + "'");
      return result.accessToken;
    } catch (error) {
      logError("Silent token acquisition failed for scope '" + scopeName + "'", error);
      tokenCache.delete(scopeName);
      clearRenewalTimer(scopeName);
      fireChange("renewal-failed");
      return null;
    }
  }

  /** Renew every cached scope whose renewal point has passed. */
  function renewDueScopes(reason) {
    Array.from(tokenCache.keys()).forEach(function (scopeName) {
      if (isDueForRenewal(tokenCache.get(scopeName))) {
        logDebug("Renewing scope '" + scopeName + "' (" + reason + ")");
        acquire(scopeName, true).catch(function () {
          // acquire() has already logged and fired the change event.
        });
      }
    });
  }

  /**
   * A laptop that slept will have missed its scheduled timer, so re-check when
   * the document becomes visible again. Registered inside init() rather than at
   * load, to keep the module genuinely inert until it is wired.
   */
  function onVisibilityChange() {
    if (document.visibilityState === "visible" && account) {
      renewDueScopes("document became visible");
    }
  }

  async function runInit() {
    if (!window.msal || typeof window.msal.createStandardPublicClientApplication !== "function") {
      logError(
        "window.msal unavailable — script load order issue. " +
          "auth/msal-browser-5.17.1.min.js must load before auth/entra-auth.js.",
      );
      return;
    }

    try {
      // createStandardPublicClientApplication constructs AND initialises in one
      // call. The plain constructor needs an explicit await initialize() and
      // throws if that is forgotten, so it is not used here.
      msalClient = await window.msal.createStandardPublicClientApplication({
        auth: {
          clientId: CLIENT_ID,
          authority: AUTHORITY,
          redirectUri: computeRedirectUri(),
          navigateToLoginRequestUrl: false,
        },
        cache: {
          cacheLocation: "sessionStorage",
        },
      });

      // The return leg of a sign-in redirect. This must run before anything
      // else touches MSAL, or the response in the URL fragment is lost.
      const redirectResult = await msalClient.handleRedirectPromise();

      if (redirectResult && redirectResult.account) {
        account = redirectResult.account;
        logInfo("Signed in via redirect as " + account.username);
        if (redirectResult.accessToken) {
          cacheToken("foundry", redirectResult.accessToken);
        }
      } else {
        const accounts = msalClient.getAllAccounts();
        account = accounts && accounts.length > 0 ? accounts[0] : null;
        if (account) {
          logInfo("Existing account adopted: " + account.username);

          // Prime the token cache for the adopted account.
          //
          // Adopting an account used to be the whole of this branch, which left
          // tokenCache empty on every signed-in page load. That is invisible to
          // an awaiting caller — getToken() would simply acquire on demand — but
          // getCachedToken() is synchronous and would answer null, so the FIRST
          // Foundry request after every load would go out unauthenticated and
          // come back 401 for somebody the card says is signed in.
          //
          // Awaited on purpose: the sign-in card settles from this promise, and
          // a card reading "Signed in" over an empty token cache is a claim the
          // very next request disproves. Better to settle a little later and be
          // telling the truth when we do.
          //
          // Not done on the redirect-return path above — cacheToken() already
          // runs there with the token the redirect itself carried.
          //
          // THE FALSY RETURN IS THE REAL FAILURE SIGNAL, NOT THE CATCH.
          // acquire() handles its own failures: it logs an ERROR, drops the
          // cache entry, fires a change event and returns null. It does not
          // throw. So the catch below fires only on a synchronous throw from
          // acquire itself, which is not the failure mode we expect, and a
          // WARN placed only there would never be seen. Test the return value.
          //
          // Change events are suppressed across the await — see fireChange().
          suppressChangeEvents = true;
          try {
            const primed = await acquire("foundry", false);
            if (!primed) {
              logWarn(
                "Could not prime the token cache for the adopted account — " +
                  "the first Foundry request may go unauthenticated",
              );
            }
          } catch (primeError) {
            // NON-FATAL. Initialisation must still settle and still fire its
            // change event, or the card hangs on "Checking" forever. The first
            // request will fall back to the legacy token or go without one.
            logWarn(
              "Priming threw for the adopted account — the first Foundry " +
                "request may go unauthenticated",
              primeError,
            );
          } finally {
            // Cleared on every path, including a throw, so a failure here can
            // never leave the module permanently unable to publish its state.
            suppressChangeEvents = false;
          }
        }
      }

      document.addEventListener("visibilitychange", onVisibilityChange);
      logInfo("Initialised; signed in: " + (account !== null));
    } catch (error) {
      logError("Initialisation failed", error);
      account = null;
    } finally {
      fireChange("init");
    }
  }

  /**
   * Idempotent: the in-flight promise is held module-locally and returned to
   * every later caller, so several consumers may call init() without racing.
   */
  function init() {
    if (!initPromise) initPromise = runInit();
    return initPromise;
  }

  /**
   * Begin sign-in. This NAVIGATES AWAY, so nothing after the call in this
   * function — or in the caller — will run. The Foundry scope is requested
   * alone; never mix scopes, because one access token carries one audience.
   */
  function signIn() {
    if (!msalClient) {
      logError("signIn() called before init() completed");
      return;
    }
    logInfo("Starting sign-in redirect");
    msalClient.loginRedirect({ scopes: [SCOPES.foundry] });
  }

  /**
   * Sign out. Clears local state first so the page is consistent even if the
   * navigation is slow, then hands over to MSAL. This NAVIGATES AWAY.
   */
  function signOut() {
    const departing = account;

    clearAllTokens();
    account = null;
    payloadLogged = false;
    fireChange("sign-out");

    if (!msalClient) {
      logWarn("signOut() called before init() completed — local state cleared only");
      return;
    }
    logInfo("Starting sign-out redirect");
    msalClient.logoutRedirect({ account: departing || undefined });
  }

  function getToken(scopeName) {
    return acquire(scopeName, false);
  }

  /**
   * The SYNCHRONOUS cached-token read, for callers that cannot await.
   *
   * A pure extraction of the probe already inside acquire(): read the entry,
   * test it with isUsable(), hand back the token or null. It adds no state and
   * makes no network call.
   *
   * WHY IT EXISTS, AND WHY IT MUST NEVER RETURN A PROMISE. The Foundry provider
   * layer resolves its token inside endpoint(), which is synchronous, and whose
   * four call sites destructure { url, headers } without awaiting. Handing that
   * layer a promise would not throw and would not be caught: a promise is
   * truthy, so it passes the `if (userToken)` guard, it logs hasUserToken: true,
   * and fetch() stringifies it onto the wire as the literal "[object Promise]".
   * The request then fails at the Cloudflare Worker with nothing at the call
   * site to explain it. Return a string or null from here — never a promise,
   * never undefined.
   *
   * @param {string} scopeName - a key of SCOPES, e.g. "foundry"
   * @returns {string|null} the cached access token, or null when there is no
   *   usable one. Never a Promise.
   */
  function getCachedToken(scopeName) {
    const cached = tokenCache.get(scopeName);
    return isUsable(cached) ? cached.token : null;
  }

  async function ensureFresh(scopeName) {
    const entry = tokenCache.get(scopeName);
    if (entry && !isDueForRenewal(entry) && isUsable(entry)) return entry.token;
    return acquire(scopeName, true);
  }

  function isSignedIn() {
    return account !== null;
  }

  function getAccount() {
    return account;
  }

  // NO SELF-INITIALISATION. A DOMContentLoaded branch or a trailing init() call
  // would belong here in most modules in this codebase, and is deliberately
  // absent: nothing may contact Microsoft on a normal page load. The sign-in
  // card calls init() in a later stage.

  return {
    init: init,
    signIn: signIn,
    signOut: signOut,
    getToken: getToken,
    ensureFresh: ensureFresh,
    isSignedIn: isSignedIn,
    getAccount: getAccount,
    getCachedToken: getCachedToken,
    CHANGE_EVENT: CHANGE_EVENT,
  };
})();
