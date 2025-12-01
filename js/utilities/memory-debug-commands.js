/**
 * Memory Management Debug Commands
 *
 * Comprehensive console commands for debugging memory issues.
 * Loaded separately to keep boilerplate.html lean.
 *
 * @version 1.0.0
 * @date 25 November 2025
 */

import {
  MemoryMonitor,
  ResourceTracker,
  CircuitBreaker,
  MemoryHealth,
} from "./memory-manager.js";

// ============================================================================
// GLOBAL DEBUG COMMANDS FOR MEMORY MANAGEMENT
// ============================================================================

/**
 * Memory Health Check - Comprehensive system health report
 * Usage: window.checkMemoryHealth()
 */
window.checkMemoryHealth = function () {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║           MEMORY HEALTH CHECK - COMPREHENSIVE REPORT          ║"
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n"
  );

  const health = MemoryHealth.report();

  if (health.healthy) {
    console.log("✅ System Status: HEALTHY");
  } else {
    console.log("⚠️ System Status: ISSUES DETECTED");
    console.log("\n🔧 Run suggested commands to resolve issues.");
  }

  return health;
};

/**
 * Get current memory status
 * Usage: window.getMemoryStatus()
 */
window.getMemoryStatus = function () {
  const info = MemoryMonitor.getMemoryInfo();

  console.log("\n=== Current Memory Status ===");
  console.log(`Used: ${info.usedMB} MB`);
  console.log(`Total: ${info.totalMB} MB`);
  console.log(`Limit: ${info.limitMB} MB`);
  console.log(`Usage: ${info.percentUsed}%`);

  if (info.percentUsed > 80) {
    console.warn("⚠️ HIGH MEMORY USAGE - Consider cleanup");
  } else {
    console.log("✅ Memory usage normal");
  }

  return info;
};

/**
 * Get memory operation history
 * Usage: window.getMemoryHistory()
 */
window.getMemoryHistory = function () {
  console.log("\n=== Memory Operation History ===");
  MemoryMonitor.getReport();
  return MemoryMonitor.log;
};

/**
 * Get resource tracking report
 * Usage: window.getResourceReport()
 */
window.getResourceReport = function () {
  const report = ResourceTracker.getReport();

  console.log("\n=== Tracked Resources ===");
  console.log(`Canvases: ${report.canvases}`);
  console.log(`Images: ${report.images}`);
  console.log(`Blobs: ${report.blobs}`);
  console.log(`Readers: ${report.readers}`);
  console.log(`Total: ${report.total}`);

  if (report.total > 10) {
    console.warn("⚠️ High resource count - Consider cleanup");
  } else {
    console.log("✅ Resource count normal");
  }

  return report;
};

/**
 * Get circuit breaker status
 * Usage: window.getCircuitStatus()
 */
window.getCircuitStatus = function () {
  const state = CircuitBreaker.getState();

  console.log("\n=== Circuit Breaker Status ===");
  console.log(`State: ${state.state}`);
  console.log(`Failures: ${state.failureCount}`);
  console.log(`Successes: ${state.successCount}`);

  if (state.state === "OPEN") {
    const waitTime = Math.ceil((60000 - state.timeSinceFailure) / 1000);
    console.warn(`⚠️ CIRCUIT OPEN - Wait ${waitTime}s before retry`);
  } else {
    console.log("✅ Circuit operational");
  }

  return state;
};

/**
 * Force cleanup of all tracked resources
 * Usage: window.forceMemoryCleanup()
 */
window.forceMemoryCleanup = function () {
  console.log("\n🧹 Forcing memory cleanup...");

  const beforeResources = ResourceTracker.getReport();
  const beforeMemory = MemoryMonitor.getMemoryInfo();

  console.log("Before cleanup:");
  console.log(`  Resources: ${beforeResources.total}`);
  console.log(
    `  Memory: ${beforeMemory.usedMB} MB (${beforeMemory.percentUsed}%)`
  );

  ResourceTracker.forceCleanup();
  CircuitBreaker.reset();

  // Give GC a moment
  setTimeout(() => {
    const afterMemory = MemoryMonitor.getMemoryInfo();
    console.log("\nAfter cleanup:");
    console.log(`  Resources: 0 (all cleared)`);
    console.log(
      `  Memory: ${afterMemory.usedMB} MB (${afterMemory.percentUsed}%)`
    );

    const saved = (beforeMemory.usedMB - afterMemory.usedMB).toFixed(2);
    if (saved > 0) {
      console.log(`\n✅ Freed approximately ${saved} MB`);
    }
  }, 100);

  return { beforeResources, beforeMemory };
};

/**
 * Clean up old resources (older than 1 minute)
 * Usage: window.cleanupOldResources()
 */
window.cleanupOldResources = function () {
  console.log("\n🧹 Cleaning up old resources (>60s)...");

  const old = ResourceTracker.getOldResources(60000);

  if (old.length === 0) {
    console.log("✅ No old resources found");
    return;
  }

  console.log(`Found ${old.length} old resources:`);
  old.forEach((item) => {
    const age = Math.round(item.age / 1000);
    console.log(`  - ${item.type}/${item.id} (${age}s old)`);
  });

  ResourceTracker.cleanupOldResources(60000);
  console.log("✅ Old resources cleaned up");

  return old;
};

/**
 * Reset circuit breaker
 * Usage: window.resetCircuitBreaker()
 */
window.resetCircuitBreaker = function () {
  console.log("\n🔄 Resetting circuit breaker...");
  CircuitBreaker.reset();
  console.log("✅ Circuit breaker reset to CLOSED state");
  return CircuitBreaker.getState();
};

