class BrowserDependencyTracker {
  constructor() {
    this.imports = new Map();
    this.methods = new Map();
    this.sourceUrls = new Set();
    this.scannedFiles = new Set();
    this.pendingScans = new Set();
    this.errors = [];
    this.BASE_URL = window.location.origin;
    this.JS_PATH = "/js/";
    // Maximum items to show in a list before adding "Show more" button
    this.LIST_LIMIT = 100;
  }

  async resolveImportPath(basePath, importPath) {
    if (importPath.startsWith(".")) {
      const baseDir = basePath.substring(0, basePath.lastIndexOf("/"));
      const resolvedPath = new URL(importPath, baseDir + "/").href;
      return resolvedPath;
    }
    return new URL(importPath, this.BASE_URL + this.JS_PATH).href;
  }

  async scanScripts() {
    try {
      const mainJsUrl = `${this.BASE_URL}${this.JS_PATH}main.js`;
      await this.scanFile(mainJsUrl);

      while (this.pendingScans.size > 0) {
        await Promise.all(Array.from(this.pendingScans));
      }

      return this.generateReport();
    } catch (error) {
      this.errors.push(error);
      throw error;
    }
  }

  async scanFile(url) {
    if (this.scannedFiles.has(url)) {
      return;
    }

    this.scannedFiles.add(url);
    this.sourceUrls.add(url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
      const content = await response.text();
      const importPaths = await this.analyzeScript(url, content);

      for (const importPath of importPaths) {
        try {
          const resolvedPath = await this.resolveImportPath(url, importPath);
          const scanPromise = this.scanFile(resolvedPath);
          this.pendingScans.add(scanPromise);
          await scanPromise;
          this.pendingScans.delete(scanPromise);
        } catch (error) {
          this.errors.push(error);
        }
      }
    } catch (error) {
      this.errors.push(error);
    }
  }

  analyzeScript(url, content) {
    const importPaths = new Set();
    const importRegex =
      /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|\s*(\w+))\s+from\s+['"]([^'"]+)['"]/g;

    // Track all imported identifiers and their modules
    const importsByName = new Map();
    let match;

    // First pass: collect all imports
    while ((match = importRegex.exec(content)) !== null) {
      const [fullMatch, namedImports, namespaceImport, defaultImport, path] =
        match;
      importPaths.add(path);

      if (!this.imports.has(path)) {
        this.imports.set(path, {
          files: new Set(),
          named: new Set(),
          namespace: null,
          default: null,
        });
      }

      const importInfo = this.imports.get(path);
      importInfo.files.add(url);

      // Track named imports
      if (namedImports) {
        namedImports.split(",").forEach((name) => {
          const cleanName = name.trim();
          importInfo.named.add(cleanName);
          importsByName.set(cleanName, path);
        });
      }

      // Track namespace imports
      if (namespaceImport) {
        importInfo.namespace = namespaceImport;
        importsByName.set(namespaceImport, path);
      }

      // Track default imports
      if (defaultImport) {
        importInfo.default = defaultImport;
        importsByName.set(defaultImport, path);
      }
    }

    // Only process files that have imports
    if (importsByName.size === 0) {
      return Array.from(importPaths);
    }

    // Create a single regex to match all method calls for all imports
    // This is more efficient than running multiple regexes
    const importNamesPattern = Array.from(importsByName.keys())
      .map((name) => this.escapeRegExp(name))
      .join("|");

    // If we found no imports, skip method detection
    if (!importNamesPattern) {
      return Array.from(importPaths);
    }

    // This regex looks for:
    // 1. A word boundary
    // 2. One of our imported names
    // 3. Followed by a dot
    // 4. Then a valid method name (starts with letter, can include letters, numbers, underscore)
    // 5. Followed by an opening parenthesis (to ensure it's a method call)
    const methodCallRegex = new RegExp(
      `\\b(${importNamesPattern})\\.(\\w+)\\s*\\(`,
      "g"
    );

    let methodMatch;
    while ((methodMatch = methodCallRegex.exec(content)) !== null) {
      const [_, objectName, methodName] = methodMatch;

      // Skip if it's a native method on standard objects
      if (this.isNativeMethod(methodName)) {
        continue;
      }

      const fullMethodName = `${objectName}.${methodName}`;

      if (!this.methods.has(fullMethodName)) {
        this.methods.set(fullMethodName, new Set());
      }
      this.methods.get(fullMethodName).add(url);
    }

