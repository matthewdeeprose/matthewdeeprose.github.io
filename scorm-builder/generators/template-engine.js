// Minimal Handlebars-like template engine — the subset the playground templates
// actually use: {{var}}, {{{raw}}}, {{#if}}/{{else}}/{{/if}}, {{#each}}/{{/each}},
// {{>partial}}, helper calls ({{formatPercent x}}) and pipe filters ({{v | lowercase}}).
//
// This is a deliberate reimplementation (not a port of the 2000-line
// template-engine.js) so the standalone library carries no fetch/cache machinery.

const MUSTACHE = /\{\{\{([\s\S]*?)\}\}\}|\{\{([\s\S]*?)\}\}/g;

function tokenize(str) {
  const tokens = [];
  let last = 0;
  let m;
  MUSTACHE.lastIndex = 0;
  while ((m = MUSTACHE.exec(str)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: str.slice(last, m.index) });
    const raw = m[1] !== undefined;
    tokens.push({ type: "mustache", raw, content: (raw ? m[1] : m[2]).trim() });
    last = m.index + m[0].length;
  }
  if (last < str.length) tokens.push({ type: "text", value: str.slice(last) });
  return tokens;
}

function parse(str) {
  const root = { type: "root", children: [] };
  const stack = [{ node: root, target: root.children }];
  const top = () => stack[stack.length - 1];

  for (const tok of tokenize(str)) {
    if (tok.type === "text") {
      top().target.push(tok);
      continue;
    }
    const c = tok.content;
    // A block helper may be separated from its argument by ANY whitespace, so a
    // line-wrapped tag ({{#if\n  someFlag}}) is legal and must parse. Matching a
    // literal "#if " missed those, fell through to the expression branch, and
    // rendered the block's body UNCONDITIONALLY while emitting nothing for the
    // tag itself — silently inverting three checkbox defaults in the exported
    // MathJax controls, one of which ("Explore equations") then blanked every
    // equation on screen. Hence also the fail-loud guard below.
    const eachMatch = /^#each\s+([\s\S]+)$/.exec(c);
    const ifMatch = /^#if\s+([\s\S]+)$/.exec(c);
    if (eachMatch) {
      const node = { type: "each", expr: eachMatch[1].trim(), children: [] };
      top().target.push(node);
      stack.push({ node, target: node.children });
    } else if (ifMatch) {
      const node = { type: "if", cond: ifMatch[1].trim(), children: [], elseChildren: null };
      top().target.push(node);
      stack.push({ node, target: node.children });
    } else if (c.startsWith("#")) {
      // Never silently degrade an unrecognised block helper into "render the body
      // anyway" — that is how the defect above shipped. Only #if/#each exist.
      throw new Error(`template-engine: unsupported block helper {{${c}}}`);
    } else if (c === "else") {
      const frame = top();
      if (frame.node.type === "if") {
        frame.node.elseChildren = [];
        frame.target = frame.node.elseChildren;
      }
    } else if (c === "/if" || c === "/each") {
      if (stack.length > 1) stack.pop();
    } else if (c.startsWith(">")) {
      top().target.push({ type: "partial", name: c.slice(1).trim() });
    } else {
      top().target.push({ type: "expr", expr: c, raw: tok.raw });
    }
  }
  return root;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isTruthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function resolvePath(context, path) {
  if (path === "this" || path === ".") return context;
  let cur = context;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function resolveArg(arg, context) {
  if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
  if (/^"[^"]*"$/.test(arg) || /^'[^']*'$/.test(arg)) return arg.slice(1, -1);
  return resolvePath(context, arg);
}

function evalExpr(expr, context, env) {
  expr = expr.trim();

  // pipe filters: a | filter1 | filter2
  if (expr.includes("|")) {
    const parts = expr.split("|").map((s) => s.trim());
    let value = evalExpr(parts[0], context, env);
    for (const name of parts.slice(1)) {
      if (env.filters && env.filters[name]) value = env.filters[name](value);
    }
    return value;
  }

  // helper call: name arg1 arg2
  const sp = expr.indexOf(" ");
  if (sp > 0) {
    const name = expr.slice(0, sp);
    if (env.helpers && env.helpers[name]) {
      const args = expr
        .slice(sp + 1)
        .trim()
        .split(/\s+/)
        .map((a) => resolveArg(a, context));
      return env.helpers[name](...args);
    }
  }

  return resolvePath(context, expr);
}

function renderNodes(nodes, context, env) {
  let out = "";
  for (const node of nodes) out += renderNode(node, context, env);
  return out;
}

function renderNode(node, context, env) {
  switch (node.type) {
    case "root":
      return renderNodes(node.children, context, env);
    case "text":
      return node.value;
    case "expr": {
      const value = evalExpr(node.expr, context, env);
      return node.raw ? (value == null ? "" : String(value)) : escapeHtml(value);
    }
    case "if": {
      const cond = isTruthy(evalExpr(node.cond, context, env));
      return cond ? renderNodes(node.children, context, env) : renderNodes(node.elseChildren || [], context, env);
    }
    case "each": {
      const arr = evalExpr(node.expr, context, env);
      if (!Array.isArray(arr)) return "";
      return arr.map((item) => renderNodes(node.children, item, env)).join("");
    }
    case "partial": {
      const tmpl = env.partials && env.partials[node.name];
      if (tmpl === undefined) return "";
      const ast = env.partialCache.get(node.name) || parse(tmpl);
      env.partialCache.set(node.name, ast);
      return renderNode(ast, context, env);
    }
    default:
      return "";
  }
}

export const DEFAULT_HELPERS = {
  formatPercent: (v) => `${Math.round(Number(v) * 100)}%`,
  // Up to 2 decimals, trailing zeros trimmed (so quarter steps like 1.25 read
  // honestly: 1.25 -> "1.25", 1.5 -> "1.5", 2 -> "2").
  formatSize: (v) => String(Number(Number(v).toFixed(2))),
};

export const DEFAULT_FILTERS = {
  lowercase: (v) => String(v).toLowerCase(),
  uppercase: (v) => String(v).toUpperCase(),
};

/**
 * Render a template string.
 * @param {string} template
 * @param {object} context
 * @param {object} [options] - { partials, helpers, filters }
 * @returns {string}
 */
export function render(template, context = {}, options = {}) {
  const env = {
    partials: options.partials || {},
    helpers: { ...DEFAULT_HELPERS, ...(options.helpers || {}) },
    filters: { ...DEFAULT_FILTERS, ...(options.filters || {}) },
    partialCache: new Map(),
  };
  return renderNode(parse(template), context, env);
}
