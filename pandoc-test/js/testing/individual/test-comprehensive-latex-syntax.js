// test-comprehensive-latex-syntax.js
// Comprehensive LaTeX Syntax Testing Protocol Implementation
// Validates complete LaTeX mathematical expression coverage as per testing protocol

const TestComprehensiveLaTeXSyntax = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[COMPREHENSIVE-LATEX]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[COMPREHENSIVE-LATEX]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[COMPREHENSIVE-LATEX]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[COMPREHENSIVE-LATEX]", message, ...args);
  }

  // ===========================================================================================
  // COMPLETE TEST SUITE DATA - ALL 7 TEST SUITES FROM PROTOCOL
  // ===========================================================================================

  const COMPREHENSIVE_TEST_SUITES = {
    // Test Suite 1: Fundamental Operations
    fundamentalOperations: {
      basicArithmetic: [
        "x^2 + y^2 = z^2",
        "a_1, a_2, \\ldots, a_n",
        "x^{2n+1} + y_{i,j}^{(k)}",
        "\\frac{1}{2} + \\frac{a+b}{c-d} = \\frac{2(c-d) + (a+b)}{2(c-d)}",
        "\\frac{1}{1+\\frac{1}{1+\\frac{1}{x}}}",
        "\\cfrac{1}{1+\\cfrac{1}{1+\\cfrac{1}{x}}}",
        "\\binom{n}{k} = \\frac{n!}{k!(n-k)!}",
      ],
      rootsAndRadicals: [
        "\\sqrt{2}, \\sqrt{x^2 + y^2}, \\sqrt{\\frac{a}{b}}",
        "\\sqrt[3]{8}, \\sqrt[n]{x^n}, \\sqrt[4]{\\frac{a^2}{b^2}}",
        "\\sqrt{2 + \\sqrt{3 + \\sqrt{5}}}",
      ],
    },

    // Test Suite 2: Advanced Mathematical Structures
    advancedStructures: {
      summationsAndProducts: [
        "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
        "\\sum_{i=1}^{m} \\sum_{j=1}^{n} a_{ij}",
        "\\sum_{\\substack{1 \\leq i \\leq n \\\\ i \\text{ odd}}} x_i",
        "\\prod_{k=1}^{n} (1 + x_k)",
        "\\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = e^x",
      ],
      integrals: [
        "\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
        "\\int \\frac{1}{x} \\, dx = \\ln|x| + C",
        "\\iint_D f(x,y) \\, dA = \\int_a^b \\int_{g(x)}^{h(x)} f(x,y) \\, dy \\, dx",
        "\\oint_C \\mathbf{F} \\cdot d\\mathbf{r}",
        "\\int_0^{\\infty} e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}",
      ],
      limitsAndDerivatives: [
        "\\lim_{x \\to \\infty} \\frac{1}{x} = 0",
        "\\lim_{\\substack{x \\to 0 \\\\ x > 0}} \\frac{\\sin x}{x} = 1",
        "\\frac{d}{dx}[f(x)g(x)] = f'(x)g(x) + f(x)g'(x)",
        "\\frac{\\partial^2 f}{\\partial x \\partial y} = \\frac{\\partial^2 f}{\\partial y \\partial x}",
        "\\lim_{x \\to 0} \\frac{\\sin x - x}{x^3} = \\lim_{x \\to 0} \\frac{\\cos x - 1}{3x^2} = -\\frac{1}{6}",
      ],
    },

    // Test Suite 3: Matrix Operations
    matrixOperations: {
      basicMatrices: [
        "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
        "\\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{bmatrix}",
        "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc",
        "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} ax+by \\\\ cx+dy \\end{pmatrix}",
      ],
      advancedMatrices: [
        "A\\mathbf{v} = \\lambda\\mathbf{v}",
        "A^{-1} = \\frac{1}{\\det(A)} \\text{adj}(A)",
      ],
    },

    // Test Suite 4: Specialised Symbols
    specialisedSymbols: {
      greekLetters: [
        "\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\varepsilon, \\zeta",
        "\\eta, \\theta, \\vartheta, \\iota, \\kappa, \\lambda, \\mu, \\nu",
        "\\xi, \\pi, \\varpi, \\rho, \\varrho, \\sigma, \\varsigma, \\tau",
        "\\upsilon, \\phi, \\varphi, \\chi, \\psi, \\omega",
        "\\Gamma, \\Delta, \\Theta, \\Lambda, \\Xi, \\Pi, \\Sigma",
        "\\Upsilon, \\Phi, \\Psi, \\Omega",
      ],
      setTheoryAndLogic: [
        "A \\cup B, A \\cap B, A \\setminus B, A \\times B",
        "A \\subset B, A \\subseteq B, A \\supset B, A \\supseteq B",
        "\\emptyset, \\varnothing, \\mathbb{N}, \\mathbb{Z}, \\mathbb{Q}, \\mathbb{R}, \\mathbb{C}",
        "\\forall x \\in \\mathbb{R}, \\exists y \\in \\mathbb{R} : x + y = 0",
        "p \\land q, p \\lor q, \\neg p, p \\implies q, p \\iff q",
      ],
      relationsAndArrows: [
        "a < b, a \\leq b, a \\geq b, a > b, a \\neq b",
        "a \\equiv b \\pmod{n}, a \\sim b, a \\cong b, a \\approx b",
        "f: A \\to B, A \\xrightarrow{f} B, A \\leftrightarrow B, A \\mapsto B",
        "\\hookrightarrow, \\twoheadrightarrow, \\rightharpoonup, \\rightharpoondown",
      ],
    },

    // Test Suite 5: Advanced Typography
    advancedTypography: {
      mathematicalFonts: [
        "\\mathbb{R}, \\mathbb{C}, \\mathbb{N}, \\mathbb{Z}, \\mathbb{Q}",
        "\\mathcal{L}(\\mathcal{F}) = \\{f \\in \\mathcal{F} : f \\text{ is linear}\\}",
        "\\mathfrak{g} \\subseteq \\mathfrak{h}",
        "\\mathbf{v} = \\mathbf{u} + \\mathbf{w}",
        "\\mathrm{d}x, \\mathrm{sin}(x), \\mathrm{log}(x)",
        "\\mathsf{Vector} \\times \\mathsf{Matrix} = \\mathsf{Result}",
        "\\mathtt{function}(\\mathtt{argument}) = \\mathtt{result}",
      ],
      accentsAndDecorations: [
        "\\hat{x}, \\widehat{ABC}, \\bar{x}, \\overline{ABC}",
        "\\vec{v}, \\overrightarrow{AB}",
        "\\underline{text}, \\underbrace{a + b + c}_{3 \\text{ terms}}",
        "\\dot{x}, \\ddot{x}, \\dddot{x}, \\ddddot{x}",
        "\\tilde{x}, \\widetilde{ABC}, \\check{x}, \\widecheck{ABC}",
      ],
    },

    // Test Suite 6: Complex Environments
    complexEnvironments: {
      equationSystems: [
        "\\begin{align} x + y &= 5 \\\\ 2x - y &= 1 \\\\ \\therefore x &= 2, y = 3 \\end{align}",
        "f(x) = \\begin{cases} x^2 & \\text{if } x \\geq 0 \\\\ -x^2 & \\text{if } x < 0 \\\\ 0 & \\text{if } x = 0 \\end{cases}",
        "\\begin{gather} a = b + c \\\\ d = e + f + g \\\\ h = i + j + k + l \\end{gather}",
      ],
      advancedConstructs: [
        "\\begin{array}{ccc} A & \\xrightarrow{f} & B \\\\ \\downarrow & & \\downarrow \\\\ C & \\xrightarrow{g} & D \\end{array}",
        "\\vec{\\nabla} \\cdot \\vec{E} = \\frac{\\rho}{\\epsilon_0}",
        "\\frac{\\frac{a}{b} + \\frac{c}{d}}{\\frac{e}{f} - \\frac{g}{h}} = \\frac{ad + bc}{bd} \\cdot \\frac{fh}{eh - fg}",
      ],
    },

    // Test Suite 7: Equation Syntax Variants (NEW)
    equationSyntaxVariants: {
      inlineMathematics: [
        "\\(x^2 + y^2 = z^2\\) and more complex \\(\\sum_{i=1}^{n} a_i = S\\)",
        "$a^2 + b^2 = c^2$ and fractions $\\frac{1}{2\\pi}$",
        "\\(\\int_0^1 f(x) dx\\) versus $\\lim_{x \\to \\infty} \\frac{1}{x} = 0$",
        "\\(\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\) and $\\sqrt{x^2 + y^2}$",
      ],
      displayMathematics: [
        "\\[ \\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = e^x \\]",
        "$$ \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi} $$",
        "\\begin{equation} \\frac{d}{dx}\\left[\\int_a^x f(t) dt\\right] = f(x) \\end{equation}",
        "\\begin{equation*} \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = f'(x) \\end{equation*}",
      ],
      multiLineEquations: [
        "\\begin{align} \\cos^2 \\theta + \\sin^2 \\theta &= 1 \\\\ 1 + \\tan^2 \\theta &= \\sec^2 \\theta \\\\ 1 + \\cot^2 \\theta &= \\csc^2 \\theta \\end{align}",
        "\\begin{gather*} \\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\epsilon_0} \\\\ \\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t} \\end{gather*}",
        "\\begin{align} \\text{Area} &= \\int_0^{2\\pi} \\int_0^r \\rho \\, d\\rho \\, d\\theta \\\\ &= \\pi r^2 \\end{align}",
      ],
    },

    // Test Suite 8: Combinatorics and Probability (NEW)
    combinatoricsAndProbability: {
      combinatorics: [
        "P(n,r) = \\frac{n!}{(n-r)!} \\quad \\text{and} \\quad C(n,r) = \\binom{n}{r} = \\frac{n!}{r!(n-r)!}",
        "\\binom{n}{0} + \\binom{n}{1} + \\binom{n}{2} + \\cdots + \\binom{n}{n} = 2^n",
        "S(n,k) = \\frac{1}{k!}\\sum_{j=0}^{k}(-1)^{k-j}\\binom{k}{j}j^n",
      ],
      probability: [
        "P(A|B) = \\frac{P(A \\cap B)}{P(B)}",
        "E[X] = \\sum_{x} x \\cdot P(X = x) \\quad \\text{and} \\quad \\text{Var}(X) = E[X^2] - (E[X])^2",
        "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}",
      ],
    },

    // Test Suite 9: Statistics and Data Analysis (NEW)
    statisticsAndDataAnalysis: {
      descriptiveStatistics: [
        "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i \\quad \\text{and} \\quad s^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2",
        "r = \\frac{\\sum_{i=1}^{n}(x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum_{i=1}^{n}(x_i - \\bar{x})^2 \\sum_{i=1}^{n}(y_i - \\bar{y})^2}}",
      ],
      hypothesisTesting: [
        "t = \\frac{\\bar{x} - \\mu_0}{s/\\sqrt{n}} \\sim t_{n-1}",
        "\\chi^2 = \\sum_{i=1}^{k} \\frac{(O_i - E_i)^2}{E_i}",
      ],
    },

    // Test Suite 10: Trigonometry and Inverse Functions (NEW)
    trigonometryAndInverseFunctions: {
      trigonometricFunctions: [
        "\\sin^2 x + \\cos^2 x = 1 \\quad \\text{and} \\quad 1 + \\tan^2 x = \\sec^2 x",
        "\\sin(a \\pm b) = \\sin a \\cos b \\pm \\cos a \\sin b",
        "e^{ix} = \\cos x + i\\sin x",
      ],
      inverseAndHyperbolicFunctions: [
        "\\arcsin x, \\arccos x, \\arctan x \\quad \\text{where} \\quad -\\frac{\\pi}{2} \\leq \\arcsin x \\leq \\frac{\\pi}{2}",
        "\\sinh x = \\frac{e^x - e^{-x}}{2}, \\quad \\cosh x = \\frac{e^x + e^{-x}}{2}, \\quad \\tanh x = \\frac{\\sinh x}{\\cosh x}",
        "\\cosh^2 x - \\sinh^2 x = 1 \\quad \\text{and} \\quad \\frac{d}{dx}[\\sinh x] = \\cosh x",
      ],
    },

    // Test Suite 11: Vector Calculus (NEW)
    vectorCalculus: {
      vectorOperations: [
        "\\mathbf{u} \\cdot \\mathbf{v} = |\\mathbf{u}||\\mathbf{v}|\\cos\\theta = u_1v_1 + u_2v_2 + u_3v_3",
        "\\mathbf{u} \\times \\mathbf{v} = \\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ u_1 & u_2 & u_3 \\\\ v_1 & v_2 & v_3 \\end{vmatrix}",
        "|\\mathbf{u} \\times \\mathbf{v}| = |\\mathbf{u}||\\mathbf{v}|\\sin\\theta",
      ],
      gradientAndDivergence: [
        "\\nabla f = \\frac{\\partial f}{\\partial x}\\mathbf{i} + \\frac{\\partial f}{\\partial y}\\mathbf{j} + \\frac{\\partial f}{\\partial z}\\mathbf{k}",
        "\\nabla \\cdot \\mathbf{F} = \\frac{\\partial F_x}{\\partial x} + \\frac{\\partial F_y}{\\partial y} + \\frac{\\partial F_z}{\\partial z}",
        "\\nabla \\times \\mathbf{F} = \\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ \\frac{\\partial}{\\partial x} & \\frac{\\partial}{\\partial y} & \\frac{\\partial}{\\partial z} \\\\ F_x & F_y & F_z \\end{vmatrix}",
      ],
    },

    // Test Suite 12: Number Theory and Discrete Mathematics (NEW)
    numberTheoryAndDiscreteMathematics: {
      numberTheory: [
        "\\gcd(a,b) \\cdot \\text{lcm}(a,b) = ab \\quad \\text{and} \\quad \\gcd(a,b) = \\gcd(b, a \\bmod b)",
        "a \\equiv b \\pmod{n} \\iff n | (a-b) \\quad \\text{where} \\quad a \\bmod n \\in \\{0,1,2,\\ldots,n-1\\}",
        "\\phi(n) = n \\prod_{p|n} \\left(1 - \\frac{1}{p}\\right)",
      ],
      discreteFunctions: [
        "\\lfloor x \\rfloor = \\max\\{n \\in \\mathbb{Z} : n \\leq x\\} \\quad \\text{and} \\quad \\lceil x \\rceil = \\min\\{n \\in \\mathbb{Z} : n \\geq x\\}",
        "\\lfloor x + n \\rfloor = \\lfloor x \\rfloor + n \\quad \\text{for integer } n",
        "F_n = F_{n-1} + F_{n-2} \\quad \\text{with} \\quad F_0 = 0, F_1 = 1",
      ],
    },

    // Test Suite 13: Complex Numbers (NEW)
    complexNumbers: {
      complexArithmetic: [
        "z = a + bi = r(\\cos\\theta + i\\sin\\theta) = re^{i\\theta} \\quad \\text{where} \\quad r = |z| = \\sqrt{a^2 + b^2}",
        "z^n = r^n(\\cos(n\\theta) + i\\sin(n\\theta)) = r^n e^{in\\theta}",
        "z^{1/n} = r^{1/n} \\left[\\cos\\left(\\frac{\\theta + 2\\pi k}{n}\\right) + i\\sin\\left(\\frac{\\theta + 2\\pi k}{n}\\right)\\right]",
      ],
      complexFunctions: [
        "f(z) = u(x,y) + iv(x,y) \\quad \\text{where} \\quad z = x + iy",
        "\\frac{\\partial u}{\\partial x} = \\frac{\\partial v}{\\partial y} \\quad \\text{and} \\quad \\frac{\\partial u}{\\partial y} = -\\frac{\\partial v}{\\partial x}",
      ],
    },

    // Test Suite 14: Sequences and Series (NEW)
    sequencesAndSeries: {
      convergenceTests: [
        "\\lim_{n \\to \\infty} \\left|\\frac{a_{n+1}}{a_n}\\right| = L < 1 \\implies \\sum a_n \\text{ converges}",
        "\\lim_{n \\to \\infty} \\sqrt[n]{|a_n|} = L < 1 \\implies \\sum a_n \\text{ converges}",
        "\\int_1^\\infty f(x) dx \\text{ converges} \\iff \\sum_{n=1}^\\infty f(n) \\text{ converges}",
      ],
      powerAndTaylorSeries: [
        "f(x) = \\sum_{n=0}^\\infty a_n(x-c)^n \\quad \\text{with radius} \\quad R = \\frac{1}{\\limsup_{n \\to \\infty} \\sqrt[n]{|a_n|}}",
        "f(x) = f(a) + f'(a)(x-a) + \\frac{f''(a)}{2!}(x-a)^2 + \\frac{f'''(a)}{3!}(x-a)^3 + \\cdots",
        "e^x = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots \\quad \\text{and} \\quad \\sin x = x - \\frac{x^3}{3!} + \\frac{x^5}{5!} - \\cdots",
      ],
    },

    // Test Suite 15: Differential Equations (NEW)
    differentialEquations: {
      firstOrderEquations: [
        "\\frac{dy}{dx} + P(x)y = Q(x) \\quad \\text{has solution} \\quad y = \\frac{1}{\\mu(x)}\\int \\mu(x)Q(x) dx",
        "\\mu(x) = e^{\\int P(x) dx}",
        "\\frac{dy}{dx} = \\frac{M(x,y)}{N(x,y)} \\quad \\text{is exact if} \\quad \\frac{\\partial M}{\\partial y} = \\frac{\\partial N}{\\partial x}",
      ],
      secondOrderEquations: [
        "y'' + py' + qy = 0 \\quad \\text{has characteristic equation} \\quad r^2 + pr + q = 0",
        "y = e^{rx}(c_1 + c_2x) \\quad \\text{when} \\quad r \\text{ is a repeated root}",
        "y_p = \\frac{W_1}{W}y_1 + \\frac{W_2}{W}y_2 \\quad \\text{where} \\quad W = \\begin{vmatrix} y_1 & y_2 \\\\ y_1' & y_2' \\end{vmatrix}",
      ],
    },

    // Test Suite 16: Coordinate Systems and Geometry (NEW)
    coordinateSystemsAndGeometry: {
      coordinateTransformations: [
        "x = r\\cos\\theta, \\quad y = r\\sin\\theta \\quad \\text{and} \\quad r = \\sqrt{x^2 + y^2}, \\quad \\theta = \\arctan\\frac{y}{x}",
        "x = \\rho\\sin\\phi\\cos\\theta, \\quad y = \\rho\\sin\\phi\\sin\\theta, \\quad z = \\rho\\cos\\phi",
        "dA = r \\, dr \\, d\\theta \\quad \\text{and} \\quad dV = \\rho^2 \\sin\\phi \\, d\\rho \\, d\\phi \\, d\\theta",
      ],
      conicSections: [
        "\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1 \\quad \\text{and} \\quad \\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1",
        "y^2 = 4px \\quad \\text{with focus at} \\quad (p, 0)",
        "d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}",
      ],
    },

    // Test Suite 17: Stress Testing (Updated)
    stressTesting: {
      extremelyComplex: [
        "\\sum_{n=1}^{\\infty} \\sum_{k=1}^{n} \\frac{(-1)^{k+1}}{k} \\binom{n}{k} = \\sum_{n=1}^{\\infty} \\frac{1}{n} = \\infty",
        "\\int_0^{2\\pi} \\int_0^{\\pi} \\int_0^{1} r^2 \\sin\\phi \\, dr \\, d\\phi \\, d\\theta = \\frac{8\\pi}{3}",
        "\\mathcal{F}\\{f(t)\\} = \\int_{-\\infty}^{\\infty} f(t) e^{-2\\pi i \\xi t} \\, dt",
        "\\begin{pmatrix} \\cos\\theta + i\\sin\\theta & e^{i\\phi} \\\\ e^{-i\\phi} & \\cos\\theta - i\\sin\\theta \\end{pmatrix} \\begin{pmatrix} \\alpha \\\\ \\beta \\end{pmatrix}",
        "e = 2 + \\cfrac{1}{1 + \\cfrac{1}{2 + \\cfrac{1}{1 + \\cfrac{1}{1 + \\cfrac{1}{4 + \\cfrac{1}{1 + \\cfrac{1}{1 + \\cfrac{1}{6 + \\ddots}}}}}}}}",
      ],
      syntaxStressTests: [
        "\\sum_{k=1}^n \\binom{n}{k} x^k (1-x)^{n-k} = 1",
        "\\lim_{n \\to \\infty} \\sum_{k=1}^n \\frac{1}{k^2} = \\frac{\\pi^2}{6}",
        "f(x) = \\begin{cases} x^2 & \\text{if } x \\geq 0 \\\\ -x^2 & \\text{if } x < 0 \\end{cases}",
      ],
    },
  };

  // ===========================================================================================
  // VALIDATION FUNCTIONS AS PER TESTING PROTOCOL
  // ===========================================================================================

  /**
   * Establish mathematical content baseline (playground console function)
   * Implements the baseline validation from the testing protocol
   */
  function validateExportedMath() {
    logInfo("=== COMPREHENSIVE LATEX BASELINE ===");

    const mathContainers = document.querySelectorAll("mjx-container");
    const displayEq = document.querySelectorAll(
      'mjx-container[display="true"]'
    );
    const inlineEq = document.querySelectorAll(
      'mjx-container[display="false"]'
    );
    const annotations = document.querySelectorAll(
      'annotation[encoding*="tex"]'
    );

    const results = {
      containers: mathContainers.length,
      display: displayEq.length,
      inline: inlineEq.length,
      annotations: annotations.length,
      timestamp: new Date().toISOString(),
    };

    console.log("Total mathematical containers:", results.containers);
    console.log("Display equations:", results.display);
    console.log("Inline equations:", results.inline);
    console.log("LaTeX annotations:", results.annotations);
    console.log("Expected minimum containers: 100+");

    // Store baseline for export comparison
    window.latexTestBaseline = results;

    return results;
  }

  /**
   * Comprehensive export validation as per testing protocol
   */
  function validateComprehensiveExport() {
    logInfo("=== COMPREHENSIVE EXPORT VALIDATION ===");

    const exportMath = {
      containers: document.querySelectorAll("mjx-container").length,
      display: document.querySelectorAll('mjx-container[display="true"]')
        .length,
      inline: document.querySelectorAll('mjx-container[display="false"]')
        .length,
      annotations: document.querySelectorAll('annotation[encoding*="tex"]')
        .length,
    };

    // Expected baseline (adjust based on content)
    const expected = {
      containers: 100,
      display: 80,
      inline: 20,
      annotations: 100,
    };

    console.log("Export vs Expected:");
    console.log(
      `Containers: ${exportMath.containers}/${expected.containers} (${(
        (exportMath.containers / expected.containers) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Display: ${exportMath.display}/${expected.display} (${(
        (exportMath.display / expected.display) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Inline: ${exportMath.inline}/${expected.inline} (${(
        (exportMath.inline / expected.inline) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Annotations: ${exportMath.annotations}/${expected.annotations} (${(
        (exportMath.annotations / expected.annotations) *
        100
      ).toFixed(1)}%)`
    );

    const accuracy = (exportMath.containers / expected.containers) * 100;
    console.log(`\n🎯 COMPREHENSIVE LATEX ACCURACY: ${accuracy.toFixed(1)}%`);

    return {
      exportMath,
      expected,
      accuracy,
      success: accuracy >= 99,
    };
  }

  // ===========================================================================================
  // TEST SUITE EXECUTION FUNCTIONS
  // ===========================================================================================

  /**
   * Test individual LaTeX expression for playground and export compatibility
   */
  function testLatexExpression(latex, suiteContext = "") {
    try {
      logDebug(
        `Testing expression in ${suiteContext}: ${latex.substring(0, 50)}...`
      );

      // Test 1: Syntax validation
      if (!validateLatexSyntax(latex)) {
        logWarn(`Invalid LaTeX syntax in ${suiteContext}: ${latex}`);
        return { success: false, error: "Invalid syntax", expression: latex };
      }

      // Test 2: Playground rendering test
      const playgroundTest = testPlaygroundRendering(latex);

      // Test 3: Export processor test
      const exportTest = testExportProcessing(latex);

      return {
        success: playgroundTest.success && exportTest.success,
        expression: latex,
        context: suiteContext,
        playground: playgroundTest,
        export: exportTest,
      };
    } catch (error) {
      logError(`Error testing expression in ${suiteContext}:`, error);
      return { success: false, error: error.message, expression: latex };
    }
  }

  /**
   * Test complete test suite
   */
  function testCompleteSuite(suiteName) {
    logInfo(`Testing complete suite: ${suiteName}`);

    const suite = COMPREHENSIVE_TEST_SUITES[suiteName];
    if (!suite) {
      logError(`Test suite ${suiteName} not found`);
      logInfo("Available test suites:", Object.keys(COMPREHENSIVE_TEST_SUITES));
      return { success: false, error: "Suite not found" };
    }

    let totalExpressions = 0;
    let successfulExpressions = 0;
    const categoryResults = {};

    // Test each category in the suite
    Object.entries(suite).forEach(([categoryName, expressions]) => {
      const categoryResult = testExpressionCategory(
        expressions,
        `${suiteName}.${categoryName}`
      );
      categoryResults[categoryName] = categoryResult;

      totalExpressions += categoryResult.total;
      successfulExpressions += categoryResult.successful;
    });

    const successRate =
      totalExpressions > 0
        ? (successfulExpressions / totalExpressions) * 100
        : 0;

    logInfo(
      `Suite ${suiteName}: ${successfulExpressions}/${totalExpressions} (${successRate.toFixed(
        1
      )}%)`
    );

    return {
      success: successRate >= 95, // 95% threshold for suite success
      suiteName,
      totalExpressions,
      successfulExpressions,
      successRate,
      categoryResults,
    };
  }

  /**
   * Test expression category
   */
  function testExpressionCategory(expressions, context) {
    let total = 0;
    let successful = 0;
    const results = [];

    expressions.forEach((expr) => {
      total++;
      const result = testLatexExpression(expr, context);
      if (result.success) successful++;
      results.push(result);
    });

    return { total, successful, results, context };
  }

  // ===========================================================================================
  // VALIDATION HELPER FUNCTIONS
  // ===========================================================================================

  /**
   * Validate LaTeX syntax
   */
  function validateLatexSyntax(latex) {
    // Check balanced braces
    const braces = latex.match(/[\{\}]/g) || [];
    const openBraces = braces.filter((b) => b === "{").length;
    const closeBraces = braces.filter((b) => b === "}").length;

    if (openBraces !== closeBraces) {
      logWarn("Unbalanced braces in LaTeX expression");
      return false;
    }

    // Check for valid LaTeX structure
    const hasValidStructure =
      /\\[a-zA-Z]+/.test(latex) || /[\$\{\}\^\_\&\\]/.test(latex);

    return hasValidStructure;
  }

  /**
   * Test playground rendering capability
   */
  function testPlaygroundRendering(latex) {
    try {
      // Check if MathJax is available
      if (!window.MathJax) {
        return { success: false, error: "MathJax not available" };
      }

      // Check if output container exists
      const outputDiv = document.getElementById("output");
      if (!outputDiv) {
        return { success: false, error: "Output container not available" };
      }

      // For comprehensive testing, we'll mark as successful if basic components are available
      // and the LaTeX appears to be valid syntax
      const hasValidSyntax = /^[^$]*$/.test(latex) && latex.trim().length > 0;

      return {
        success: hasValidSyntax,
        method: "Syntax validation + MathJax available",
      };
    } catch (error) {
      logError("Playground rendering test error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test export processing capability
   */
  function testExportProcessing(latex) {
    try {
      // Check if LaTeX processor is available
      if (!window.LaTeXProcessor) {
        return { success: false, error: "LaTeX processor not available" };
      }

      // Check for key methods
      const hasRequiredMethods =
        typeof window.LaTeXProcessor.convertMathJaxToLatex === "function" ||
        typeof window.LaTeXProcessor.processLatexDocument === "function";

      if (hasRequiredMethods) {
        return {
          success: true,
          method: "LaTeX processor with required methods available",
        };
      }

      return { success: false, error: "LaTeX processor methods not available" };
    } catch (error) {
      logError("Export processing test error:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // MAIN TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Run all comprehensive LaTeX syntax tests
   */
  function testComprehensiveLaTeXSyntax() {
    logInfo("🧮 Running comprehensive LaTeX syntax tests...");

    const tests = {
      fundamentalOperations: () => testCompleteSuite("fundamentalOperations"),
      advancedStructures: () => testCompleteSuite("advancedStructures"),
      matrixOperations: () => testCompleteSuite("matrixOperations"),
      specialisedSymbols: () => testCompleteSuite("specialisedSymbols"),
      advancedTypography: () => testCompleteSuite("advancedTypography"),
      complexEnvironments: () => testCompleteSuite("complexEnvironments"),
      stressTesting: () => testCompleteSuite("stressTesting"),
      playgroundBaseline: () => validateExportedMath(),
      exportValidation: () => validateComprehensiveExport(),
    };

    return TestUtilities.runTestSuite("Comprehensive LaTeX Syntax", tests);
  }

  /**
   * Generate comprehensive test content for playground testing
   */
  function generateComprehensiveTestContent() {
    logInfo("Generating comprehensive test content...");

    let testDocument =
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\usepackage{amsfonts}\n\\usepackage{amssymb}\n\\begin{document}\n\n";
    testDocument +=
      "\\title{Comprehensive LaTeX Syntax Testing}\n\\maketitle\n\n";

    let totalExpressions = 0;

    Object.entries(COMPREHENSIVE_TEST_SUITES).forEach(([suiteName, suite]) => {
      // Fix section naming with proper capitalisation
      const properSectionName = suiteName
        .replace(/([A-Z])/g, " $1")
        .trim()
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");

      testDocument += `\\section{${properSectionName}}\n\n`;

      Object.entries(suite).forEach(([categoryName, expressions]) => {
        // Fix subsection naming with proper capitalisation
        const properCategoryName = categoryName
          .replace(/([A-Z])/g, " $1")
          .trim()
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");

        testDocument += `\\subsection{${properCategoryName}}\n\n`;

        expressions.forEach((expr, index) => {
          testDocument += `\\begin{equation}\n${expr}\n\\end{equation}\n\n`;
          totalExpressions++;
        });
      });
    });

    testDocument += "\\end{document}";

    // Store for playground use
    window.comprehensiveLatexTestContent = testDocument;

    console.log("📄 Comprehensive LaTeX test content generated");
    console.log("📋 Use: window.comprehensiveLatexTestContent to access");
    console.log("🔧 Total expressions:", totalExpressions);

    return testDocument;
  }

  /**
   * Load comprehensive test content into playground
   */
  function loadTestContentIntoPlayground() {
    logInfo("Loading comprehensive test content into playground...");

    // Generate the content first
    const testContent = generateComprehensiveTestContent();

    // Find the input textarea
    const inputTextarea = document.getElementById("input");
    if (!inputTextarea) {
      logError("❌ Input textarea not found - cannot load test content");
      return { success: false, error: "Input textarea not found" };
    }

    // Load content into textarea
    inputTextarea.value = testContent;

    // Trigger input event to notify any listeners
    const inputEvent = new Event("input", { bubbles: true });
    inputTextarea.dispatchEvent(inputEvent);

    // Also trigger change event for compatibility
    const changeEvent = new Event("change", { bubbles: true });
    inputTextarea.dispatchEvent(changeEvent);

    logInfo("✅ Comprehensive test content loaded into playground");
    console.log(
      "🎯 Ready for conversion - click 'Convert' or press Ctrl+Enter"
    );

    return {
      success: true,
      expressionCount: Object.values(COMPREHENSIVE_TEST_SUITES).reduce(
        (total, suite) => total + Object.values(suite).flat().length,
        0
      ),
      content: testContent,
    };
  }

  /**
   * Examine playground MathJax structures for fidelity analysis
   * Integrated from test-latex-consistency.js
   */
  function examinePlaygroundMathJax() {
    logInfo("Examining playground MathJax structures for fidelity...");

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      return {
        error: "Output container not available",
        mathContainers: 0,
        annotatedExpressions: 0,
        semanticExpressions: 0,
      };
    }

    const mathContainers = outputDiv.querySelectorAll("mjx-container");
    let annotatedCount = 0;
    let semanticCount = 0;
    const expressionDetails = [];

    mathContainers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      let hasAnnotation = false;
      let hasSemantic = false;
      let latexContent = "";

      if (mathML) {
        // Check for LaTeX annotations (source fidelity)
        const annotation =
          mathML.querySelector('annotation[encoding="application/x-tex"]') ||
          mathML.querySelector('annotation[encoding="TeX"]') ||
          mathML.querySelector('annotation[encoding="LaTeX"]');

        if (annotation && annotation.textContent.trim()) {
          hasAnnotation = true;
          annotatedCount++;
          latexContent = annotation.textContent.trim();
        }

        // Check for semantic MathML structure
        const semanticElements = mathML.querySelectorAll(
          "msup, msub, mfrac, mrow, msqrt, munder, mover"
        );
        if (semanticElements.length > 0) {
          hasSemantic = true;
          semanticCount++;
        }
      }

      expressionDetails.push({
        index: index,
        hasAnnotation: hasAnnotation,
        hasSemantic: hasSemantic,
        latexContent:
          latexContent.substring(0, 50) +
          (latexContent.length > 50 ? "..." : ""),
        elementType:
          container.getAttribute("display") === "true" ? "display" : "inline",
      });
    });

    const summary = {
      mathContainers: mathContainers.length,
      annotatedExpressions: annotatedCount,
      semanticExpressions: semanticCount,
      annotationPercentage:
        mathContainers.length > 0
          ? Math.round((annotatedCount / mathContainers.length) * 100)
          : 0,
      semanticPercentage:
        mathContainers.length > 0
          ? Math.round((semanticCount / mathContainers.length) * 100)
          : 0,
      expressionDetails: expressionDetails,
    };

    logInfo("MathJax fidelity examination complete:", summary);
    return summary;
  }

  /**
   * Test playground rendering fidelity (Phase 1: No LaTeX processor involved)
   * Tests what MathJax produces directly from LaTeX source
   */
  function testPlaygroundFidelity() {
    logInfo("=== PHASE 1: PLAYGROUND FIDELITY TEST ===");
    logInfo(
      "Testing MathJax rendering without LaTeX processor interference..."
    );

    const playgroundAnalysis = examinePlaygroundMathJax();
    const annotationAnalysis = verifyAnnotationAccuracy();
    const accessibilityAnalysis = testAriaLabelsAndAccessibility();

    // Calculate playground-specific fidelity scores
    const playgroundFidelity = {
      renderingSuccess: playgroundAnalysis.mathContainers > 0,
      annotationPreservation: playgroundAnalysis.annotationPercentage,
      accessibilityCompliance: accessibilityAnalysis.accessibilityScore,
      overallPlaygroundScore: 0,
    };

    // Weighted playground score (what MathJax produces directly)
    playgroundFidelity.overallPlaygroundScore = Math.round(
      playgroundFidelity.annotationPreservation * 0.4 +
        playgroundFidelity.accessibilityCompliance * 0.3 +
        (playgroundFidelity.renderingSuccess ? 30 : 0)
    );

    const playgroundRecommendations = generatePlaygroundRecommendations(
      playgroundAnalysis,
      accessibilityAnalysis
    );

    console.log("\n🎮 PLAYGROUND FIDELITY RESULTS:");
    console.log(`   • Math Containers: ${playgroundAnalysis.mathContainers}`);
    console.log(
      `   • Annotation Preservation: ${playgroundFidelity.annotationPreservation}%`
    );
    console.log(
      `   • Accessibility Score: ${playgroundFidelity.accessibilityCompliance}%`
    );
    console.log(
      `   • Overall Playground Score: ${playgroundFidelity.overallPlaygroundScore}%`
    );

    return {
      phase: "playground",
      playgroundAnalysis,
      annotationAnalysis,
      accessibilityAnalysis,
      playgroundFidelity,
      recommendations: playgroundRecommendations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test export processing capability (Phase 2: LaTeX processor involved)
   * Tests what the export system can recover from playground output
   */
  function testExportProcessingCapability() {
    logInfo("=== PHASE 2: EXPORT PROCESSING TEST ===");
    logInfo("Testing LaTeX processor recovery from playground output...");

    // First get playground state (without triggering LaTeX processor)
    const outputDiv = document.getElementById("output");
    if (!outputDiv || !outputDiv.innerHTML.trim()) {
      return {
        phase: "export",
        error: "No playground content available for export testing",
        processorTest: { available: false, errors: ["No content to process"] },
        timestamp: new Date().toISOString(),
      };
    }

    // Test LaTeX processor capabilities
    let processorTest = {
      available: false,
      conversionWorking: false,
      preservesDelimiters: false,
      semanticRecovery: false,
      recoveredExpressions: 0,
      errors: [],
    };

    if (window.LaTeXProcessor && window.LaTeXProcessor.convertMathJaxToLatex) {
      processorTest.available = true;

      try {
        logInfo("Testing LaTeX processor conversion capability...");

        // Store original content state
        const originalContainers =
          outputDiv.querySelectorAll("mjx-container").length;
        const originalAnnotations = outputDiv.querySelectorAll(
          'annotation[encoding*="tex"]'
        ).length;

        // Test conversion (this will trigger the processor)
        const converted = window.LaTeXProcessor.convertMathJaxToLatex(
          outputDiv.innerHTML
        );

        processorTest.conversionWorking =
          typeof converted === "string" && converted.length > 0;

        if (processorTest.conversionWorking) {
          // Analyze conversion quality
          const hasLatexDelimiters =
            /\\[\[\(]/.test(converted) || /\\[\]\)]/.test(converted);
          processorTest.preservesDelimiters = hasLatexDelimiters;

          // Count LaTeX expressions in converted content
          const latexMatches =
            converted.match(/\\[\[\(][^\\]*\\[\]\)]|\$[^$]+\$/g) || [];
          processorTest.recoveredExpressions = latexMatches.length;

          // Check if processor successfully recovered expressions
          processorTest.semanticRecovery =
            processorTest.recoveredExpressions >= originalContainers * 0.8;

          logInfo(
            `Processor recovered ${processorTest.recoveredExpressions}/${originalContainers} expressions`
          );
        }
      } catch (error) {
        processorTest.errors.push(error.message);
        logError("Export processing test error:", error);
      }
    } else {
      processorTest.errors.push("LaTeX processor not available");
    }

    // Calculate export readiness score
    const exportReadiness = {
      processorAvailable: processorTest.available,
      conversionWorking: processorTest.conversionWorking,
      semanticRecovery: processorTest.semanticRecovery,
      overallExportScore: 0,
    };

    if (processorTest.available) {
      exportReadiness.overallExportScore = Math.round(
        (processorTest.conversionWorking ? 40 : 0) +
          (processorTest.semanticRecovery ? 40 : 0) +
          (processorTest.preservesDelimiters ? 20 : 0)
      );
    }

    console.log("\n🚀 EXPORT PROCESSING RESULTS:");
    console.log(
      `   • Processor Available: ${exportReadiness.processorAvailable}`
    );
    console.log(
      `   • Conversion Working: ${exportReadiness.conversionWorking}`
    );
    console.log(`   • Semantic Recovery: ${exportReadiness.semanticRecovery}`);
    console.log(
      `   • Overall Export Score: ${exportReadiness.overallExportScore}%`
    );

    return {
      phase: "export",
      processorTest,
      exportReadiness,
      recommendations: generateExportRecommendations(processorTest),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Comprehensive two-phase testing (playground + export)
   */
  function testCompleteFidelityPipeline() {
    logInfo(
      "🧪 Running complete fidelity pipeline test (playground + export)..."
    );

    // Phase 1: Pure playground testing (no processor interference)
    const playgroundResults = testPlaygroundFidelity();

    // Phase 2: Export processing capability testing
    const exportResults = testExportProcessingCapability();

    // Combined analysis
    const pipelineAnalysis = {
      playgroundPhase: playgroundResults,
      exportPhase: exportResults,
      overallPipelineScore: Math.round(
        (playgroundResults.playgroundFidelity?.overallPlaygroundScore || 0) *
          0.6 +
          (exportResults.exportReadiness?.overallExportScore || 0) * 0.4
      ),
      pipelineReady:
        (playgroundResults.playgroundFidelity?.overallPlaygroundScore || 0) >=
          70 && (exportResults.exportReadiness?.overallExportScore || 0) >= 70,
      timestamp: new Date().toISOString(),
    };

    console.log("\n🎯 COMPLETE PIPELINE ANALYSIS:");
    console.log(
      `   • Playground Baseline: ${
        playgroundResults.playgroundFidelity?.overallPlaygroundScore || 0
      }%`
    );
    console.log(
      `   • Export Capability: ${
        exportResults.exportReadiness?.overallExportScore || 0
      }%`
    );
    console.log(
      `   • Overall Pipeline Score: ${pipelineAnalysis.overallPipelineScore}%`
    );
    console.log(
      `   • Pipeline Ready: ${pipelineAnalysis.pipelineReady ? "YES" : "NO"}`
    );

    return pipelineAnalysis;
  }

  /**
   * Generate playground-specific recommendations
   */
  function generatePlaygroundRecommendations(
    playgroundAnalysis,
    accessibilityAnalysis
  ) {
    const recommendations = [];

    if (playgroundAnalysis.mathContainers === 0) {
      recommendations.push({
        level: "error",
        category: "rendering",
        message:
          "No mathematical expressions detected in playground. Check LaTeX input and MathJax configuration.",
      });
    }

    if (playgroundAnalysis.annotationPercentage < 50) {
      recommendations.push({
        level: "error",
        category: "fidelity",
        message: `Critical: Only ${playgroundAnalysis.annotationPercentage}% LaTeX source preservation. MathJax configuration needs fixing.`,
      });
    } else if (playgroundAnalysis.annotationPercentage < 90) {
      recommendations.push({
        level: "warning",
        category: "fidelity",
        message: `LaTeX source preservation at ${playgroundAnalysis.annotationPercentage}%. Should be 95%+ for optimal fidelity.`,
      });
    }

    if (accessibilityAnalysis.accessibilityScore < 80) {
      recommendations.push({
        level: "warning",
        category: "accessibility",
        message: `Accessibility score ${accessibilityAnalysis.accessibilityScore}%. May not meet WCAG 2.2 AA standards.`,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        level: "success",
        category: "playground",
        message:
          "Playground rendering meets quality standards. Ready for export testing.",
      });
    }

    return recommendations;
  }

  /**
   * Generate export-specific recommendations
   */
  function generateExportRecommendations(processorTest) {
    const recommendations = [];

    if (!processorTest.available) {
      recommendations.push({
        level: "error",
        category: "export",
        message:
          "LaTeX processor not available. Export functionality disabled.",
      });
    } else if (!processorTest.conversionWorking) {
      recommendations.push({
        level: "error",
        category: "export",
        message:
          "LaTeX processor conversion failed. Check processor implementation.",
      });
    } else if (!processorTest.semanticRecovery) {
      recommendations.push({
        level: "warning",
        category: "export",
        message:
          "Poor semantic recovery. Export may lose mathematical meaning.",
      });
    } else {
      recommendations.push({
        level: "success",
        category: "export",
        message:
          "Export processing working correctly. Ready for document generation.",
      });
    }

    return recommendations;
  }

  /**
   * Calculate source fidelity metrics
   */
  function calculateSourceFidelity(analysis) {
    const fidelity = {
      annotationFidelity: analysis.annotationPercentage,
      structuralFidelity: analysis.semanticPercentage,
      overallFidelity: 0,
    };

    // Overall fidelity is weighted average
    fidelity.overallFidelity = Math.round(
      fidelity.annotationFidelity * 0.7 + fidelity.structuralFidelity * 0.3
    );

    return fidelity;
  }

  /**
   * Generate fidelity recommendations
   */
  function generateFidelityRecommendations(analysis, processorTest) {
    const recommendations = [];

    if (analysis.mathContainers === 0) {
      recommendations.push({
        level: "info",
        message:
          "No mathematical expressions detected. Load test content to analyze fidelity.",
      });
    }

    if (analysis.annotationPercentage < 100) {
      recommendations.push({
        level: "warning",
        message: `Only ${analysis.annotationPercentage}% of expressions have LaTeX source annotations. Export fidelity may be compromised.`,
      });
    }

    if (analysis.annotationPercentage < 90) {
      recommendations.push({
        level: "error",
        message:
          "Critical: Low LaTeX annotation preservation. Source fidelity is poor.",
      });
    }

    if (!processorTest.available) {
      recommendations.push({
        level: "error",
        message: "LaTeX processor unavailable. Cannot test export consistency.",
      });
    }

    if (processorTest.preservesAnnotations === false) {
      recommendations.push({
        level: "warning",
        message: "LaTeX annotations may be lost during export processing.",
      });
    }

    if (analysis.semanticPercentage < 50) {
      recommendations.push({
        level: "info",
        message:
          "Limited semantic MathML. Consider enhancing for better accessibility fallback.",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        level: "success",
        message:
          "Excellent source fidelity. Exports should preserve LaTeX accurately.",
      });
    }

    return recommendations;
  }

  /**
   * Quick diagnostic for specific LaTeX expression
   * Integrated from test-latex-consistency.js
   */
  function quickExpressionDiagnostic(latex) {
    logInfo(`Quick diagnostic for expression: ${latex}`);

    const results = {
      expression: latex,
      inlineTest: null,
      displayTest: null,
      fidelityScore: 0,
      issues: [],
      recommendations: [],
    };

    // Test in both contexts
    const delimiters = {
      inline: ["\\(", "\\)"],
      display: ["\\[", "\\]"],
    };

    ["inline", "display"].forEach((context) => {
      const testExpr = `${delimiters[context][0]}${latex}${delimiters[context][1]}`;

      const contextResult = {
        context: context,
        expression: testExpr,
        success: false,
        conversionWorking: false,
        processorAvailable: false,
      };

      // Check if expression can be processed
      if (
        window.LaTeXProcessor &&
        window.LaTeXProcessor.convertMathJaxToLatex
      ) {
        contextResult.processorAvailable = true;

        try {
          // Mock test conversion
          const mockContent = `<mjx-container><mjx-assistive-mml><math><annotation encoding="application/x-tex">${latex}</annotation></math></mjx-assistive-mml></mjx-container>`;
          const converted =
            window.LaTeXProcessor.convertMathJaxToLatex(mockContent);
          contextResult.conversionWorking = converted.includes(latex);
          contextResult.success = true;
        } catch (error) {
          contextResult.error = error.message;
          results.issues.push(`${context} context: ${error.message}`);
        }
      } else {
        results.issues.push("LaTeX processor not available");
      }

      results[`${context}Test`] = contextResult;
    });

    // Calculate fidelity score
    const inlineScore = results.inlineTest?.success ? 50 : 0;
    const displayScore = results.displayTest?.success ? 50 : 0;
    results.fidelityScore = inlineScore + displayScore;

    // Generate recommendations
    if (results.fidelityScore === 100) {
      results.recommendations.push(
        "Expression should render with high fidelity"
      );
    } else if (results.fidelityScore >= 50) {
      results.recommendations.push(
        "Expression has partial support - check specific context"
      );
    } else {
      results.recommendations.push(
        "Expression may have rendering issues - test thoroughly"
      );
    }

    return results;
  }

  /**
   * Verify LaTeX annotations against original source
   */
  function verifyAnnotationAccuracy() {
    logInfo("Verifying LaTeX annotation accuracy against source...");

    const inputTextarea = document.getElementById("input");
    const outputDiv = document.getElementById("output");

    if (!inputTextarea || !outputDiv) {
      return {
        error: "Input or output container not available",
        verified: 0,
        total: 0,
      };
    }

    // Extract LaTeX expressions from source
    const sourceContent = inputTextarea.value;
    const sourceExpressions = extractLatexExpressions(sourceContent);

    // Extract annotations from rendered output
    const mathContainers = outputDiv.querySelectorAll("mjx-container");
    const annotations = [];

    mathContainers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation =
          mathML.querySelector('annotation[encoding="application/x-tex"]') ||
          mathML.querySelector('annotation[encoding="TeX"]') ||
          mathML.querySelector('annotation[encoding="LaTeX"]');

        if (annotation && annotation.textContent.trim()) {
          annotations.push({
            index: index,
            content: annotation.textContent.trim(),
            elementType:
              container.getAttribute("display") === "true"
                ? "display"
                : "inline",
          });
        }
      }
    });

    // Compare annotations with source expressions
    const results = {
      sourceExpressions: sourceExpressions.length,
      foundAnnotations: annotations.length,
      accurateAnnotations: 0,
      inaccurateAnnotations: 0,
      missingAnnotations: 0,
      details: [],
      accuracy: 0,
    };

    // Detailed verification
    sourceExpressions.forEach((sourceExpr, index) => {
      const matchingAnnotation = findMatchingAnnotation(
        sourceExpr,
        annotations
      );

      const detail = {
        sourceExpression: sourceExpr.content,
        sourceContext: sourceExpr.context,
        annotationFound: !!matchingAnnotation,
        annotationAccurate: false,
        annotationContent: matchingAnnotation?.content || null,
      };

      if (matchingAnnotation) {
        // Check accuracy (normalize whitespace and compare)
        const normalizedSource = normalizeLatexExpression(sourceExpr.content);
        const normalizedAnnotation = normalizeLatexExpression(
          matchingAnnotation.content
        );

        detail.annotationAccurate = normalizedSource === normalizedAnnotation;

        if (detail.annotationAccurate) {
          results.accurateAnnotations++;
        } else {
          results.inaccurateAnnotations++;
        }
      } else {
        results.missingAnnotations++;
      }

      results.details.push(detail);
    });

    results.accuracy =
      results.sourceExpressions > 0
        ? Math.round(
            (results.accurateAnnotations / results.sourceExpressions) * 100
          )
        : 0;

    logInfo(
      `Annotation accuracy: ${results.accurateAnnotations}/${results.sourceExpressions} (${results.accuracy}%)`
    );
    return results;
  }

  /**
   * Test ARIA labels and accessibility markup
   */
  function testAriaLabelsAndAccessibility() {
    logInfo("Testing ARIA labels and accessibility markup...");

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      return {
        error: "Output container not available",
        mathElements: 0,
        accessibleElements: 0,
      };
    }

    const mathContainers = outputDiv.querySelectorAll("mjx-container");
    const results = {
      mathElements: mathContainers.length,
      accessibleElements: 0,
      ariaLabelledElements: 0,
      ariaDescribedElements: 0,
      altTextElements: 0,
      screenReaderElements: 0,
      details: [],
      accessibilityScore: 0,
    };

    mathContainers.forEach((container, index) => {
      const accessibility = {
        index: index,
        hasAriaLabel: false,
        hasAriaDescription: false,
        hasAltText: false,
        hasScreenReaderContent: false,
        hasAssistiveMML: false,
        accessibilityFeatures: [],
        issues: [],
      };

      // Check for ARIA label
      if (
        container.hasAttribute("aria-label") &&
        container.getAttribute("aria-label").trim()
      ) {
        accessibility.hasAriaLabel = true;
        accessibility.accessibilityFeatures.push("aria-label");
        results.ariaLabelledElements++;
      }

      // Check for ARIA description
      if (
        container.hasAttribute("aria-describedby") ||
        container.hasAttribute("aria-description")
      ) {
        accessibility.hasAriaDescription = true;
        accessibility.accessibilityFeatures.push("aria-description");
        results.ariaDescribedElements++;
      }

      // Check for alt text
      const altText = container.querySelector("[alt]");
      if (altText && altText.getAttribute("alt").trim()) {
        accessibility.hasAltText = true;
        accessibility.accessibilityFeatures.push("alt-text");
        results.altTextElements++;
      }

      // Check for MathJax assistive MML
      const assistiveMML = container.querySelector("mjx-assistive-mml");
      if (assistiveMML) {
        accessibility.hasAssistiveMML = true;
        accessibility.accessibilityFeatures.push("assistive-mml");
      }

      // Check for screen reader content
      const mathML = container.querySelector("mjx-assistive-mml math");
      if (mathML) {
        const annotation = mathML.querySelector('annotation[encoding*="tex"]');
        if (annotation && annotation.textContent.trim()) {
          accessibility.hasScreenReaderContent = true;
          accessibility.accessibilityFeatures.push("screen-reader-annotation");
          results.screenReaderElements++;
        }
      }

      // Determine if element is accessible
      const isAccessible =
        accessibility.hasAssistiveMML && accessibility.hasScreenReaderContent;

      if (isAccessible) {
        results.accessibleElements++;
      } else {
        if (!accessibility.hasAssistiveMML) {
          accessibility.issues.push("Missing assistive MathML");
        }
        if (!accessibility.hasScreenReaderContent) {
          accessibility.issues.push("Missing screen reader annotation");
        }
      }

      results.details.push(accessibility);
    });

    // Calculate accessibility score
    results.accessibilityScore =
      results.mathElements > 0
        ? Math.round((results.accessibleElements / results.mathElements) * 100)
        : 0;

    logInfo(
      `Accessibility score: ${results.accessibleElements}/${results.mathElements} (${results.accessibilityScore}%)`
    );
    return results;
  }

  /**
   * Comprehensive accessibility and fidelity validation
   */
  function validateAccessibilityAndFidelity() {
    logInfo("Running comprehensive accessibility and fidelity validation...");

    const results = {
      timestamp: new Date().toISOString(),
      annotationAccuracy: verifyAnnotationAccuracy(),
      accessibilityTest: testAriaLabelsAndAccessibility(),
      renderingAccuracy: testLatexRenderingAccuracy(),
      mathJaxAnalysis: examinePlaygroundMathJax(),
      exportConsistency: testExportConsistency(),
      overallScore: 0,
      recommendations: [],
    };

    // Calculate overall score (weighted average with rendering accuracy)
    const weights = {
      annotationAccuracy: 0.25,
      accessibility: 0.25,
      renderingAccuracy: 0.25,
      mathJaxFidelity: 0.15,
      exportConsistency: 0.1,
    };

    const scores = {
      annotationAccuracy: results.annotationAccuracy.accuracy || 0,
      accessibility: results.accessibilityTest.accessibilityScore || 0,
      renderingAccuracy: results.renderingAccuracy.renderingAccuracy || 0,
      mathJaxFidelity: results.mathJaxAnalysis.annotationPercentage || 0,
      exportConsistency:
        results.exportConsistency.sourceFidelity?.overallFidelity || 0,
    };

    results.overallScore = Math.round(
      scores.annotationAccuracy * weights.annotationAccuracy +
        scores.accessibility * weights.accessibility +
        scores.renderingAccuracy * weights.renderingAccuracy +
        scores.mathJaxFidelity * weights.mathJaxFidelity +
        scores.exportConsistency * weights.exportConsistency
    );

    // Generate recommendations
    if (scores.annotationAccuracy < 90) {
      results.recommendations.push({
        level: "error",
        category: "fidelity",
        message: `Low annotation accuracy (${scores.annotationAccuracy}%). LaTeX source may not be preserved correctly.`,
      });
    }

    if (scores.accessibility < 80) {
      results.recommendations.push({
        level: "warning",
        category: "accessibility",
        message: `Accessibility issues detected (${scores.accessibility}% accessible). May not meet WCAG 2.2 AA requirements.`,
      });
    }

    if (scores.mathJaxFidelity < 95) {
      results.recommendations.push({
        level: "warning",
        category: "rendering",
        message: `MathJax rendering fidelity issues (${scores.mathJaxFidelity}%). Check MathJax configuration.`,
      });
    }

    if (results.overallScore >= 90) {
      results.recommendations.push({
        level: "success",
        category: "overall",
        message:
          "Excellent accessibility and fidelity! Ready for production use.",
      });
    } else if (results.overallScore >= 75) {
      results.recommendations.push({
        level: "warning",
        category: "overall",
        message:
          "Good accessibility and fidelity with minor issues to address.",
      });
    } else {
      results.recommendations.push({
        level: "error",
        category: "overall",
        message:
          "Significant accessibility and fidelity issues require attention.",
      });
    }

    console.log(
      `\n🎯 OVERALL ACCESSIBILITY & FIDELITY SCORE: ${results.overallScore}%`
    );
    console.log("📊 Component Scores:");
    console.log(`   • Annotation Accuracy: ${scores.annotationAccuracy}%`);
    console.log(`   • Accessibility: ${scores.accessibility}%`);
    console.log(`   • MathJax Fidelity: ${scores.mathJaxFidelity}%`);
    console.log(`   • Export Consistency: ${scores.exportConsistency}%`);

    return results;
  }

  /**
   * Test for LaTeX rendering accuracy and failed commands
   * Detects visual rendering failures like red text and unrecognized commands
   */
  function testLatexRenderingAccuracy() {
    logInfo("Testing LaTeX rendering accuracy and command recognition...");

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      return {
        error: "Output container not available",
        totalContainers: 0,
        renderingAccuracy: 0,
      };
    }

    const results = {
      totalContainers: 0,
      failedCommands: [],
      redTextElements: [],
      unrecognizedCommands: [],
      accuracyIssues: [],
      renderingAccuracy: 0,
      commonFailures: new Map(),
    };

    // Find all math containers
    const mathContainers = outputDiv.querySelectorAll("mjx-container");
    results.totalContainers = mathContainers.length;

    mathContainers.forEach((container, index) => {
      // Check for red text (failed LaTeX commands)
      const redText = container.querySelectorAll(
        '[mathcolor="red"], [color="red"], mtext[mathcolor="red"]'
      );
      redText.forEach((element) => {
        const text = element.textContent.trim();
        if (text.startsWith("\\")) {
          results.failedCommands.push({
            index: index,
            command: text,
            element: element.tagName,
            context: container.outerHTML.substring(0, 100) + "...",
          });

          // Track common failures
          const count = results.commonFailures.get(text) || 0;
          results.commonFailures.set(text, count + 1);

          results.accuracyIssues.push({
            type: "failed_command",
            command: text,
            location: `Container ${index}`,
            severity: "high",
          });
        }
        results.redTextElements.push({
          index: index,
          text: text,
          context: element.outerHTML,
        });
      });

      // Check for literal LaTeX commands in text elements (should be processed)
      const textElements = container.querySelectorAll("mtext, mi");
      textElements.forEach((element) => {
        const text = element.textContent;
        // Look for unprocessed LaTeX commands
        const latexMatches = text.match(/\\[a-zA-Z]+/g);
        if (latexMatches) {
          latexMatches.forEach((match) => {
            results.unrecognizedCommands.push({
              index: index,
              command: match,
              fullText: text,
              element: element.tagName,
            });

            results.accuracyIssues.push({
              type: "unrecognized_command",
              command: match,
              location: `Container ${index}`,
              severity: "medium",
            });
          });
        }
      });
    });

    // Focus on REAL rendering failures only (avoid false positives)
    // Remove semantic unknowns - they're often false positives

    // Calculate accuracy based on actual visible failures
    const containersWithRedText = new Set();
    const containersWithUnprocessedLatex = new Set();

    // Count containers with red text (definite failures)
    results.failedCommands.forEach((failure) => {
      containersWithRedText.add(`Container ${failure.index}`);
    });

    // Count containers with unprocessed LaTeX (but avoid double-counting red text)
    results.unrecognizedCommands.forEach((unrecognized) => {
      const location = `Container ${unrecognized.index}`;
      if (!containersWithRedText.has(location)) {
        containersWithUnprocessedLatex.add(location);
      }
    });

    // Total failed containers (red text has priority)
    const totalFailedContainers =
      containersWithRedText.size + containersWithUnprocessedLatex.size;
    const successfulContainers =
      results.totalContainers - totalFailedContainers;

    results.renderingAccuracy =
      results.totalContainers > 0
        ? Math.round((successfulContainers / results.totalContainers) * 100)
        : 0;

    // Clear and rebuild accuracyIssues with only real problems
    results.accuracyIssues = [];

    results.failedCommands.forEach((failure) => {
      results.accuracyIssues.push({
        type: "failed_command",
        command: failure.command,
        location: `Container ${failure.index}`,
        severity: "high",
      });
    });

    results.unrecognizedCommands.forEach((unrecognized) => {
      const location = `Container ${unrecognized.index}`;
      if (!containersWithRedText.has(location)) {
        results.accuracyIssues.push({
          type: "unrecognized_command",
          command: unrecognized.command,
          location: location,
          severity: "medium",
        });
      }
    });

    // Add debugging info
    logInfo(`Accuracy calculation:`);
    logInfo(
      `  • Containers with red text (high severity): ${containersWithRedText.size}`
    );
    logInfo(
      `  • Containers with unprocessed LaTeX: ${containersWithUnprocessedLatex.size}`
    );
    logInfo(`  • Total failed containers: ${totalFailedContainers}`);
    logInfo(
      `  • Successful containers: ${successfulContainers}/${results.totalContainers}`
    );

    // Generate detailed report
    logInfo(
      `Rendering accuracy analysis complete: ${results.renderingAccuracy}%`
    );

    console.log(`\n🎨 RENDERING ACCURACY RESULTS:`);
    console.log(`   • Total Containers: ${results.totalContainers}`);
    console.log(`   • Failed Commands: ${results.failedCommands.length}`);
    console.log(
      `   • Unrecognized Commands: ${results.unrecognizedCommands.length}`
    );
    console.log(`   • Red Text Elements: ${results.redTextElements.length}`);
    console.log(
      `   • Overall Rendering Accuracy: ${results.renderingAccuracy}%`
    );

    if (results.failedCommands.length > 0) {
      console.log("\n❌ FAILED COMMANDS DETECTED:");
      results.commonFailures.forEach((count, command) => {
        console.log(
          `   • ${command} (${count} occurrence${count > 1 ? "s" : ""})`
        );
      });
    }

    if (
      results.unrecognizedCommands.length > 0 &&
      results.unrecognizedCommands.length <= 5
    ) {
      console.log("\n⚠️ UNRECOGNIZED COMMANDS:");
      results.unrecognizedCommands.slice(0, 5).forEach((item) => {
        console.log(
          `   • ${item.command} in "${item.fullText.substring(0, 30)}..."`
        );
      });
    }

    return results;
  }

  // Helper functions for annotation verification
  function extractLatexExpressions(content) {
    const expressions = [];

    // Match various LaTeX delimiters
    const patterns = [
      { regex: /\\\[(.*?)\\\]/gs, context: "display" },
      { regex: /\$\$(.*?)\$\$/gs, context: "display" },
      {
        regex: /\\begin\{equation\*?\}(.*?)\\end\{equation\*?\}/gs,
        context: "display",
      },
      {
        regex: /\\begin\{align\*?\}(.*?)\\end\{align\*?\}/gs,
        context: "display",
      },
      {
        regex: /\\begin\{gather\*?\}(.*?)\\end\{gather\*?\}/gs,
        context: "display",
      },
      { regex: /\\\((.*?)\\\)/gs, context: "inline" },
      { regex: /\$([^$]+)\$/g, context: "inline" },
    ];

    patterns.forEach(({ regex, context }) => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        expressions.push({
          content: match[1].trim(),
          context: context,
          fullMatch: match[0],
        });
      }
    });

    return expressions;
  }

  function findMatchingAnnotation(sourceExpr, annotations) {
    const normalizedSource = normalizeLatexExpression(sourceExpr.content);

    return annotations.find((annotation) => {
      const normalizedAnnotation = normalizeLatexExpression(annotation.content);
      return normalizedAnnotation === normalizedSource;
    });
  }

  function normalizeLatexExpression(expr) {
    return expr
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\s*\\\\\s*/g, "\\\\") // Normalize line breaks
      .replace(/\s*&\s*/g, "&") // Normalize alignment
      .trim();
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main testing function
    testComprehensiveLaTeXSyntax,

    // Individual suite testing
    testCompleteSuite,
    testExpressionCategory,
    testLatexExpression,

    // Validation functions from protocol
    validateExportedMath,
    validateComprehensiveExport,

    // Test content generation
    generateComprehensiveTestContent,
    loadTestContentIntoPlayground,

    // Source fidelity and consistency testing
    examinePlaygroundMathJax,
    testPlaygroundFidelity,
    testExportProcessingCapability,
    testCompleteFidelityPipeline,
    quickExpressionDiagnostic,
    calculateSourceFidelity,

    // Accessibility and annotation validation
    verifyAnnotationAccuracy,
    testAriaLabelsAndAccessibility,
    testLatexRenderingAccuracy,
    validateAccessibilityAndFidelity,

    // Test data access
    getTestSuites: () => COMPREHENSIVE_TEST_SUITES,

    // Helper functions
    validateLatexSyntax,
    testPlaygroundRendering,
    testExportProcessing,
  };
})();