/**
 * Reset memory monitoring log
 * Usage: window.resetMemoryLog()
 */
window.resetMemoryLog = function () {
  console.log("\n🔄 Resetting memory log...");
  MemoryMonitor.reset();
  console.log("✅ Memory log cleared");
};

/**
 * Enable verbose memory tracking
 * Usage: window.enableMemoryTracking()
 */
window.enableMemoryTracking = function () {
  MemoryMonitor.enable();
  console.log("✅ Verbose memory tracking enabled");
  console.log("   All memory operations will be logged");
};

/**
 * Disable verbose memory tracking
 * Usage: window.disableMemoryTracking()
 */
window.disableMemoryTracking = function () {
  MemoryMonitor.disable();
  console.log("✅ Verbose memory tracking disabled");
};

/**
 * Comprehensive memory test suite
 * Usage: window.runMemoryTests()
 */
window.runMemoryTests = async function () {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║              MEMORY MANAGEMENT TEST SUITE                     ║"
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n"
  );

  const tests = [];

  // Test 1: Memory monitoring
  console.log("📊 Test 1: Memory Monitoring...");
  try {
    const memBefore = MemoryMonitor.getMemoryInfo();
    MemoryMonitor.track("test_operation", { test: true });
    const memAfter = MemoryMonitor.getMemoryInfo();
    tests.push({ name: "Memory Monitoring", passed: true });
    console.log("   ✅ Memory monitoring functional");
  } catch (error) {
    tests.push({
      name: "Memory Monitoring",
      passed: false,
      error: error.message,
    });
    console.log("   ❌ Memory monitoring failed:", error.message);
  }

  // Test 2: Resource tracking
  console.log("\n📊 Test 2: Resource Tracking...");
  try {
    const testId = "test_resource_" + Date.now();
    const testCanvas = document.createElement("canvas");
    ResourceTracker.track("canvases", testCanvas, testId);

    const report = ResourceTracker.getReport();
    if (report.canvases > 0) {
      ResourceTracker.release("canvases", testId);
      tests.push({ name: "Resource Tracking", passed: true });
      console.log("   ✅ Resource tracking functional");
    } else {
      throw new Error("Resource not tracked");
    }
  } catch (error) {
    tests.push({
      name: "Resource Tracking",
      passed: false,
      error: error.message,
    });
    console.log("   ❌ Resource tracking failed:", error.message);
  }

  // Test 3: Circuit breaker
  console.log("\n📊 Test 3: Circuit Breaker...");
  try {
    const testOp = async () => "success";
    const result = await CircuitBreaker.execute(testOp, "test_operation");

    if (result === "success") {
      tests.push({ name: "Circuit Breaker", passed: true });
      console.log("   ✅ Circuit breaker functional");
    } else {
      throw new Error("Unexpected result");
    }
  } catch (error) {
    tests.push({
      name: "Circuit Breaker",
      passed: false,
      error: error.message,
    });
    console.log("   ❌ Circuit breaker failed:", error.message);
  }

  // Test 4: Health check
  console.log("\n📊 Test 4: Health Check System...");
  try {
    const health = MemoryHealth.check();
    tests.push({ name: "Health Check", passed: true });
    console.log("   ✅ Health check functional");
    console.log(`   Status: ${health.healthy ? "Healthy" : "Issues Detected"}`);
  } catch (error) {
    tests.push({ name: "Health Check", passed: false, error: error.message });
    console.log("   ❌ Health check failed:", error.message);
  }

  // Summary
  console.log("\n" + "=".repeat(65));
  console.log("TEST SUMMARY");
  console.log("=".repeat(65));

  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? "❌" : ""}`);

  if (failed === 0) {
    console.log("\n🎉 All memory management tests passed!");
  } else {
    console.log("\n⚠️ Some tests failed. Check details above.");
  }

  return { tests, passed, failed, allPassed: failed === 0 };
};

/**
 * Print all available memory debug commands
 * Usage: window.memoryHelp()
 */
window.memoryHelp = function () {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║          MEMORY MANAGEMENT DEBUG COMMANDS                     ║"
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n"
  );

  console.log("📊 MONITORING:");
  console.log("  window.checkMemoryHealth()      - Comprehensive health check");
  console.log("  window.getMemoryStatus()        - Current memory usage");
  console.log("  window.getMemoryHistory()       - Operation history log");
  console.log("  window.getResourceReport()      - Tracked resources");
  console.log("  window.getCircuitStatus()       - Circuit breaker state");

  console.log("\n🧹 CLEANUP:");
  console.log(
    "  window.forceMemoryCleanup()     - Force cleanup all resources"
  );
  console.log(
    "  window.cleanupOldResources()    - Clean stale resources (>60s)"
  );
  console.log("  window.resetCircuitBreaker()    - Reset circuit to CLOSED");
  console.log("  window.resetMemoryLog()         - Clear memory log");

  console.log("\n⚙️ CONFIGURATION:");
  console.log("  window.enableMemoryTracking()   - Enable verbose logging");
  console.log("  window.disableMemoryTracking()  - Disable verbose logging");

  console.log("\n🧪 TESTING:");
  console.log("  window.runMemoryTests()         - Run test suite");

  console.log("\n💡 TIP: Start with window.checkMemoryHealth() for overview");
  console.log("");
};

// Expose memory utilities globally for advanced debugging
window.MemoryMonitor = MemoryMonitor;
window.ResourceTracker = ResourceTracker;
window.CircuitBreaker = CircuitBreaker;
window.MemoryHealth = MemoryHealth;

// Log availability
console.log("✅ Memory management debug commands loaded");
console.log("   Type window.memoryHelp() for command list");
