import { modelRegistry, validator } from "../model-registry/model-registry-index.js";

// THIS FILE DELIBERATELY DOES NOT IMPORT THE ANNOUNCER, AND THAT IS THE WHOLE
// POINT OF IT. Until 19 September 2026 it announced the instant it elected a
// candidate — but whether the switch actually HAPPENS is decided afterwards and
// elsewhere, in request-handler-index.js's catch, where a hop ceiling or a
// visited-set hit can refuse it. The chooser cannot know that, and the caller
// cannot unsay it, so every walk that reached a bound ended by telling the user
// about a switch that never occurred. Measured at parcel 23 on four rings: four
// of four false, on both providers, from both branches, on both decline paths.
// It was polite, it reached the shared announcer, and a screen-reader user was
// the only person the application told.
//
// So the sentence is PROPOSED here and SPOKEN there. An unused `a11y` import in
// a file whose correctness now depends on never speaking is a loaded gun for the
// next reader, which is why it is gone rather than merely unreferenced.

/**
 * The HTTP status an error carries, wherever the provider that raised it put it.
 *
 * TWO PROVIDERS PUT IT IN TWO PLACES AND THIS LANE MUST NOT BREAK ONE TO FIX THE
 * OTHER. A Foundry error carries a numeric `status` on the error itself. An
 * OpenRouter one is an `OpenRouterClientError`, whose constructor stores its THIRD
 * argument as `metadata` — so the 429 that
 * js/openrouter-client/openrouter-client-request.js builds lands at
 * `error.metadata.status` and the error has no own `status` property at all.
 * prove-request-fallback.mjs's A5 row pins that shape.
 *
 * READING ONLY THE TOP LEVEL IS WHAT KEPT THIS SUBSYSTEM DORMANT for months: both
 * predicates below tested `error.status === 429`, which no OpenRouter error has
 * ever carried. Reading only `metadata` would cure OpenRouter and blind Foundry,
 * which is the same defect facing the other way.
 *
 * THIS IS NOT A THIRD SPELLING. openrouter-embed/openrouter-embed-retry.js's
 * `isRetryable` (~:174-183, loaded by tools.html) already solves this in
 * production, and this follows it exactly: prefer a NUMERIC top-level status, fall
 * back to a NUMERIC nested one.
 *
 * THE NUMERIC TESTS ARE LOAD-BEARING, NOT DEFENSIVE PADDING, and they have a
 * stated limit. `openrouter-client-request.js:136` passes `data.error.code` into
 * the same `status` slot, and that field is not guaranteed to be a number; a
 * string "429" is therefore NOT treated as a 429 here. That is deliberate — it is
 * what the shipped precedent does, and a lane arming a dormant path is the wrong
 * place to widen a rule. If a real provider is ever seen sending a string status,
 * that is a finding to measure, not a coercion to add quietly.
 *
 * DUPLICATED FROM THE EMBED DELIBERATELY; HOISTED WITHIN THIS FILE. The two call
 * sites below share this one helper, so they cannot drift from each other. Across
 * subsystems the copy stands: openrouter-embed/ is a self-contained drop-in with
 * its own copy of everything it needs, and making js/request-handler/ import from
 * it — or both import from a new third module — would couple two deliberately
 * independent subsystems for four lines of logic. The cost is a second copy; this
 * comment is what makes it a KNOWN second copy rather than a drifting one.
 *
 * @param {Object} error the error a request failed with
 * @returns {number|undefined} its HTTP status, or undefined if it carries none
 */
function httpStatusOf(error) {
  if (!error) return undefined;
  if (typeof error.status === "number") return error.status;
  if (typeof error.metadata?.status === "number") return error.metadata.status;
  return undefined;
}

