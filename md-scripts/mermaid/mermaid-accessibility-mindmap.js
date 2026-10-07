/**
 * Mermaid Accessibility - Mindmap Module
 * Generates accessible descriptions for mindmap diagrams
 */
const MermaidAccessibilityMindmap = (function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Accessibility - Mindmap] ${message}`);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Accessibility - Mindmap] ${message}`);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(`[Mermaid Accessibility - Mindmap] ${message}`);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Accessibility - Mindmap] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Core module not loaded!");
    return {};
  }

  logInfo("Initialising mindmap module");

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;
  const Common = window.MermaidAccessibilityCommon;

  /**
   * Clean node text to remove Mermaid formatting characters
   * @param {string} text - The node text with formatting
   * @returns {string} Cleaned text
   */
  function cleanNodeText(text) {
    if (!text) return "";

    logDebug(`Cleaning node text: ${text}`);

    // Remove Mermaid formatting characters for different node types
    const cleanedText = text
      .replace(/^\[\[|\]\]$/g, "") // Remove [[ and ]] (subprocess)
      .replace(/^\[\/?|\/?\]$/g, "") // Remove [, /, and ] (process and I/O nodes)
      .replace(/^\(\[|\]\)$/g, "") // Remove ([ and ]) (start/end nodes)
      .replace(/^\(\(|\)\)$/g, "") // Remove (( and )) (circle)
      .replace(/^\)\)|\(\($/g, "") // Remove )) and (( (bang)
      .replace(/^\)\($/g, "") // Remove )( (cloud)
      .replace(/^\(|\)$/g, "") // Remove ( and ) (rounded square)
      .replace(/^\{\{|\}\}$/g, "") // Remove {{ and }} (hexagon)
      .replace(/^\{|\}$/g, "") // Remove { and } (decision nodes)
      .replace(/^"`|`"$/g, "") // Remove "` and `" (markdown strings)
      // Process markdown formatting if present
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove ** for bold formatting
      .replace(/\*(.*?)\*/g, "$1") // Remove * for italic formatting
      // Remove class styling syntax
      .replace(/:::\s*[\w\s]+/g, "")
      .replace(/:::\s*[\w\s]+/g, ""); // Remove ::: class styling

    logDebug(`Cleaned text result: ${cleanedText}`);
    return cleanedText;
  }

  function generateShortDescription(svgElement, code) {
    logInfo("Generating short description");

    // Parse mindmap structure
    const mindmapStructure = parseMindmap(code, svgElement);

    // Extract root node and count levels
    const rootNode = mindmapStructure.rootNode;
    const nodeCount = countNodes(mindmapStructure);
    const maxDepth = getMaxDepth(mindmapStructure);

    logDebug(
      `Mindmap statistics - Nodes: ${nodeCount}, Max depth: ${maxDepth}`
    );

    // Get the actual root node text (remove any theme initialisation and shape markers)
    let rootText = rootNode?.text || "Unknown";
    rootText = cleanNodeText(rootText);

    // Check if rootText still contains initialisation code
    if (rootText.includes("%%{init:")) {
      rootText = "Root Topic";
      logDebug("Root text contained initialisation code, using fallback");
    }

    // Build the description - HTML version
    let htmlDescription = `A mindmap diagram`;

    // Diagram-source text is escaped once, here, where it enters an HTML
    // string. The PLAIN tier below deliberately keeps the raw values: it feeds
    // the SVG aria-label and the textContent fallback, neither of which parses
    // HTML, so entities there would be read out literally.
    // Add root node information. An unlabelled root takes a clause of its own,
    // because the label's quotation marks cannot hold the phrase.
    const rootUnlabelled = Boolean(rootNode && rootNode.unlabelled);
    if (rootUnlabelled) {
      htmlDescription += ` with ${UNLABELLED_NODE_MID_SENTENCE} as the central concept`;
    } else {
      htmlDescription += ` with the central concept "<span class="diagram-root-node">${Common.escapeHtml(
        rootText
      )}</span>"`;
    }

    // Add statistics
    htmlDescription += ` containing <span class="diagram-node-count">${nodeCount}</span> concepts`;
    htmlDescription += ` organised into <span class="diagram-level-count">${maxDepth}</span> levels`;

    // Add main branches
    if (rootNode && rootNode.children && rootNode.children.length > 0) {
      htmlDescription += `. The main branches are: <span class="diagram-main-branches">`;

      // Each branch name is escaped BEFORE the join, so the separator's own
      // markup stays furniture rather than being turned into entities.
      const mainBranches = rootNode.children
        .map((child) => {
          // Clean any shape markers from branch names
          return Common.escapeHtml(nodeLabelText(child, true));
        })
        .join('</span>, <span class="diagram-branch-name">');
      htmlDescription += `<span class="diagram-branch-name">${mainBranches}</span>`;
      htmlDescription += `</span>`;
    }

    htmlDescription += `.`;

    // Plain text version (without HTML tags)
    let plainTextDescription = `A mindmap diagram`;

    plainTextDescription += rootUnlabelled
      ? ` with ${UNLABELLED_NODE_MID_SENTENCE} as the central concept`
      : ` with the central concept "${rootText}"`;
    plainTextDescription += ` containing ${nodeCount} concepts organised into ${maxDepth} levels`;

    if (rootNode && rootNode.children && rootNode.children.length > 0) {
      plainTextDescription += `. The main branches are: `;
      plainTextDescription += rootNode.children
        .map((child) => nodeLabelText(child, true))
        .join(", ");
    }

    plainTextDescription += `.`;

    logInfo("Short description generated successfully");

    return {
      html: htmlDescription,
      text: plainTextDescription,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} The plain text description for backwards compatibility
   */
  function shortDescriptionWrapper(svgElement, code) {
    const descriptions = generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Parse mindmap structure from code or SVG
   * @param {string} code - The mermaid code
   * @param {HTMLElement} svgElement - The SVG element (fallback)
   * @returns {Object} Parsed mindmap structure
   */
  function parseMindmap(code, svgElement) {
    logDebug("Parsing mindmap structure");

    // Initialise the result structure
    const result = {
      rootNode: null,
      nodeMap: new Map(),
    };

    try {
      // First try to parse from code (more reliable)
      const parsedFromCode = parseMindmapFromCode(code);
      if (parsedFromCode.rootNode) {
        logDebug("Successfully parsed mindmap from code");
        return parsedFromCode;
      }

      // Fallback to parsing from SVG
      logDebug("Falling back to parsing from SVG");
      return parseMindmapFromSvg(svgElement);
    } catch (error) {
      logError(`Error parsing mindmap: ${error.message}`);

      // Return an empty structure if parsing fails
      return result;
    }
  }

  // ITEM 82, ENACTMENT 5 (3 October 2026): "a line break the picture draws is
  // read as a space; a <br> the picture prints as characters is read as
  // written." Mindmap's canvas breaks on every typed spelling (`<br>`,
  // `<br/>`, `<br />`, `<BR>`, a run, spaced), measured 2 October 2026
  // (measurement 2 § 3), so the shared rule is called with its default (all)
  // form set. The rule is the adapter's and is resolved off window AT CALL
  // TIME. The parse reads raw source bytes, so an escaped `&lt;br&gt;` or
  // `#lt;br#gt;` is not matched; what the words then say of it is out of
  // scope for this slice.
  //
  // An author's own quotation marks round a label are part of node.text and
  // are narrated, so the rule runs on what is INSIDE them: otherwise an edge
  // break would sit next to a quotation mark, read as interior, and leave a
  // stray space inside the quotes.
  //
  // ITEM 82, HELD EMPTIES (6 October 2026): "a label that draws nothing (only
  // a break, or only spaces) is read as unlabelled, in each type's own
  // words." A node the break and markup rules empty (only breaks, only tags,
  // only spaces, inside or without the author's quotation marks) draws an
  // empty node, and is read as "an unlabelled node" at its own place, with no
  // id (kanban K10's positional form) and no quotation marks: the phrase
  // replaces the label and the author's quotes with it. Capitalised at the
  // start of a list item, lower case mid-sentence. The emptiness test runs on
  // the text AFTER the rules and alters no bytes; the node is still counted.
  const QUOTED_NODE_TEXT = /^"([\s\S]*)"$/;
  const UNLABELLED_NODE = "An unlabelled node";
  const UNLABELLED_NODE_MID_SENTENCE = "an unlabelled node";

  /**
   * A node's label as narrated, or the unlabelled phrase.
   * @param {Object} node - A parsed node
   * @param {boolean} midSentence - Lower case when the label sits mid-sentence
   * @returns {string} Plain text, not escaped
   */
  function nodeLabelText(node, midSentence) {
    if (node && node.unlabelled) {
      return midSentence ? UNLABELLED_NODE_MID_SENTENCE : UNLABELLED_NODE;
    }
    return cleanNodeText(node ? node.text : "");
  }

  // ITEM 82, MARKUP ENACTMENT 4 (5 October 2026): "formatting the picture
  // draws is read as the plain text it formats." Mindmap's canvas draws
  // formatting tags, images, links and markdown emphasis, and PRINTS
  // backticks (measurement 3 § 3.2), so the adapter's markup rule is called
  // with tags and emphasis on and codespan off, after the break rule. It is
  // resolved off window AT CALL TIME. An escaped `&lt;b&gt;` or `#lt;b#gt;`
  // is not matched, because this parse reads raw source bytes; the entity
  // decode after it (entity slice, 6 October 2026) then reads it as the
  // characters the canvas prints. A node the
  // transform would EMPTY (only tags) is an unlabelled node (held empties,
  // above).
  const MINDMAP_DRAWN_MARKUP = Object.freeze({
    tags: true,
    emphasis: true,
    codespan: false,
  });
  let warnedMarkupRuleMissing = false;

  /**
   * Read drawn markup in node text as the text it formats.
   * @param {Object} adapter - window.MermaidParseAdapter
   * @param {string} text - The node text after the break rule
   * @returns {string} The text with drawn markup read as text, or the text
   *   as typed when the rule is not loaded
   */
  function readNodeMarkup(adapter, text) {
    if (typeof adapter.replaceDrawnMarkup !== "function") {
      if (!warnedMarkupRuleMissing) {
        warnedMarkupRuleMissing = true;
        logWarn(
          "[Mermaid Accessibility] Mindmap: the shared markup rule is not loaded; node text is read as typed"
        );
      }
      return text;
    }
    return adapter.replaceDrawnMarkup(text, MINDMAP_DRAWN_MARKUP);
  }

  // ITEM 82, ENTITY SLICE, ENACTMENT 1 (6 October 2026): "the words read the
  // characters the picture prints, decoded once and escaped once." A mindmap
  // node is drawn into a foreignObject, which resolves the author's own
  // references (`&lt;`, `&quot;`) as well as Mermaid's `#name;` codes, so an
  // escaped `&lt;b&gt;` prints as the characters `<b>`. The adapter's
  // decodeAuthorTextFromSource (Mermaid's encode, then the full decode) matched
  // that canvas on 15 of 15 forms (docs/mermaid-item-82-entity-measure-
  // 2026-10-06.md § 2). It runs LAST, on the raw string after the break and
  // markup rules, so an escaped tag is decoded to characters only after the
  // markup rule has passed over it; every narrating site escapes once. It is
  // resolved off window AT CALL TIME. A node the rules would empty is an
  // unlabelled node and is never decoded.
  let warnedDecodeMissing = false;

  /**
   * Decode node text as the canvas prints it.
   * @param {Object} adapter - window.MermaidParseAdapter
   * @param {string} text - The node text after the break and markup rules
   * @returns {string} The decoded text, or the text as typed when the decode
   *   is not loaded
   */
  function decodeNodeText(adapter, text) {
    if (typeof adapter.decodeAuthorTextFromSource !== "function") {
      if (!warnedDecodeMissing) {
        warnedDecodeMissing = true;
        logWarn(
          "[Mermaid Accessibility] Mindmap: the shared source decode is not loaded; node text is read as typed"
        );
      }
      return text;
    }
    return adapter.decodeAuthorTextFromSource(text);
  }

  /**
   * Read a node's text with typed line breaks as single spaces, drawn markup
   * as its text, and entities decoded as the canvas prints them.
   * @param {string} text - The node text after shape parsing
   * @returns {string|null} The text with breaks read as spaces, the text
   *   unchanged when the rule is not loaded, or null when the node draws
   *   nothing (an unlabelled node)
   */
  function readNodeBreaks(text) {
    if (typeof text !== "string") return text;

    const adapter = window.MermaidParseAdapter;
    if (!adapter || typeof adapter.replaceTypedLineBreaks !== "function") {
      logWarn(
        "[Mermaid Accessibility] Mindmap: the shared line-break rule is not loaded; node text is read as typed"
      );
      return text.trim() === "" ? null : text;
    }

    const quoted = text.match(QUOTED_NODE_TEXT);
    const inner = quoted ? quoted[1] : text;
    const withoutBreaks = adapter.replaceTypedLineBreaks(
      inner,
      adapter.LINE_BREAK_FORMS.ALL
    );
    const read = readNodeMarkup(adapter, withoutBreaks);
    if (read.trim() === "") return null;
    const decoded = decodeNodeText(adapter, read);
    return quoted ? `"${decoded}"` : decoded;
  }

  // ITEM 82, L2 (6 October 2026): "a link the picture draws is a working link
  // in the words." The anchor is written ONCE, at the node's own place in the
  // Complete Mindmap Structure list (renderNodeToHtml); the overview, the
  // insights and both short tiers read the text. The segment reader is the
  // adapter's readLabelWithLinks, resolved off window AT CALL TIME like the
  // two rules above; it delivers an admitted href only, decoded once, and
  // plain segments around it. Segments are kept ONLY when their join equals
  // the text this module already narrates. Since the entity slice (6 October
  // 2026) the node text is decoded and the reader is handed the source with
  // `fromSource`, so a label carrying an entity joins and keeps its anchor;
  // one whose cleanNodeText reading differs still reads as text.
  const ANCHOR_OPENING = /<a[\s/>]/i;
  let warnedLinkReaderMissing = false;

  /**
   * Join the text of a segment list.
   * @param {Array<{text: string, href?: string}>} segments - Label pieces
   * @returns {string} The plain label the pieces make
   */
  function joinSegmentText(segments) {
    return segments.map((segment) => segment.text).join("");
  }

  /**
   * Put the author's own quotation marks back round a segment list, as plain
   * text, so the list reads the same as node.text does.
   * @param {Array<{text: string, href?: string}>} segments - Label pieces
   * @returns {Array<{text: string, href?: string}>} The pieces, quoted
   */
  function quoteSegments(segments) {
    const quoted = segments.map((segment) => ({ ...segment }));
    if (quoted[0].href === undefined) {
      quoted[0].text = `"${quoted[0].text}`;
    } else {
      quoted.unshift({ text: '"' });
    }
    const last = quoted[quoted.length - 1];
    if (last.href === undefined) {
      last.text = `${last.text}"`;
    } else {
      quoted.push({ text: '"' });
    }
    return quoted;
  }

  /**
   * Read the link pieces of a node's text.
   * @param {string} typedText - The node text as parsed, before the break rule
   * @param {string} read - The text this module narrates (after the rules)
   * @returns {Array<{text: string, href?: string}>|null} The pieces, or null
   *   when the node draws no link, the reader is not loaded, or the pieces
   *   would not read as the narrated text
   */
  function readNodeSegments(typedText, read) {
    if (typeof typedText !== "string" || !ANCHOR_OPENING.test(typedText)) {
      return null;
    }

    const adapter = window.MermaidParseAdapter;
    if (!adapter || typeof adapter.readLabelWithLinks !== "function") {
      if (!warnedLinkReaderMissing) {
        warnedLinkReaderMissing = true;
        logWarn(
          "[Mermaid Accessibility] Mindmap: the shared link reader is not loaded; node text is read as typed, with no links"
        );
      }
      return null;
    }

    // `fromSource`: the reader encodes with Mermaid's rule first, so its
    // per-segment decode resolves what decodeNodeText resolves and the
    // segments join to the narrated text (entity slice, 6 October 2026).
    const quoted = typedText.match(QUOTED_NODE_TEXT);
    const result = adapter.readLabelWithLinks(
      quoted ? quoted[1] : typedText,
      MINDMAP_DRAWN_MARKUP,
      { fromSource: true }
    );
    if (!Array.isArray(result.segments) || result.segments.length === 0) {
      return null;
    }

    const segments = quoted ? quoteSegments(result.segments) : result.segments;
    return joinSegmentText(segments) === read ? segments : null;
  }

  /**
   * Render a node's narrated text, with the link it draws as a working link.
   * Falls back to the escaped text when the pieces do not read as it.
   * @param {Object} node - The parsed node
   * @param {string} displayText - The node text after cleanNodeText
   * @returns {string} HTML for the node's text
   */
  function renderNodeLabel(node, displayText) {
    const segments = node.segments;
    if (!Array.isArray(segments) || joinSegmentText(segments) !== displayText) {
      return Common.escapeHtml(displayText);
    }
    return Common.renderSegmentsHtml(segments, displayText);
  }

  /**
   * Parse mindmap from mermaid code
   * @param {string} code - The mermaid code
   * @returns {Object} Parsed mindmap structure
   */
  function parseMindmapFromCode(code) {
    logDebug("Parsing mindmap from mermaid code");

    // Initialise result object
    const result = {
      rootNode: null,
      nodeMap: new Map(),
    };

    if (!code) {
      logDebug("No code provided for parsing");
      return result;
    }

    // Check for theme initialisation and extract real mindmap code
    let cleanCode = code;

    // Remove any line with the "mindmap" declaration
    cleanCode = cleanCode.replace(/^\s*mindmap\s*$/m, "");

    // Handle any theme initialisation by removing it
    cleanCode = cleanCode.replace(/%%\{init:[\s\S]*?\}%%/, "");

    // Split the code into lines and remove empty lines
    const lines = cleanCode.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      logDebug("No content lines found after cleaning code");
      return result;
    }

    logDebug(`Processing ${lines.length} lines of code`);

    // We'll use a stack to keep track of the current parent node at each level
    const nodeStack = [];

    // Parse each line to build the hierarchy
    let previousIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Calculate the indent level of this line
      const indent = getIndentLevel(line);
      const content = line.trim();

      // Skip empty lines
      if (!content) continue;

      logDebug(`Processing line ${i}: "${content}" (indent: ${indent})`);

      // Parse node content and shape
      const node = parseNodeContent(content);
      const typedText = node.text;
      const read = readNodeBreaks(typedText);
      if (read === null) {
        // Draws nothing: an unlabelled node, with no text and no link.
        node.text = "";
        node.unlabelled = true;
      } else {
        node.text = read;
        const segments = readNodeSegments(typedText, node.text);
        if (segments) node.segments = segments;
      }

      // If this is the first line, it's the root node
      if (i === 0) {
        // If the root node contains theme initialisation, replace it with a generic title
        if (node.text.includes("%%{init:")) {
          node.text = "Root Topic"; // Generic fallback
          logDebug(
            "Root node contained theme initialisation, using fallback text"
          );
        }

        result.rootNode = node;
        result.nodeMap.set(node.id, node);
        nodeStack.push({ node, indent });
        previousIndent = indent;
        continue;
      }

      // Handle indentation changes to build the hierarchy
      if (indent > previousIndent) {
        // This is a child of the previous node
        const parentInfo = nodeStack[nodeStack.length - 1];
        const parent = parentInfo.node;

        if (!parent.children) parent.children = [];
        parent.children.push(node);
        node.parent = parent;

        nodeStack.push({ node, indent });
        logDebug(`Added as child of "${parent.text}"`);
      } else if (indent === previousIndent) {
        // This is a sibling of the previous node
        nodeStack.pop(); // Remove the previous sibling

        const parentInfo = nodeStack[nodeStack.length - 1];
        const parent = parentInfo.node;

        if (!parent.children) parent.children = [];
        parent.children.push(node);
        node.parent = parent;

        nodeStack.push({ node, indent });
        logDebug(`Added as sibling with parent "${parent.text}"`);
      } else {
        // This is a node at a higher level in the hierarchy
        // Pop nodes until we find the parent at the correct indent level
        while (
          nodeStack.length > 0 &&
          nodeStack[nodeStack.length - 1].indent >= indent
        ) {
          nodeStack.pop();
        }

        if (nodeStack.length === 0) {
          // If the stack is empty, this should be a top-level node
          // This is unexpected, but handle it gracefully
          logWarn(`Unexpected indentation in mindmap line: "${line}"`);

          if (!result.rootNode.children) result.rootNode.children = [];
          result.rootNode.children.push(node);
          node.parent = result.rootNode;

          nodeStack.push({ node, indent });
        } else {
          // Add as a child of the correct parent
          const parentInfo = nodeStack[nodeStack.length - 1];
          const parent = parentInfo.node;

          if (!parent.children) parent.children = [];
          parent.children.push(node);
          node.parent = parent;

          nodeStack.push({ node, indent });
          logDebug(`Added at higher level with parent "${parent.text}"`);
        }
      }

      // Store the node in the map
      result.nodeMap.set(node.id, node);

      // Update previous indent for next iteration
      previousIndent = indent;
    }

    logInfo(
      `Successfully parsed mindmap with ${result.nodeMap.size} nodes from code`
    );
    return result;
  }

  /**
   * Calculate the indentation level of a string
   * @param {string} str - The string to check
   * @returns {number} The number of spaces at the start of the string
   */
  function getIndentLevel(str) {
    const match = str.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Parse node content including shape and text
   * @param {string} content - The node content string
   * @returns {Object} Node object with text, shape, and id properties
   */
  function parseNodeContent(content) {
    const node = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: content,
      shape: "default",
    };

    logDebug(`Parsing node content: "${content}"`);

    // First, check for and remove class styling (:::class)
    // This needs to be processed before shape detection
    const classMatch = content.match(/:::\s*([\w\s]+)/);
    if (classMatch) {
      node.customClass = classMatch[1];
      // Remove the class styling from the content for further processing
      node.text = content.replace(/:::\s*([\w\s]+)/, "").trim();
      logDebug(`Found custom class: ${node.customClass}`);
    }

    // Strip any theme initialisation code if present
    if (node.text.includes("%%{init:")) {
      // Remove the theme initialisation part completely
      node.text = "Root Topic"; // Generic fallback
      node.hasThemeInit = true;
      logDebug("Node contained theme initialisation code");
      return node;
    }

    // Check for Markdown string with backticks
    const markdownStringMatch = node.text.match(/^(\w+)?[\s]*\["`(.*?)`"\]$/s);
    if (markdownStringMatch) {
      node.id = markdownStringMatch[1] || node.id;
      node.text = markdownStringMatch[2]
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1");
      node.shape = "markdown";
      logDebug(`Detected markdown string shape`);
      return node;
    }

    // Check for shape syntax - Process each shape option

    // Square [text]
    const squareMatch = node.text.match(/^(\w+)?\[(.*?)\]$/);
    if (squareMatch) {
      node.id = squareMatch[1] || node.id;
      node.text = squareMatch[2];
      node.shape = "square";
      logDebug(`Detected square shape`);
      return node;
    }

    // Rounded square (text)
    const roundedMatch = node.text.match(/^(\w+)?\((.*?)\)$/);
    if (roundedMatch) {
      node.id = roundedMatch[1] || node.id;
      node.text = roundedMatch[2];
      node.shape = "rounded";
      logDebug(`Detected rounded shape`);
      return node;
    }

    // Circle ((text))
    const circleMatch = node.text.match(/^(\w+)?\(\((.*?)\)\)$/);
    if (circleMatch) {
      node.id = circleMatch[1] || node.id;
      node.text = circleMatch[2];
      node.shape = "circle";
      logDebug(`Detected circle shape`);
      return node;
    }

    // Bang ))text((
    const bangMatch = node.text.match(/^(\w+)?\)\)(.*?)\(\($/);
    if (bangMatch) {
      node.id = bangMatch[1] || node.id;
      node.text = bangMatch[2];
      node.shape = "bang";
      logDebug(`Detected bang shape`);
      return node;
    }

    // Cloud )text(
    const cloudMatch = node.text.match(/^(\w+)?\)(.*?)\($/);
    if (cloudMatch) {
      node.id = cloudMatch[1] || node.id;
      node.text = cloudMatch[2];
      node.shape = "cloud";
      logDebug(`Detected cloud shape`);
      return node;
    }

    // Hexagon {{text}}
    const hexagonMatch = node.text.match(/^(\w+)?\{\{(.*?)\}\}$/);
    if (hexagonMatch) {
      node.id = hexagonMatch[1] || node.id;
      node.text = hexagonMatch[2];
      node.shape = "hexagon";
      logDebug(`Detected hexagon shape`);
      return node;
    }

    // Check for icon syntax
    const iconMatch = node.text.match(/::\s*icon\((.*?)\)/);
    if (iconMatch) {
      node.icon = iconMatch[1];
      // Store the icon type for accessible descriptions
      node.iconType = iconMatch[1];

      logDebug(`Found icon: ${node.iconType}`);

      // Replace the icon part from the text and generate readable icon description
      node.text = node.text.replace(/::\s*icon\((.*?)\)/, "").trim();

      // If this is a node that contains only an icon, provide a readable description
      if (node.text.includes("fa fa-") || node.text === "") {
        const iconName = node.iconType.replace("fa fa-", "").replace(/-/g, " ");
        node.iconDescription = `Icon: ${iconName}`;

        // If the node text is just the icon code, replace it with the readable description
        if (node.text.includes("fa fa-") || node.text === "") {
          node.text = node.iconDescription;
        }
      }
    }

    logDebug(`Parsed node - Text: "${node.text}", Shape: ${node.shape}`);
    return node;
  }

  /**
   * Parse mindmap structure from SVG element
   * @param {HTMLElement} svgElement - The SVG element
   * @returns {Object} Parsed mindmap structure
   */
  function parseMindmapFromSvg(svgElement) {
    logDebug("Parsing mindmap from SVG element");

    // Initialise result object
    const result = {
      rootNode: null,
      nodeMap: new Map(),
    };

    if (!svgElement) {
      logWarn("No SVG element provided for parsing");
      return result;
    }

    try {
      // Find all text elements which typically contain node text
      const textElements = svgElement.querySelectorAll("text");

      // If there are no text elements, we can't parse the mindmap
      if (textElements.length === 0) {
        logWarn("No text elements found in SVG");
        return result;
      }

      logDebug(`Found ${textElements.length} text elements in SVG`);

      // Create nodes from text elements
      const nodes = Array.from(textElements).map((text, index) => {
        // Get containing g element to determine node type
        const parentG = text.closest("g");

        // Check for shapes based on classes or other attributes
        let shape = "default";
        if (parentG) {
          if (parentG.classList.contains("mindmap-node-circle"))
            shape = "circle";
          else if (parentG.classList.contains("mindmap-node-square"))
            shape = "square";
          else if (parentG.classList.contains("mindmap-node-rounded"))
            shape = "rounded";
          else if (parentG.classList.contains("mindmap-node-cloud"))
            shape = "cloud";
          else if (parentG.classList.contains("mindmap-node-hexagon"))
            shape = "hexagon";
          else if (parentG.classList.contains("mindmap-node-bang"))
            shape = "bang";
        }

        return {
          id: `svg_node_${index}`,
          text: text.textContent.trim(),
          shape: shape,
          element: parentG || text,
          // We'll populate these later
          children: [],
          parent: null,
        };
      });

      // If we have at least one node, use the first as the root
      if (nodes.length > 0) {
        result.rootNode = nodes[0];

        // Store all nodes in the map
        nodes.forEach((node) => result.nodeMap.set(node.id, node));

        // Try to build the hierarchy by analysing paths between nodes
        // This is a simplified approach and might not always work
        const pathElements = svgElement.querySelectorAll("path");

        Array.from(pathElements).forEach((path) => {
          // For each path, try to find which nodes it connects
          // This requires complex geometry calculations
          // For this example, we'll use a simplified approach
          const childNode = findClosestNode(path, "end", nodes);
          const parentNode = findClosestNode(path, "start", nodes);

          if (parentNode && childNode && parentNode !== childNode) {
            if (!parentNode.children) parentNode.children = [];
            parentNode.children.push(childNode);
            childNode.parent = parentNode;
          }
        });

        logInfo(
          `Successfully parsed mindmap from SVG with ${nodes.length} nodes`
        );
      }

      return result;
    } catch (error) {
      logError(`Error parsing mindmap from SVG: ${error.message}`);
      return result;
    }
  }

  /**
   * Find the closest node to a point on a path (simplified version)
   * @param {SVGPathElement} path - The path element
   * @param {string} point - 'start' or 'end' of the path
   * @param {Array} nodes - List of nodes
   * @returns {Object|null} The closest node
   */
  function findClosestNode(path, point, nodes) {
    // This is a simplified placeholder function
    // In a real implementation, you would calculate the coordinates of the path's endpoints
    // and find which node is closest to those coordinates

    // For now, return null to indicate we can't determine connections
    logDebug(
      "Cannot determine node connections from SVG paths (simplified implementation)"
    );
    return null;
  }

  /**
   * Count the total number of nodes in the mindmap
   * @param {Object} mindmapStructure - Parsed mindmap structure
   * @returns {number} Total number of nodes
   */
  function countNodes(mindmapStructure) {
    const count = mindmapStructure.nodeMap.size;
    logDebug(`Counted ${count} nodes in mindmap`);
    return count;
  }

  /**
   * Get the maximum depth of the mindmap
   * @param {Object} mindmapStructure - Parsed mindmap structure
   * @returns {number} Maximum depth (1 for just root node)
   */
  function getMaxDepth(mindmapStructure) {
    const rootNode = mindmapStructure.rootNode;
    if (!rootNode) {
      logDebug("No root node found for depth calculation");
      return 0;
    }

    let maxDepth = 1; // Start with 1 for the root node

    function traverseForDepth(node, currentDepth) {
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }

      if (node.children) {
        node.children.forEach((child) => {
          traverseForDepth(child, currentDepth + 1);
        });
      }
    }

    traverseForDepth(rootNode, 1);
    logDebug(`Maximum depth calculated as ${maxDepth}`);
    return maxDepth;
  }

  /**
   * Render a node and its children to HTML list format
   * @param {Object} node - Node to render
   * @param {number} level - Current hierarchy level
   * @returns {string} HTML for node and its children
   */
  function renderNodeToHtml(node, level) {
    if (!node) return "";

    let html = `<li class="mindmap-node mindmap-node-${
      node.shape || "default"
    }">`;

    // Add appropriate classes if the node has an icon or custom class
    let classes = "";
    if (node.icon) {
      const iconName = node.icon.replace("fa fa-", "");
      classes += ` has-icon icon-${node.icon.replace(/\s+/g, "-")}`;

      // Add data attribute for screen readers
      html = `<li class="mindmap-node mindmap-node-${
        node.shape || "default"
      }${classes}" data-icon="${iconName}">`;
    } else if (node.customClass) {
      classes += ` ${node.customClass}`;

      // Add classes
      html = `<li class="mindmap-node mindmap-node-${
        node.shape || "default"
      }${classes}">`;
    }

    // Clean the text to remove shape markers
    let displayText = cleanNodeText(node.text);

    // Render the node text with appropriate level class
    // If this is an icon-only node, provide better text
    if (
      (displayText.includes("fa fa-") || displayText === "") &&
      node.iconType
    ) {
      const iconName = node.iconType.replace("fa fa-", "").replace(/-/g, " ");
      html += `<span class="mindmap-node-text mindmap-level-${level}">Icon: ${Common.escapeHtml(
        iconName
      )}</span>`;
    } else if (node.unlabelled) {
      html += `<span class="mindmap-node-text mindmap-level-${level}">${UNLABELLED_NODE}</span>`;
    } else {
      html += `<span class="mindmap-node-text mindmap-level-${level}">${renderNodeLabel(
        node,
        displayText
      )}</span>`;
    }

    // Render children if any
    if (node.children && node.children.length > 0) {
      html += `<ul class="mindmap-children">`;
      node.children.forEach((child) => {
        html += renderNodeToHtml(child, level + 1);
      });
      html += `</ul>`;
    }

    html += `</li>`;
    return html;
  }

  /**
   * Generate a detailed description for a mindmap
   * @param {HTMLElement} svgElement - The SVG element
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo("Generating detailed mindmap description");

    // Parse the mindmap structure
    const mindmapStructure = parseMindmap(code, svgElement);
    const rootNode = mindmapStructure.rootNode;

    if (!rootNode) {
      logWarn("Could not parse mindmap for detailed description");
      return "<p>This appears to be a mindmap diagram, but it could not be parsed for details.</p>";
    }

    // Calculate statistics
    const nodeCount = countNodes(mindmapStructure);
    const maxDepth = getMaxDepth(mindmapStructure);

    logDebug(
      `Generating detailed description for mindmap with ${nodeCount} nodes and depth ${maxDepth}`
    );

    // Build the description HTML
    let description = `<div class="mindmap-description">`;

    // Overview section
    description += `<section class="mindmap-section mindmap-overview">
      <h4 class="mindmap-section-heading">Mindmap Overview</h4>
      
 <p>This mindmap diagram is centred on ${
   rootNode.unlabelled
     ? UNLABELLED_NODE_MID_SENTENCE
     : `the concept "<span class="mindmap-root-concept">${Common.escapeHtml(
         cleanNodeText(rootNode.text)
       )}</span>"`
 } and contains ${nodeCount} total concepts organised into ${maxDepth} levels.</p>`;
    if (rootNode.children && rootNode.children.length > 0) {
      const mainTopics = rootNode.children.length;
      description += `<p>The diagram branches into ${mainTopics} main topics:</p>
      <ul class="mindmap-main-topics">`;

      rootNode.children.forEach((child) => {
        let subTopics = 0;
        if (child.children) subTopics = child.children.length;

        description += `<li><span class="mindmap-topic">${Common.escapeHtml(
          nodeLabelText(child, false)
        )}</span>`;
        if (subTopics > 0) {
          description += ` (contains ${subTopics} sub-topic${
            subTopics !== 1 ? "s" : ""
          })`;
        }
        description += `</li>`;
      });

      description += `</ul>`;
    }

    description += `</section>`;

    // Full structure section
    description += `<section class="mindmap-section mindmap-structure">
      <h4 class="mindmap-section-heading">Complete Mindmap Structure</h4>
      <p>The full hierarchical structure of the mindmap:</p>
      <ul class="mindmap-hierarchy">`;

    // Render the root node and all its children recursively
    description += renderNodeToHtml(rootNode, 1);

    description += `</ul>
    </section>`;

    // Generate key insights section based on structure analysis
    description += generateInsightsSection(mindmapStructure);

    // Visual representation note
    description += `<section class="mindmap-section mindmap-visual-note">
      <h4 class="mindmap-section-heading">Visual Representation</h4>
      <p>In the visual diagram, concepts are arranged radially around the central topic, with connecting lines showing relationships between parent and child concepts.</p>`;

    // Note shapes only where they genuinely differentiate. A circled root with
    // plain children is mindmap convention rather than a distinction a reader
    // can use, so the root's own shape alone earns no sentence at all. Root and
    // non-root shapes are therefore collected separately.
    const shapes = new Set();
    const shapesBelowRoot = new Set();
    mindmapStructure.nodeMap.forEach((node) => {
      if (!node.shape || node.shape === "default") return;

      shapes.add(node.shape);
      // Identity, not id: both parse paths put the very object they assigned to
      // rootNode into nodeMap, so this holds for the code and the SVG route.
      if (node !== rootNode) shapesBelowRoot.add(node.shape);
    });

    // Shape words are the module's own vocabulary (rounded, square, circle,
    // bang, cloud, hexagon) and never author text, so they are furniture here
    // and are not escaped.
    if (shapes.size > 1) {
      // Two or more distinct shapes: the plural claim is supported.
      const shapeList = Array.from(shapes).join(", ");
      description += `<p>The diagram uses different shapes (${shapeList}) to visually distinguish between different types of concepts.</p>`;
      logDebug(`Found different shapes in mindmap: ${shapeList}`);
    } else if (shapesBelowRoot.size === 1) {
      // One shape, carried below the root: it marks those concepts out from the
      // rest, but nothing is distinguished from anything else, so the sentence
      // claims marking rather than differentiation. "the" avoids any a/an
      // selection against the shape word.
      const [shape] = shapesBelowRoot;
      description += `<p>The diagram uses the ${shape} shape to visually mark some concepts.</p>`;
      logDebug(`Found a single marking shape in mindmap: ${shape}`);
    } else {
      logDebug(
        `No differentiating shapes in mindmap: ${shapes.size} distinct non-default shape(s), none below the root`
      );
    }

    description += `</section>`;

    // Close the main container
    description += `</div>`;

    logInfo("Detailed description generated successfully");
    return description;
  }

  /**
   * Generate insights section based on mindmap structure analysis
   * @param {Object} mindmapStructure - Parsed mindmap structure
   * @returns {string} HTML for insights section
   */
  function generateInsightsSection(mindmapStructure) {
    const rootNode = mindmapStructure.rootNode;
    if (!rootNode) return "";

    logDebug("Generating insights section");

    // Calculate some metrics for insights
    const branchBalanceInfo = analyzeBranchBalance(rootNode);
    const deepestPaths = findDeepestPaths(rootNode);
    const branchingFactor = calculateBranchingFactor(rootNode);

    let insights = `<section class="mindmap-section mindmap-insights">
    <h4 class="mindmap-section-heading">Key Insights</h4>
    <ul class="mindmap-insights-list">`;

    // Branch balance insight
    insights += `<li class="mindmap-insight">The mindmap has ${branchBalanceInfo.branchCount} main branches. `;

    if (branchBalanceInfo.isBalanced) {
      insights += `These branches are relatively balanced in terms of content distribution.`;
    } else if (branchBalanceInfo.largestUnlabelled) {
      // The label's quotation marks cannot hold the unlabelled phrase.
      insights += `The branches vary in size, with the branch from ${UNLABELLED_NODE_MID_SENTENCE} containing the most sub-topics (${
        branchBalanceInfo.largestSize
      }).`;
    } else {
      insights += `The branches vary in size, with the "${Common.escapeHtml(
        branchBalanceInfo.largestBranch
      )}" branch containing the most sub-topics (${
        branchBalanceInfo.largestSize
      }).`;
    }
    insights += `</li>`;

    // Depth insight
    if (deepestPaths.length > 0) {
      // Clean up path text to avoid including theme initialisation code
      const pathText = deepestPaths[0]
        .map((node) => {
          // An unlabelled node sits mid-sentence on the path.
          if (node.unlabelled) return UNLABELLED_NODE_MID_SENTENCE;

          // Handle nodes with theme initialisation
          let text = node.text;
          if (text.includes("%%{init:")) {
            text = "Digital Accessibility";
          }
          // Handle icon-only nodes
          if (text.includes("fa fa-") && node.iconType) {
            const iconName = node.iconType
              .replace("fa fa-", "")
              .replace("-", " ");
            text = `Icon: ${iconName}`;
          }
          // Escaped per item, AFTER the transforms above, so the " → "
          // separator inserted by the join stays furniture.
          return Common.escapeHtml(text);
        })
        .join(" → ");

      insights += `<li class="mindmap-insight">The deepest path in the mindmap extends to ${deepestPaths[0].length} levels: ${pathText}</li>`;
    }

    // Branching factor insight
    insights += `<li class="mindmap-insight">The average number of sub-topics per concept is ${branchingFactor.toFixed(
      1
    )}, indicating a ${
      branchingFactor > 3 ? "broad" : "focused"
    } conceptual organisation.</li>`;

    insights += `</ul>
  </section>`;

    return insights;
  }

  /**
   * Analyse branch balance of the mindmap
   * @param {Object} rootNode - Root node of the mindmap
   * @returns {Object} Information about branch balance
   */
  function analyzeBranchBalance(rootNode) {
    if (!rootNode || !rootNode.children) {
      return { branchCount: 0, isBalanced: true };
    }

    const branchCount = rootNode.children.length;

    if (branchCount <= 1) {
      return { branchCount, isBalanced: true };
    }

    // Calculate size of each branch (total nodes)
    const branchSizes = rootNode.children.map((child) => {
      return {
        name: child.text,
        unlabelled: Boolean(child.unlabelled),
        size: countNodesInSubtree(child),
      };
    });

    // Find largest and smallest branch
    let largestBranch = branchSizes[0].name;
    let largestUnlabelled = branchSizes[0].unlabelled;
    let largestSize = branchSizes[0].size;
    let smallestSize = branchSizes[0].size;

    branchSizes.forEach((branch) => {
      if (branch.size > largestSize) {
        largestSize = branch.size;
        largestBranch = branch.name;
        largestUnlabelled = branch.unlabelled;
      }
      if (branch.size < smallestSize) {
        smallestSize = branch.size;
      }
    });

    // Consider balanced if the largest is less than 3x the smallest
    const isBalanced = largestSize < smallestSize * 3;

    logDebug(
      `Branch balance analysis - Count: ${branchCount}, Balanced: ${isBalanced}`
    );

    return {
      branchCount,
      isBalanced,
      largestBranch,
      largestUnlabelled,
      largestSize,
    };
  }

  /**
   * Count nodes in a subtree
   * @param {Object} node - Root node of the subtree
   * @returns {number} Number of nodes
   */
  function countNodesInSubtree(node) {
    if (!node) return 0;

    let count = 1; // Count this node

    if (node.children) {
      node.children.forEach((child) => {
        count += countNodesInSubtree(child);
      });
    }

    return count;
  }

  /**
   * Find the deepest paths in the mindmap
   * @param {Object} rootNode - Root node of the mindmap
   * @returns {Array} Array of the deepest paths (each path is an array of nodes)
   */
  function findDeepestPaths(rootNode) {
    const paths = [];
    let maxDepth = 0;

    function traverse(node, currentPath) {
      // Create a clean copy of the node with properly cleaned text
      const cleanedNode = {
        ...node,
        text: cleanNodeText(node.text),
      };

      // Skip nodes that have initialisation code or unclear text
      if (cleanedNode.text.includes("%%{init:")) {
        // Replace with generic text
        cleanedNode.text = "Root Topic";
      }

      const newPath = [...currentPath, cleanedNode];

      if (!node.children || node.children.length === 0) {
        // This is a leaf node
        if (newPath.length > maxDepth) {
          maxDepth = newPath.length;
          paths.length = 0; // Clear previous paths
          paths.push(newPath);
        } else if (newPath.length === maxDepth) {
          paths.push(newPath);
        }
        return;
      }

      node.children.forEach((child) => {
        traverse(child, newPath);
      });
    }

    if (rootNode) {
      traverse(rootNode, []);
    }

    logDebug(`Found ${paths.length} deepest paths with depth ${maxDepth}`);
    return paths;
  }

  /**
   * Calculate the average branching factor of the mindmap
   * @param {Object} rootNode - Root node of the mindmap
   * @returns {number} Average branching factor
   */
  function calculateBranchingFactor(rootNode) {
    let totalNodes = 0;
    let nodesWithChildren = 0;
    let totalBranches = 0;

    function traverse(node) {
      totalNodes++;

      if (node.children && node.children.length > 0) {
        nodesWithChildren++;
        totalBranches += node.children.length;

        node.children.forEach((child) => traverse(child));
      }
    }

    if (rootNode) {
      traverse(rootNode);
    }

    const branchingFactor =
      nodesWithChildren > 0 ? totalBranches / nodesWithChildren : 0;
    logDebug(`Calculated branching factor: ${branchingFactor.toFixed(2)}`);
    return branchingFactor;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("mindmap", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: function (svgElement, code) {
      return generateShortDescription(svgElement, code).html;
    },
  });

  logInfo("Mindmap module loaded and registered successfully");

  // Return public API (minimal since this module primarily registers with core)
  return {
    // Expose logging level control for configuration if needed
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo(`Logging level changed to ${level}`);
      } else {
        logWarn(`Invalid log level: ${level}. Must be 0-3.`);
      }
    },
    getLogLevel: function () {
      return currentLogLevel;
    },
  };
})();

// Export handling (outside module scope)
if (typeof module !== "undefined" && module.exports) {
  module.exports = MermaidAccessibilityMindmap;
} else {
  window.MermaidAccessibilityMindmap = MermaidAccessibilityMindmap;
}
