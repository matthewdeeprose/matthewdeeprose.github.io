import { CONFIG } from "../config.js";
import { a11y } from "../accessibility-helpers.js";
/**
 * @fileoverview Request Handler Module
 * Coordinates request processing, caching, retries, and token tracking
 * using the modular token counter system.
 */

import { tokenCounter } from "../token-counter/token-counter-index.js";
import { modelRegistry } from "../model-registry/model-registry-index.js";
import { CacheManager } from "./request-handler-cache-manager.js";
import { ModelFallbackManager } from "./request-handler-model-fallback.js";
import { RequestValidator } from "./request-handler-request-validator.js";

/**
 * The most fallback hops one request may make before the walk is abandoned and the
 * ORIGINAL error propagates. Small on purpose: this is a degradation path, not a
 * search, and every hop is a paid call.
 */
const MAX_FALLBACK_HOPS = 3;

/**
 * A stable key for the visited set.
 *
 * BOTH BRANCHES OF `getFallbackModel` NOW RETURN AN ID STRING — parcel 20 repaired
 * the type defect on 19 September 2026, and this comment is corrected rather than
 * left standing, because a caveat describing a limitation that has been fixed is as
 * misleading as a stale figure. It read: "`getFallbackModel`'s first branch returns
 * a model OBJECT where its second returns an id STRING — a registered defect this
 * file does not repair."
 *
 * The object branch below is KEPT as defence in depth, not as a live path. The
 * reason it existed still holds for anything that reaches here in that shape:
 * `String(object)` is "[object Object]" for every object, so two DIFFERENT models
 * would collide as one visited entry and stop a hop that should have been allowed.
 *
 * @param {string|Object} model an id, or a registry model object
 * @returns {string}
 */
function fallbackKey(model) {
  if (model && typeof model === "object" && typeof model.id === "string") {
    return model.id;
  }
  return String(model);
}

export class RequestHandler {
  constructor() {
    // No retry manager: this handler propagates, and retry belongs to the error
    // handler one layer up. A dead instance is still a live construction, and the
    // next reader would assume it was on a path.
    this.cacheManager = new CacheManager();
    this.fallbackManager = new ModelFallbackManager();
    this.validator = new RequestValidator();
    this.currentRequestId = null;
  }

