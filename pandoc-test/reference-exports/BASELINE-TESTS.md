# Baseline Tests - Before Implementation

**Date:** 4/11/2025
**System:** Enhanced Pandoc-WASM Mathematical Playground

## Test Suite Results

**Overall Success:** [true from testAllSafe()]
**Total Tests:** [27]
**Passed:** [27]
**Failed:** [0]

### Failed Tests (if any)

[List any tests that failed]

## Known Bugs (To Be Fixed)

### Bug 1: Custom Commands Undefined

**Status:** CONFIRMED
**Evidence:** reference-exports/custom-commands-baseline.html
**Symptoms:** Red error text showing "\R", "\C" instead of rendering
**Console Error:** None (MathJax treats as literal text)

### Bug 2: Align Environment Broken

**Status:** CONFIRMED
**Evidence:** reference-exports/align-environment-baseline.html
**Symptoms:** "Misplaced &" error message
**Console Error:** [Copy any MathJax errors from console]

### Bug 3: Gather Environment Broken

**Status:** CONFIRMED
**Evidence:** reference-exports/gather-environment-baseline.html
**Symptoms:** Equations render on single line instead of stacking
**Console Error:** [Copy any errors]

## Reference Exports Created

1. ✅ simple-math-baseline.html (working correctly)
2. ✅ custom-commands-baseline.html (shows Bug #1)
3. ✅ align-environment-baseline.html (shows Bug #2)
4. ✅ gather-environment-baseline.html (shows Bug #3)

## System State

**Files Backed Up:**

- ✅ BACKUP-latex-processor.js (851 lines)

**Test Document Created:**

- ✅ test-document-minimal.tex

**Browser:** [Your browser + version]
**Date/Time:** [Timestamp]

## Next Steps

- Stage 2: Create Legacy Module (extract current method)
- Stage 3: Extract Shared Utilities
- Continue through Stage 7

## Notes

[Any additional observations about current system behavior]
