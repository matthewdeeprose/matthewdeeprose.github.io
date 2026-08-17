// Adapt a self-contained HTML document for the SCORM runtime.
// Ported from scorm-export-manager.js prepareSCORMHTML (~line 560), with one
// correctness fix: the original never injected <script src="scorm-api.js">, so
// the API wrapper would never load in the LMS. We add that reference here so the
// SCO actually initialises/terminates a session.

import { resolveConfig } from "./config.js";

export function prepareScormHtml(htmlContent, opts = {}) {
  const config = resolveConfig(opts.config);
  const mathjaxMode = opts.mathjaxMode || config.MATHJAX_MODE;

  let html = String(htmlContent);

  // 0. Tag the body so CSS can adjust for running inside LMS chrome (e.g. move
  //    the back-to-top button clear of Blackboard's own floating help button).
  //    Anchor to the real body tag (immediately after </head>) rather than the
  //    first literal "<body>" in the file — CSS/content in <head> can legitimately
  //    contain the text "<body>" (e.g. a comment), and a plain string replace
  //    would tag that instead of the actual element.
  html = html.replace(/(<\/head>\s*)<body>/, '$1<body class="scorm-runtime">');

  // 1. Load the SCORM API wrapper, then a small progress tracker, before </body>.
  const scormInit = `
    <script src="${config.API_FILENAME}"></script>
    <script>
      // SCORM session tracking for accessible content
      if (window.SCORM && window.SCORM.isAvailable()) {
        console.log("[SCORM] Content loaded in LMS environment");
        if (typeof MathJax !== 'undefined' && MathJax.startup && MathJax.startup.promise) {
          MathJax.startup.promise.then(function () {
            var mathElements = document.querySelectorAll('mjx-container, .MathJax');
            if (mathElements.length > 0) {
              window.SCORM.trackProgress('content_rendered', 50);
              console.log('[SCORM] Tracked ' + mathElements.length + ' rendered expressions');
            }
          });
        }
      }
    </script>
  </body>`;
  html = html.replace("</body>", scormInit);

  // 2. SCORM meta tags right after the charset declaration.
  const scormMeta = `
    <meta name="scorm.version" content="${config.VERSION}">
    <meta name="content.accessibility" content="WCAG 2.2 AA">
    <meta name="mathjax.mode" content="${mathjaxMode}">`;
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + scormMeta);

  // 3. In local mode, rewrite the CDN MathJax URL to the bundled path.
  if (mathjaxMode === "local") {
    const cdnEscaped = config.CDN_MATHJAX_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(cdnEscaped, "g"), config.LOCAL_MATHJAX_PATH);
  }

  // 4. Lightweight error handler in <head>.
  const errorHandler = `
    <script>
      window.addEventListener('error', function(event) {
        console.error('[SCORM Error]', event.error);
      });
    </script>`;
  html = html.replace("</head>", errorHandler + "</head>");

  return html;
}