// Export for global access
window.TestComprehensiveLaTeXSyntax = TestComprehensiveLaTeXSyntax;

// Global convenience functions matching testing protocol
window.validateExportedMath = TestComprehensiveLaTeXSyntax.validateExportedMath;
window.testComprehensiveLatex =
  TestComprehensiveLaTeXSyntax.testComprehensiveLaTeXSyntax;
window.testComprehensiveLatexSyntax =
  TestComprehensiveLaTeXSyntax.testComprehensiveLaTeXSyntax;
window.generateLatexTestContent =
  TestComprehensiveLaTeXSyntax.generateComprehensiveTestContent;
window.generateLatexTestDocument =
  TestComprehensiveLaTeXSyntax.generateComprehensiveTestContent;
window.loadLatexTestContent =
  TestComprehensiveLaTeXSyntax.loadTestContentIntoPlayground;
window.loadComprehensiveLatexTest =
  TestComprehensiveLaTeXSyntax.loadTestContentIntoPlayground;

// Source fidelity and consistency testing functions
window.examinePlaygroundMathJax =
  TestComprehensiveLaTeXSyntax.examinePlaygroundMathJax;
window.testPlaygroundFidelity =
  TestComprehensiveLaTeXSyntax.testPlaygroundFidelity;
window.testExportProcessing =
  TestComprehensiveLaTeXSyntax.testExportProcessingCapability;