export class ModelFallbackManager {
  /**
   * Elect a fallback model for a failed request, and propose — without speaking —
   * the sentence a switch to it would warrant.
   *
   * THE RETURN CONTRACT IS UNCHANGED: an id string, or `undefined`. Parcel 20
   * landed that deliberately and three rows pin it, so the proposal travels in a
   * caller-owned object instead of being bundled into the return value.
   *
   * `choice` IS OPTIONAL AND OMITTING IT IS SILENT. A parameter that announces by
   * default makes every future caller announce unless it remembers not to;
   * silent-by-default makes the speaking paths declare themselves, which is the
   * rule AGENTS.md § Announcements states.
   *
   * `choice.tried` IS HOW THE WALK'S VISITED SET REACHES THIS METHOD, AND IT IS
   * READ-ONLY HERE. Parcel 34. It rides on the object the caller already builds
   * fresh per catch rather than on a fourth argument, because every wrapper around
   * this method must already forward all three and a fourth is exactly the kind a
   * wrapper drops. Dropping it is not an error: without it this method still
   * refuses unsuitable targets, but it can pair two models that each elect the
   * other, and the caller's visited set then ends the walk after two calls. The
   * caller adds to the set when it commits a switch; adding here as well would
   * mark a model tried that was never called.
   *
   * @param {string} currentModel the id that just failed
   * @param {Object} error the error it failed with
   * @param {{announcement: string|null, tried?: Set<string>}} [choice]
   *   caller-owned; receives the proposed sentence, which the caller speaks only
   *   if it actually switches. `tried` holds the ids this walk has already called.
   * @returns {string|undefined} the elected model id
   */
  getFallbackModel(currentModel, error, choice) {
    let fallbackModel;
    const tried = choice && choice.tried instanceof Set ? choice.tried : null;

    // ARMED 19 SEPTEMBER 2026, PARCEL 25. This read `error.status === 429` and
    // therefore never fired on an OpenRouter error — see httpStatusOf above. The
    // RULE is unchanged and deliberately so: still 429, still the same two flags.
    // Only the READ moved, so this branch finally sees the status it was always
    // written to see.
    //
    // `metadata.quota_exceeded` IS DEAD AND IS KEPT ON PURPOSE. Nothing in the
    // shipped tree writes it — prove-request-fallback.mjs's A6 row asserts exactly
    // that, two-sided, with the readers in js/modules/model-manager.js as its
    // canary. It is kept rather than deleted because deleting it would be a RULE
    // change in a parcel whose whole discipline is that this is a READ change, and
    // because the intent — a provider-reported quota exhaustion is switchable —
    // is correct and would have to be re-argued to put back. It is commented
    // rather than left silent because a permanently-false clause nobody has
    // labelled is a trap for the next reader, who will assume it fires.
    if (httpStatusOf(error) === 429 || error.metadata?.quota_exceeded) {
      // THE REGISTRY RETURNS A MODEL OBJECT; THIS METHOD RETURNS AN ID STRING.
      // `modelRegistry.getFallbackModel` is documented as returning a model or
      // null, and its other consumers are written to that contract, so it is not
      // the thing to change. What this branch used to do was hand that OBJECT
      // back, where the last-resort branch below hands back an id — and
      // request-handler-index.js assigns whichever it gets straight to
      // `options.model`. The recursed `validateRequest` then asked the registry
      // for "[object Object]", which throws ModelNotFoundError from ABOVE the
      // try — so the walk stopped at one call and the ORIGINAL 429 was destroyed
      // on the way out. Measured by measure-fallback-recursion.mjs A6b.
      //
      // The object is kept in a local, announced from, and only its id leaves.
      // The wording is unchanged, and it is the canary that the object was not
      // simply discarded: the sentence names the model, not its id.
      const declared = modelRegistry.getFallbackModel(currentModel);

      // SHAPE GUARD, not an assumption. An object with no usable `id` is not a
      // fallback: putting it on `options.model` is the defect above wearing a
      // different hat. Fall through to the last-resort branch, which is already
      // what "no fallback" means here — and say nothing, because a switch that
      // will not happen must not be announced.
      //
      // THAT RULE NOW HOLDS FOR EVERY DECLINE, NOT JUST THIS ONE. It was written
      // here for the shape-guard case one parcel after the two bounds it applies
      // to equally were added, and nothing connected them. The wording below is
      // unchanged and is still the canary that the object was kept and read: the
      // sentence names the model, not its id.
      //
      // A DECLARED EDGE IS HELD TO THE SAME RULE AS A MATCHED ONE — parcel 34.
      // Until 23 September 2026 the shape guard was the only test here, so a
      // human-written `fallbackTo` was taken whatever it pointed at, while the
      // last resort below had to pass the validator's three constraints. Measured
      // that day: 235 of 445 declared edges failed them, 168 from enabled models.
      // A declined edge falls through to the last resort, which is what "no
      // usable declared fallback" already meant.
      if (declared && typeof declared.id === "string") {
        if (this._isDeclaredEdgeTakeable(currentModel, declared, tried)) {
          if (choice) {
            choice.announcement = `Switching to fallback model: ${declared.name}`;
          }
          fallbackModel = declared.id;
        }
      }
    }

    if (!fallbackModel) {
      // LAST RESORT. This branch used to read the line quoted below — and QUOTING IT
      // HERE MEANS A NAIVE GREP FOR IT STILL FINDS IT, in a file where it has been
      // removed. prove-request-fallback.mjs's B7 row counts it against
      // COMMENT-STRIPPED source for exactly that reason, and a browser one-liner that
      // stripped comments with /\/\/.*$/ read it as still present, because `.` does
      // not match the CR of a CRLF line. The line is kept because what it used to say
      // is the whole point of the repair; the warning is kept because the next reader
      // will grep before they read.
      //
      //   fallbackModel = allModels.find((model) => model.isFree)?.id;
      //
      // which applied no provider check, no capability check of any kind, and no
      // context floor — it took whatever free model the registry happened to
      // enumerate first. Measured 18 September 2026: `isFree: true` appears on 41
      // registrations in js/model-definitions.js and on NONE of the 44 in
      // js/foundry-model-definitions.js, so the set it chose from contained no
      // Foundry deployment at all, and the model it elected could not be shown to
      // do the job the request needed.
      //
      // Item 108's three constraints — same stream, capability superset, context
      // floor — are already written down once, in the registry validator, and are
      // already proved by prove-fallback-matcher.mjs. So this DELEGATES rather than
      // reimplementing them: a second copy of the rules here would be the
      // third-copy-drifts failure, and Processing -> Foundation is the correct
      // direction under the layered architecture.
      const source = modelRegistry.getModel
        ? modelRegistry.getModel(currentModel, true)
        : null;
      // Models this walk has already called are not candidates. Without this
      // the matcher is not cycle-aware and pairs two models that each elect the
      // other, which the caller's visited set then ends after two calls.
      const candidates = modelRegistry.getAllModels
        ? modelRegistry.getAllModels().filter((m) => !tried || !tried.has(m.id))
        : [];

      // FAIL CLOSED. Where nothing satisfies the three constraints the correct
      // answer is no fallback at all — an undeployable fallback that never fires is
      // not a defect, whereas a silent downgrade to a model that cannot do the job
      // is. An unknown source id is the same answer for the same reason.
      fallbackModel = source
        ? validator.findBestFallbackMatch(source, candidates) || undefined
        : undefined;

      if (fallbackModel) {
        // The sentence no longer promises a free model, because the chooser no
        // longer picks on price. It is still exactly one sentence on the shared
        // polite channel naming the model — the caller speaks it, and only if it
        // switches.
        //
        // THE TWO BRANCH WORDINGS DIFFER ON PURPOSE AND BOTH SURVIVE VERBATIM.
        // "fallback model" is the model's own declared target; "alternative
        // model" is one the validator matched at runtime. Parcel 23 used exactly
        // that difference to attribute hops to branches, so collapsing them would
        // destroy an instrument's only way of telling the two apart.
        const chosen = modelRegistry.getModel(fallbackModel, true);
        if (choice) {
          choice.announcement = `Switching to alternative model: ${
            chosen ? chosen.name : fallbackModel
          }`;
        }
      }
    }

    return fallbackModel;
  }