  async executeRequest(
    messages,
    options,
    fetchFn,
    fallbackChain = { visited: new Set(), hops: 0 }
  ) {
    // THE CHAIN STATE IS THREADED THROUGH THE CALL, NEVER HELD ON `this`.
    // `requestHandler` below is an exported SINGLETON shared by every concurrent
    // request, so instance state would let one request's chain bound — or fail to
    // bound — another's. A default parameter is evaluated per call, so each
    // top-level request starts its own state and every existing three-argument
    // caller keeps working unchanged.
    //
    // `hops` IS A SEPARATE COUNTER AND NOT `visited.size`, WHICH IS THE WHOLE
    // POINT OF CARRYING BOTH. A first draft used the set's size as the hop count
    // and the inversion sweep showed it was one mechanism wearing two hats: round
    // a ring the set stops growing, so a ceiling read off its size can never fire,
    // and removing the revisit test alone left the walk unbounded. Counted
    // separately, each bound covers exactly what the other misses.
    fallbackChain.visited.add(fallbackKey(options.model));

    // Initialize request tracking
    this.currentRequestId = tokenCounter.generateRequestId();
    tokenCounter.initializeRequest(
      this.currentRequestId,
      options.model,
      messages
    );

    // Validate request
    const validation = this.validator.validateRequest(messages, options);
    if (!validation.isValid) {
      a11y.announceStatus("Invalid request parameters", "assertive");
      throw new Error(validation.errors.join(", "));
    }

    // ONE ANNOUNCEMENT PER EVENT — AND A FALLBACK HOP IS ONE EVENT.
    //
    // A hop announced the switch at the bottom of this function and then
    // recursed straight back in to here. There is NO `await` anywhere on that
    // path, so both announcements ran in ONE synchronous turn: the announcer
    // clears its region and schedules the text on the next animation frame, so
    // both `apply` callbacks landed in the SAME frame and the switch sentence
    // was overwritten by the second one BEFORE the frame was rendered. The
    // region never held it for a single painted frame, so there was nothing
    // there for a reader to observe. Measured 22 September 2026 on the shipped
    // path: both writes in frame 239, 0.6ms apart, and the switch sentence
    // appeared in 0 of 325 post-frame samples. A human listen heard only the
    // overwriting line.
    //
    // THIS IS NOT A TIMING RACE AND SPACING IT WOULD NOT FIX IT. The adjacency
    // is structural — no `await` can fall between the two calls — so the loss
    // was deterministic on every fallback, for every user, on every path where
    // the elected model is actually tried.
    //
    // THE PREDICATE IS COMPUTED ONCE HERE AND READ BY BOTH POLITE WRITES BELOW
    // — the cache sentence and the send sentence — rather than copied into
    // each. A SECOND COPY OF THE CONDITION IS THE HAZARD: hoisting it is what
    // keeps the two sites from drifting apart. Counted against this file: FOUR
    // `announceStatus` calls, ONE `await` (the fetch), ONE recursion site, so
    // the polite writes reachable from the switch with nothing yielding between
    // them are exactly those two and there is no third. The remaining call is
    // ASSERTIVE and is deliberately NOT guarded — that channel was measured
    // surviving the same adjacency 24 of 24, so it is a closed question.
    //
    // THE SWITCH SENTENCE IS THE NEWS; neither guarded sentence carries
    // anything the user does not already know. So the hop keeps its voice and
    // the redundant second sentence goes, rather than the reverse: a silent
    // event is the worse outcome, and these are the halves that can be dropped
    // without creating one.
    //
    // THE CONDITION IS TWO-PART BECAUSE NEITHER HALF ALONE IS SAFE, and it
    // fails toward SPEAKING. `hops > 0` alone would silence a hop whose switch
    // was NOT announced — the `choice.announcement` guard below deliberately
    // permits a collaborator that elects without proposing — and that hop would
    // then say nothing at all. `announcedSwitch` alone would be silently
    // forgotten by any future re-entry that did not set it. Requiring both
    // means a forgotten flag restores the old doubling (a regression, and a
    // loud one) rather than a silence (undetectable, and worse).
    const alreadyAnnouncedByTheSwitch =
      fallbackChain.hops > 0 && fallbackChain.announcedSwitch === true;

    // Check cache
    const cachedResponse = this.cacheManager.get(messages, options.model);
    if (cachedResponse) {
      if (!alreadyAnnouncedByTheSwitch) {
        a11y.announceStatus("Retrieved response from cache", "polite");
      }
      return { ...cachedResponse, cached: true };
    }

    try {
      // Guarded by the hoisted predicate above — see the reasoning there.
      if (!alreadyAnnouncedByTheSwitch) {
        a11y.announceStatus("Sending request to API...", "polite");
      }
      const response = await fetchFn(messages, options);

      // Record successful attempt
      tokenCounter.recordAttempt(
        this.currentRequestId,
        response.usage,
        options.model,
        false
      );

      this.cacheManager.set(messages, options.model, response);
      return response;
    } catch (error) {
      // Record failed attempt
      tokenCounter.recordAttempt(
        this.currentRequestId,
        null,
        options.model,
        false,
        error
      );

      if (this.fallbackManager.shouldSwitchModel(error)) {
        // THE SENTENCE IS COMPOSED BY THE CHOOSER AND SPOKEN HERE, BECAUSE ONLY
        // THIS SIDE KNOWS WHETHER THE SWITCH HAPPENS. A fresh object per catch,
        // never a field on the manager: `requestHandler` is an exported SINGLETON,
        // so a pending sentence held on the instance would be one request's voice
        // available to another's. Nothing awaits between this call and the branch
        // below today — but a design that is correct only while no `await` appears
        // in a six-line window is a trap, and this lane has paid for that shape
        // before (see the chain-state note at the top of executeRequest).
        //
        // `tried` IS THE LIVE VISITED SET, PASSED BY REFERENCE AND READ-ONLY TO THE
        // CHOOSER (parcel 34). It lets the chooser skip a model this walk has
        // already called, rather than electing it and having the check below end
        // the walk. It rides on this object, not a fourth argument, because a
        // wrapper that forwards three arguments would silently drop a fourth.
        const choice = { announcement: null, tried: fallbackChain.visited };
        const fallbackModel = this.fallbackManager.getFallbackModel(
          options.model,
          error,
          choice
        );
        // TWO BOUNDS REMAIN, AND SINCE PARCEL 34 THEY DO DIFFERENT JOBS. The
        // chooser now skips every model in `choice.tried`, so on this path it
        // never proposes one the walk has already called and the visited check
        // below never fires — 0 of 515 walks, measured 23 September 2026, against
        // 442 with `tried` withheld AND NO HOP CEILING (283 under the real
        // ceiling, where the other 159 are ended by the ceiling before the
        // visited check can see them). So the hop ceiling ALONE bounds the walk's
        // length here: without it a walk runs until the chooser has no suitable,
        // untried model left, which reached 15 calls. It was already the only
        // bound on the long acyclic descents the visited set could never see.
        //
        // THE VISITED CHECK IS KEPT, AND IT IS NOT DEAD CODE. It is the guard for
        // any caller that reaches the chooser without a `choice` (and so without
        // `tried`), and against a later regression in the chooser that starts
        // re-proposing tried models. A guard that is redundant on today's path is
        // still the one that catches tomorrow's. The graph walked here is not the
        // declared one — the chooser manufactures edges at runtime that appear in
        // no definitions file — so a static check of `fallbackTo` cannot stand in
        // for either bound.
        //
        // When either bound trips the code FALLS THROUGH to the rethrow below, so
        // the ORIGINAL error leaves unaltered with its `metadata` intact. No new
        // error is raised: the layer above classifies on the original, and a
        // substituted one is the swallow that was removed.
        //
        // NOTHING IS ANNOUNCED ON THAT PATH, AND THE REASON RECORDED HERE UNTIL
        // 19 SEPTEMBER 2026 WAS FALSE. It read: "Nothing is announced either —
        // the chooser already speaks once per switch, and a second voice for one
        // event is the defect AGENTS.md § Announcements forbids." The second
        // clause is right and the FIRST WAS NOT: the chooser spoke once per
        // ELECTION, not once per switch. So every walk that reached either bound
        // ended by announcing a switch that never happened — four of four rings
        // measured at parcel 23, both providers, both branches, both decline
        // paths. The reasoning was sound and the premise was false, which is why
        // it survived five parcels of review sitting in plain sight.
        //
        // The chooser now PROPOSES the sentence and this branch speaks it, so a
        // decline is silent BY CONSTRUCTION rather than by an assumption about
        // somebody else's code. Silence here is deliberate: the user gets the
        // propagated error, which the layer above already classifies and handles.
        const atHopCeiling = fallbackChain.hops >= MAX_FALLBACK_HOPS;
        const alreadyTried =
          fallbackModel != null &&
          fallbackChain.visited.has(fallbackKey(fallbackModel));
        if (fallbackModel && !atHopCeiling && !alreadyTried) {
          fallbackChain.hops += 1;
          options.model = fallbackModel;
          // ONE ANNOUNCEMENT PER SWITCH, SPOKEN ONLY ONCE THE SWITCH IS COMMITTED.
          // The guard is not defensive padding: a collaborator that elects without
          // proposing — a test stub, say — must switch SILENTLY rather than have
          // this file invent a second copy of the chooser's wording.
          //
          // THE FLAG IS SET IN BOTH BRANCHES, NEVER ONLY THE TRUE ONE. It is
          // read by the send announcement at the top of executeRequest to decide
          // whether this hop already has a voice. Leaving it unset on the silent
          // branch would let a PREVIOUS hop's `true` carry forward and silence a
          // hop that said nothing — the one outcome worse than the doubling this
          // repairs.
          if (choice.announcement) {
            a11y.announceStatus(choice.announcement, "polite");
            fallbackChain.announcedSwitch = true;
          } else {
            fallbackChain.announcedSwitch = false;
          }
          return this.executeRequest(messages, options, fetchFn, fallbackChain);
        }
      }

      // PROPAGATE ALWAYS. The original error leaves here unaltered — not wrapped,
      // not re-messaged, and with its `metadata` intact — because a real retry
      // already exists one layer up: request-manager-core.js catches into
      // errorHandler.handleError, which supplies a genuine retryFunction and gates
      // automatic recovery on classification.recoverable, with its own backoff
      // table in js/error-handler/recovery-strategies.js.
      //
      // This line used to call a RetryManager whose handleRetry waited a backoff,
      // announced an untrue "Retrying in N seconds...", incremented a counter that
      // nothing ever reset, and then RETURNED THE REQUEST as though it were the
      // response. That swallow is what disarmed the real retry: the consumers threw
      // "No choices in response" / "No content received from API", strings the
      // classifier reads as unrecoverable, so the layer that could have retried
      // never saw the 429 or the network failure that actually occurred. The
      // 400 that exposed this said "Audio output requires stream: true" and that
      // text had to be recovered by replaying the dispatched body by hand.
      //
      // Do not reintroduce a retry here. A second loop nested inside the one above
      // would double every backoff and halve nothing.
      throw error;
    }
  }
}

export const requestHandler = new RequestHandler();