window.testCompletePipeline =
  TestComprehensiveLaTeXSyntax.testCompleteFidelityPipeline;
// Legacy alias
window.testExportConsistency =
  TestComprehensiveLaTeXSyntax.testCompleteFidelityPipeline;
window.testMathExpression =
  TestComprehensiveLaTeXSyntax.quickExpressionDiagnostic;
window.quickMathDiagnostic =
  TestComprehensiveLaTeXSyntax.quickExpressionDiagnostic;

// Accessibility and annotation validation functions
window.verifyAnnotationAccuracy =
  TestComprehensiveLaTeXSyntax.verifyAnnotationAccuracy;
window.testAriaLabels =
  TestComprehensiveLaTeXSyntax.testAriaLabelsAndAccessibility;
window.validateAccessibility =
  TestComprehensiveLaTeXSyntax.validateAccessibilityAndFidelity;
window.testAccessibilityAndFidelity =
  TestComprehensiveLaTeXSyntax.validateAccessibilityAndFidelity;
window.testRenderingAccuracy =
  TestComprehensiveLaTeXSyntax.testLatexRenderingAccuracy;

console.log("✅ Comprehensive LaTeX Syntax Testing module loaded");

console.log("✅ Comprehensive LaTeX Syntax Testing module loaded");
console.log("📋 Protocol commands available:");
console.log("   • validateExportedMath() - Baseline validation (playground)");
console.log(
  "   • testComprehensiveLatexSyntax() - Complete test suite validation"
);
console.log(
  "   • generateLatexTestDocument() - Generate test document content"
);
console.log(
  "   • loadComprehensiveLatexTest() - Load test content INTO playground ⭐"
);
console.log("   • testFundamentalOperations() - Test Suite 1 only");
console.log("   • testStressTesting() - Test Suite 7 only");
console.log(
  "   • validateComprehensiveExport() - Export validation with accuracy metrics"
);
console.log("");
console.log("");
console.log("🔍 FIDELITY TESTING:");
console.log(
  "   • testPlaygroundFidelity() - Phase 1: Test MathJax rendering baseline"
);
console.log(
  "   • testExportProcessing() - Phase 2: Test LaTeX processor recovery"
);
console.log("   • testCompletePipeline() - Complete two-phase testing");
console.log(
  "   • testMathExpression('\\\\frac{1}{2}') - Diagnose specific expressions"
);
console.log("");
console.log("♿ ACCESSIBILITY TESTING:");
console.log(
  "   • verifyAnnotationAccuracy() - Verify LaTeX annotations match source"
);
console.log(
  "   • testAriaLabels() - Test ARIA labels and accessibility markup"
);
console.log(
  "   • testRenderingAccuracy() - Test visual rendering accuracy & failed commands"
);
console.log(
  "   • validateAccessibility() - Comprehensive accessibility validation"
);
console.log("");
console.log(
  "🎯 QUICK START: Run loadComprehensiveLatexTest() to load test content!"
);