  /**
   * May the declared `fallbackTo` target be taken for this model, in this walk?
   *
   * DELEGATES THE RULE rather than restating it: same stream, capability
   * superset and context floor live once, in the validator, as they do for the
   * last resort. A second copy here would be the third-copy failure this lane
   * keeps paying for.
   *
   * @param {string} currentModel the id that just failed
   * @param {Object} declared the registry's declared target for it
   * @param {Set<string>|null} tried ids this walk has already called; read only
   * @returns {boolean} whether branch 1 may elect `declared`
   */
  _isDeclaredEdgeTakeable(currentModel, declared, tried) {
    if (tried && tried.has(declared.id)) return false;

    // FAIL CLOSED on an unknown source, as the last resort does.
    const source = modelRegistry.getModel
      ? modelRegistry.getModel(currentModel, true)
      : null;
    if (!source) return false;

    return validator.isFallbackCandidateEligible(source, declared);
  }

  /**
   * Is this failure the kind a different model might survive?
   *
   * ARMED 19 SEPTEMBER 2026, PARCEL 25, WITH THE BRANCH ABOVE AND NOT WITHOUT IT.
   * Parcel 18 established that arming one site alone is worse than arming neither,
   * and re-deriving it costs one sentence: this predicate is the GATE and branch 1
   * is the first thing behind it, so arming only the gate opens it onto a branch
   * that still cannot see a 429 — every hop then falls through to the last-resort
   * matcher and the declared `fallbackTo` edge a model author wrote is silently
   * never consulted. Arming only branch 1 is worse still: the gate never opens, so
   * nothing behind it runs at all. Neither half is independently shippable.
   *
   * THE TWO SITES SHARE THE STATUS READ AND ARE NOT OTHERWISE UNIFIED, AND THE
   * DISPATCH'S PREMISE THAT THEY ARE "TWO COPIES OF ONE PREDICATE" IS WRONG. They
   * differ by a clause: this one also admits `model_unavailable`, branch 1 does
   * not. That difference is meaningful — a quota failure is exactly what a
   * model author's declared `fallbackTo` edge is for, whereas an unavailable model
   * wants a capability-matched alternative, which is what falling through to the
   * last-resort matcher gets you. Unifying them would make a `model_unavailable`
   * error start consulting the declared edge, which is a RULE change wearing a
   * tidying-up disguise. What IS unified is the one thing that should never
   * differ — where the status is read from — and it is unified BY CONSTRUCTION,
   * through a single helper, rather than by two copies kept in step by hand.
   *
   * BOTH FLAG CLAUSES ARE DEAD. See the note on `quota_exceeded` above; nothing
   * writes `model_unavailable` either, and the same A6 row covers both. They are
   * kept, labelled, for the same reason.
   *
   * @param {Object} error the error a request failed with
   * @returns {boolean|undefined} truthy if a fallback should be attempted
   */
  shouldSwitchModel(error) {
    return (
      httpStatusOf(error) === 429 ||
      error.metadata?.quota_exceeded ||
      error.metadata?.model_unavailable
    );
  }
}