    return Array.from(importPaths);
  }

  // Helper to check if a method is a common native method
  isNativeMethod(methodName) {
    const nativeMethods = new Set([
      // Common array methods
      "forEach",
      "map",
      "filter",
      "reduce",
      "slice",
      "join",
      "push",
      "pop",
      "shift",
      "unshift",
      "concat",
      "indexOf",
      "includes",
      "find",
      "some",
      "every",

      // Common string methods
      "replace",
      "split",
      "substring",
      "substr",
      "trim",
      "toLowerCase",
      "toUpperCase",

      // Common object methods
      "keys",
      "values",
      "entries",
      "hasOwnProperty",
      "toString",

      // Common DOM methods
      "getElementById",
      "querySelector",
      "querySelectorAll",
      "createElement",
      "appendChild",
      "removeChild",
      "setAttribute",
      "getAttribute",
      "addEventListener",

      // Common JavaScript methods
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "parseInt",
      "parseFloat",
      "isNaN",
      "isFinite",

      // Utility methods
      "log",
      "warn",
      "error",
      "info",
      "debug",
      "group",
      "groupEnd",
      "trace",
    ]);

    return nativeMethods.has(methodName);
  }

  // Helper to safely escape regex special characters
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Filter out methods without proper object names (standalone methods)
  getFilteredMethods() {
    const filteredMethods = new Map();

    for (const [methodName, files] of this.methods.entries()) {
      // Only keep methods that don't start with a dot
      if (!methodName.startsWith(".")) {
        filteredMethods.set(methodName, files);
      }
    }

    return filteredMethods;
  }

  // Simplify file paths for display
  simplifyPath(path) {
    // Remove base URL and /js/ prefix
    let simplified = path.replace(this.BASE_URL, "");
    simplified = simplified.replace(/^\/js\//, "");

    // Create a more readable format
    return simplified;
  }

  // Group files by module
  groupFilesByModule(files) {
    const modules = new Map();

    files.forEach((file) => {
      const simplified = this.simplifyPath(file);
      // Extract module name from path (e.g., "token-counter" from "token-counter/index.js")
      const parts = simplified.split("/");
      const module = parts.length > 1 ? parts[0] : "core";

      if (!modules.has(module)) {
        modules.set(module, new Set());
      }
      modules.get(module).add(simplified);
    });

    return modules;
  }

  // Create HTML for a collapsible file list
  createCollapsibleFileList(files, id) {
    const simplifiedFiles = Array.from(files).map((file) =>
      this.simplifyPath(file)
    );
    const fileCount = simplifiedFiles.length;

    // If list is small, just show all files
    if (fileCount <= this.LIST_LIMIT) {
      return `
        <ul class="files-list">
          ${simplifiedFiles.map((file) => `<li>${file}</li>`).join("")}
        </ul>
      `;
    }

    // For longer lists, create a collapsible section
    const previewItems = simplifiedFiles.slice(0, this.LIST_LIMIT);
    const hiddenItems = simplifiedFiles.slice(this.LIST_LIMIT);

    return `
      <ul class="files-list" id="files-${id}">
        ${previewItems.map((file) => `<li>${file}</li>`).join("")}
        <li class="more-indicator" id="more-${id}">
          <button class="show-more-btn" 
                  aria-expanded="false" 
                  aria-controls="hidden-${id}">
            Show ${hiddenItems.length} more files
          </button>
        </li>
      </ul>
      <ul class="files-list hidden" id="hidden-${id}">
        ${hiddenItems.map((file) => `<li>${file}</li>`).join("")}
        <li>
          <button class="show-less-btn" 
                  aria-expanded="true" 
                  aria-controls="hidden-${id}">
            Show less
          </button>
        </li>
      </ul>
    `;
  }

  // Create grouped module summary
  createModuleSummary(files) {
    const modules = this.groupFilesByModule(files);

    let summary = `<div class="module-summary">`;
    summary += `<span class="module-count">${files.size} files across ${modules.size} modules</span>`;

    if (modules.size > 1) {
      summary += `<ul class="module-list">`;
      for (const [module, moduleFiles] of modules.entries()) {
        summary += `<li>${module} (${moduleFiles.size})</li>`;
      }
      summary += `</ul>`;
    }

    summary += `</div>`;
    return summary;
  }

  generateReport() {
    const filteredMethods = this.getFilteredMethods();

    const report = {
      imports: {},
      methods: {},
      stats: {
        totalFiles: this.sourceUrls.size,
        totalImports: this.imports.size,
        totalMethods: filteredMethods.size,
      },
      errors: this.errors,
    };

    for (const [path, info] of this.imports) {
      report.imports[path] = {
        files: Array.from(info.files),
        named: Array.from(info.named),
        namespace: info.namespace,
        default: info.default,
      };
    }

    for (const [method, files] of filteredMethods) {
      report.methods[method] = Array.from(files);
    }

    return report;
  }

  displayReport(report = null) {
    if (!report) {
      report = this.generateReport();
    }
    this.createAccessibleReport(report);
    return report;
  }

  createAccessibleReport(report) {
    let container = document.getElementById("dependency-report-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "dependency-report-container";
      document.body.appendChild(container);
    }

    const filteredMethods = this.getFilteredMethods();

    const importItems = Object.entries(report.imports)
      .map(([path, info], index) => {
        return `
        <div class="import-item">
          <h4 class="import-path">${path}</h4>
          <div class="import-details">
            ${
              info.default
                ? `
              <div class="import-detail">
                <span class="detail-label">Default:</span>
                <span class="detail-value">${info.default}</span>
              </div>
            `
                : ""
            }
            ${
              info.namespace
                ? `
              <div class="import-detail">
                <span class="detail-label">Namespace:</span>
                <span class="detail-value">${info.namespace}</span>
              </div>
            `
                : ""
            }
            ${
              info.named.length
                ? `
              <div class="import-detail">
                <span class="detail-label">Named:</span>
                <span class="detail-value">${Array.from(info.named).join(
                  ", "
                )}</span>
              </div>
            `
                : ""
            }
            <div class="import-detail">
              <span class="detail-label">Used in:</span>
              ${this.createModuleSummary(new Set(info.files))}
              ${this.createCollapsibleFileList(
                new Set(info.files),
                `import-${index}`
              )}
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    const methodItems = Array.from(filteredMethods.entries())
      .map(([method, files], index) => {
        return `
        <div class="method-item">
          <h4 class="method-name">${method}</h4>
          <div class="method-files">
            <span class="detail-label">Used in:</span>
            ${this.createModuleSummary(files)}
            ${this.createCollapsibleFileList(files, `method-${index}`)}
          </div>
        </div>
      `;
      })
      .join("");

    container.innerHTML = `
      <div id="dependency-report" role="region" aria-label="Dependency Analysis Report">
        <div class="dependency-header">
          <h3>Dependency Analysis</h3>
          <button onclick="refreshDependencyAnalysis()" 
                  class="refresh-button preset-buttons preset-button" 
                  aria-label="Refresh dependency analysis">
            ↻ Refresh
          </button>
        </div>
        
        <div class="report-panel stats-panel">
          <h3>Overview</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-label">Files Scanned</span>
              <span class="stat-value">${report.stats.totalFiles}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Imports Found</span>
              <span class="stat-value">${report.stats.totalImports}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Methods Tracked</span>
              <span class="stat-value">${filteredMethods.size}</span>
            </div>
          </div>
        </div>

        <details>
          <summary>Imports (${report.stats.totalImports})</summary>
          <div class="report-panel imports-panel">
            <div class="imports-grid">
              ${importItems}
            </div>
          </div>
        </details>

        <details>
          <summary>Methods (${filteredMethods.size})</summary>
          <div class="report-panel methods-panel">
            <div class="methods-grid">
              ${methodItems}
            </div>
          </div>
        </details>

        ${
          report.errors.length > 0
            ? `
          <details>
            <summary>Errors (${report.errors.length})</summary>
            <div class="report-panel errors-panel">
              <ul class="error-list">
                ${report.errors
                  .map((error) => `<li>${error.message}</li>`)
                  .join("")}
              </ul>
            </div>
          </details>
        `
            : ""
        }

        <div class="report-footer">
          <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    this.addExportButton(container);
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Add event listeners for show more/less buttons
    document.querySelectorAll(".show-more-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const id = e.target.getAttribute("aria-controls");
        const hiddenList = document.getElementById(id);
        const moreIndicator = e.target.parentElement;

        hiddenList.classList.remove("hidden");
        moreIndicator.classList.add("hidden");
        e.target.setAttribute("aria-expanded", "true");
      });
    });

    document.querySelectorAll(".show-less-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const id = e.target.getAttribute("aria-controls");
        const hiddenList = document.getElementById(id);
        const listId = id.replace("hidden-", "files-");
        const moreIndicator = document.querySelector(
          `#${listId} .more-indicator`
        );

        hiddenList.classList.add("hidden");
        moreIndicator.classList.remove("hidden");
        document
          .querySelector(`#${listId} .show-more-btn`)
          .setAttribute("aria-expanded", "false");
      });
    });
  }

  addExportButton(container) {
    const exportButton = document.createElement("button");
    exportButton.id = "export-dependency-report";
    exportButton.className = "export-report-button preset-button";
    exportButton.textContent = "Export Dependency Report";
    exportButton.setAttribute(
      "aria-label",
      "Export dependency report as text file"
    );
    exportButton.addEventListener("click", () => this.exportReport());
    container.appendChild(exportButton);
  }

  generateTextReport() {
    const filteredMethods = this.getFilteredMethods();

    const sections = [];
    const divider = "\n" + "=".repeat(80) + "\n";

    sections.push(`DEPENDENCY ANALYSIS REPORT
Generated: ${new Date().toISOString()}
Project Base URL: ${this.BASE_URL}${this.JS_PATH}
`);

    sections.push(`STATISTICS
Total Files Scanned: ${this.sourceUrls.size}
Total Imports Found: ${this.imports.size}
Total Methods Tracked: ${filteredMethods.size}
`);

    sections.push(`SCANNED FILES
${Array.from(this.sourceUrls)
  .map((url) => `- ${this.simplifyPath(url)}`)
  .join("\n")}
`);

    sections.push("IMPORTS ANALYSIS");
    for (const [path, info] of this.imports) {
      sections.push(`
Import Path: ${path}
  Default Import: ${info.default || "None"}
  Namespace Import: ${info.namespace || "None"}
  Named Imports: ${Array.from(info.named).join(", ") || "None"}
  Used in Files:
    ${Array.from(info.files)
      .map((file) => `- ${this.simplifyPath(file)}`)
      .join("\n    ")}
`);
    }

    sections.push("METHODS ANALYSIS");
    for (const [method, files] of filteredMethods) {
      sections.push(`
Method: ${method}
  Used in Files:
    ${Array.from(files)
      .map((file) => `- ${this.simplifyPath(file)}`)
      .join("\n    ")}
`);
    }

    if (this.errors.length > 0) {
      sections.push("ERRORS");
      sections.push(this.errors.map((error) => error.message).join("\n"));
    }

    return sections.join(divider);
  }

  exportReport() {
    try {
      const textContent = this.generateTextReport();
      const blob = new Blob([textContent], {
        type: "text/plain;charset=utf-8",
      });
      const filename = `dependency-report-${
        new Date().toISOString().split("T")[0]
      }.txt`;

      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = filename;

      const statusMsg = document.createElement("div");
      statusMsg.setAttribute("role", "status");
      statusMsg.setAttribute("aria-live", "polite");
      statusMsg.className = "sr-only";
      statusMsg.textContent = "Preparing dependency report for download...";
      document.body.appendChild(statusMsg);

      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);

      setTimeout(() => {
        statusMsg.textContent = "Dependency report download complete";
        setTimeout(() => statusMsg.remove(), 2000);
      }, 500);
    } catch (error) {
      const errorMsg = document.createElement("div");
      errorMsg.setAttribute("role", "alert");
      errorMsg.className = "error-message";
      errorMsg.textContent = `Error exporting report: ${error.message}`;
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 5000);
    }
  }
}

window.DependencyTracker = BrowserDependencyTracker;

// Add global refresh function for the refresh button
window.refreshDependencyAnalysis = async function () {
  try {
    const statusMsg = document.createElement("div");
    statusMsg.setAttribute("role", "status");
    statusMsg.setAttribute("aria-live", "polite");
    statusMsg.className = "sr-only";
    statusMsg.textContent = "Refreshing dependency analysis...";
    document.body.appendChild(statusMsg);

    const tracker = new DependencyTracker();
    const report = await tracker.scanScripts();
    tracker.displayReport(report);

    statusMsg.textContent = "Dependency analysis refreshed successfully";
    setTimeout(() => statusMsg.remove(), 2000);
  } catch (error) {
    console.error("Error refreshing dependency analysis:", error);
    const errorMsg = document.createElement("div");
    errorMsg.setAttribute("role", "alert");
    errorMsg.className = "error-message";
    errorMsg.textContent = `Error refreshing analysis: ${error.message}`;
    document.body.appendChild(errorMsg);
    setTimeout(() => errorMsg.remove(), 5000);
  }
};
