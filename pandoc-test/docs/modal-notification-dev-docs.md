# Modal & Notification Systems - Developer Documentation

## Overview

This document provides comprehensive guidance for using the embedded Universal Modal and Universal Notifications systems within exported HTML files from the Pandoc-WASM Mathematical Playground.

Both systems are fully embedded in exported HTML files, providing rich interactive capabilities without external dependencies.

## Architecture

### System Integration
- **Automatic Context Detection**: Notifications automatically switch between toast mode (when no modal is active) and in-modal status mode (when a modal is open)
- **WCAG 2.2 AA Compliant**: Full accessibility support including screen reader announcements, keyboard navigation, and focus management
- **Self-Contained**: All CSS and JavaScript embedded in exported HTML files
- **Backward Compatible**: Supports both modern promise-based API and legacy callback patterns

## Universal Modal System

### Core API

#### Basic Modal Methods

```javascript
// Simple alert
UniversalModal.alert(message, options)

// Confirmation dialog  
UniversalModal.confirm(message, options)

// Input prompt
UniversalModal.prompt(message, options)

// Custom modal
UniversalModal.custom(content, options)
```

#### Legacy API (Backward Compatibility)
```javascript
// Legacy signatures
UniversalModal.showAlert(title, message, options)
UniversalModal.showConfirm(title, message, options)

// Direct constructor
new UniversalModal.Modal(options)
```

### Modal Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | "Modal Dialog" | Modal title text |
| `type` | string | "info" | Modal type: "info", "warning", "error", "success", "confirmation" |
| `size` | string | "medium" | Modal size: "small", "medium", "large", "fullscreen" |
| `allowBackgroundClose` | boolean | true | Allow closing by clicking background |
| `buttons` | array | [] | Custom button configuration |

### Button Configuration

```javascript
{
  text: "Button Text",
  type: "primary" | "secondary" | "success",
  action: "close" | "cancel" | "confirm" | function() { /* custom logic */ }
}
```

### Modal Types and Icons

| Type | Icon | Use Case |
|------|------|----------|
| `info` | ℹ️ | General information |
| `warning` | ⚠️ | Warnings and cautions |
| `error` | ❌ | Error messages |
| `success` | ✅ | Success confirmations |
| `confirmation` | ❓ | User confirmations |

### In-Modal Status System

```javascript
// Show status in active modal
UniversalModal.showStatus(message, type, options)

// Update existing status
UniversalModal.updateStatus(message, type, options)

// Hide status
UniversalModal.hideStatus()
```

#### Status Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | number | null | Auto-hide duration (ms), 0 for persistent |
| `dismissible` | boolean | true | Show dismiss button |

### Modal State Management

```javascript
// Check if modal is active
UniversalModal.isModalActive()

// Get current modal element
UniversalModal.getCurrentModal()

// Get current modal ID
UniversalModal.getCurrentModalId()
```

## Universal Notifications System

### Core API

```javascript
// Generic show method
UniversalNotifications.show(message, type, options)

// Convenience methods
UniversalNotifications.success(message, options)
UniversalNotifications.error(message, options)
UniversalNotifications.warning(message, options)
UniversalNotifications.info(message, options)
UniversalNotifications.loading(message, options)
```

### Global Shortcuts
```javascript
// Available globally
notifySuccess(message, options)
notifyError(message, options)
notifyWarning(message, options)
notifyInfo(message, options)
notify(message, type, options)
```

### Notification Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | number | auto | Auto-dismiss duration (ms), 0 for persistent |
| `dismissible` | boolean | true | Show close button |
| `persistent` | boolean | false | Never auto-dismiss |

### Auto-Dismiss Durations
- **success**: 4000ms
- **info**: 4000ms  
- **warning**: 4000ms
- **error**: 0ms (persistent)
- **loading**: 0ms (persistent)

### Notification Management

```javascript
// Clear all notifications
UniversalNotifications.clearAll()

// Dismiss specific notification
UniversalNotifications.dismiss(notificationId)

// Alternative syntax
UniversalNotifications.clear(notificationId)
```

## Integration Patterns

### Context-Aware Behavior

The notification system automatically detects modal state and switches behavior:

```javascript
// When no modal is active - shows as toast
UniversalNotifications.success("Document saved!");

// Open a modal
const result = await UniversalModal.confirm("Save changes?");

// While modal is active - shows as in-modal status
UniversalNotifications.info("Checking permissions..."); 

// Modal closed - back to toast mode
UniversalNotifications.success("All done!");
```

### Async/Await Patterns

All modal methods return promises:

```javascript
// Sequential modals
const name = await UniversalModal.prompt("Enter your name:");
if (name) {
  const confirmed = await UniversalModal.confirm(`Hello ${name}, continue?`);
  if (confirmed) {
    UniversalNotifications.success("Welcome!");
  }
}

// Error handling
try {
  const result = await UniversalModal.custom(complexContent, options);
  // Process result
} catch (error) {
  UniversalNotifications.error(`Modal failed: ${error.message}`);
}
```

## Common Use Cases

### Document Operations

```javascript
// Save with feedback
async function saveDocument() {
  UniversalNotifications.loading("Saving document...");
  
  try {
    const result = await performSaveOperation();
    UniversalNotifications.success("Document saved successfully!");
    return result;
  } catch (error) {
    UniversalNotifications.error(`Save failed: ${error.message}`);
    throw error;
  }
}

// Export with options
async function exportDocument() {
  const options = await UniversalModal.custom(`
    <div>
      <p>Choose export options:</p>
      <label><input type="checkbox" id="includeImages"> Include images</label><br>
      <label><input type="checkbox" id="includeNotes"> Include notes</label><br>
      <label>
        Format: 
        <select id="format">
          <option value="pdf">PDF</option>
          <option value="html">HTML</option>
          <option value="docx">Word</option>
        </select>
      </label>
    </div>
  `, {
    title: "Export Options",
    size: "medium",
    buttons: [
      {
        text: "Export",
        type: "primary", 
        action: () => ({
          includeImages: document.getElementById('includeImages').checked,
          includeNotes: document.getElementById('includeNotes').checked,
          format: document.getElementById('format').value
        })
      },
      { text: "Cancel", type: "secondary", action: false }
    ]
  });
  
  if (options) {
    UniversalNotifications.success(`Exporting as ${options.format}...`);
    return options;
  }
}
```

### Form Validation

```javascript
function validateAndSubmit(formData) {
  const errors = validateForm(formData);
  
  if (errors.length > 0) {
    const errorList = errors.map(e => `• ${e}`).join('\n');
    UniversalModal.alert(`Please correct the following:\n\n${errorList}`, {
      title: "Validation Errors",
      type: "error",
      size: "medium"
    });
    return false;
  }
  
  UniversalNotifications.success("Form submitted successfully!");
  return true;
}
```

### Progress Tracking

```javascript
async function processWithProgress() {
  const steps = [
    "Initialising...",
    "Processing content...", 
    "Applying styles...",
    "Generating output...",
    "Finalising..."
  ];
  
  for (let i = 0; i < steps.length; i++) {
    UniversalNotifications.info(`Step ${i + 1}/${steps.length}: ${steps[i]}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  UniversalNotifications.clearAll();
  UniversalNotifications.success("Process completed!");
}
```

### Error Recovery

```javascript
async function operationWithRetry(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      UniversalNotifications.loading(`Attempt ${attempt}...`);
      const result = await operation();
      UniversalNotifications.success("Operation completed!");
      return result;
      
    } catch (error) {
      if (attempt === maxRetries) {
        UniversalNotifications.error("Operation failed after maximum retries");
        
        const retry = await UniversalModal.confirm(
          `Operation failed: ${error.message}\n\nWould you like to try again?`,
          { title: "Operation Failed", type: "error" }
        );
        
        if (retry) {
          return operationWithRetry(operation, maxRetries);
        }
        throw error;
      }
      
      UniversalNotifications.warning(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

## Advanced Features

### Custom Button Actions

```javascript
// Button with complex logic
{
  text: "Process",
  type: "primary",
  action: async function() {
    // Show in-modal loading
    UniversalModal.showStatus("Processing...", "loading");
    
    try {
      const result = await complexOperation();
      UniversalModal.showStatus("Success!", "success");
      
      // Wait for user to see success, then close
      setTimeout(() => {
        // Return result closes modal with this value
        return result;
      }, 1500);
      
      // Return false to keep modal open initially
      return false;
      
    } catch (error) {
      UniversalModal.showStatus(`Error: ${error.message}`, "error");
      return false; // Keep modal open on error
    }
  }
}
```

### Dynamic Modal Content

```javascript
async function showDynamicModal() {
  let currentStep = 1;
  const totalSteps = 3;
  
  const modal = await UniversalModal.custom(
    generateStepContent(currentStep), 
    {
      title: `Step ${currentStep} of ${totalSteps}`,
      buttons: [
        { 
          text: "Next", 
          type: "primary",
          action: async function() {
            if (currentStep < totalSteps) {
              currentStep++;
              // Update modal content dynamically
              const modalBody = document.querySelector('.universal-modal-body');
              modalBody.innerHTML = generateStepContent(currentStep);
              
              const modalTitle = document.querySelector('.universal-modal-heading');
              modalTitle.textContent = `Step ${currentStep} of ${totalSteps}`;
              
              return false; // Keep modal open
            } else {
              return "completed"; // Close and return result
            }
          }
        },
        { text: "Cancel", type: "secondary", action: "cancel" }
      ]
    }
  );
  
  return modal;
}

function generateStepContent(step) {
  const steps = {
    1: "<p>Welcome! Let's begin the setup process.</p>",
    2: "<p>Configure your preferences...</p>", 
    3: "<p>Review and confirm your settings.</p>"
  };
  return steps[step] || "";
}
```

## Best Practices

### User Experience

1. **Appropriate Modal Types**
   - Use `alert` for simple information
   - Use `confirm` for destructive actions
   - Use `custom` for complex interactions
   - Use `prompt` for simple input

2. **Notification Timing**
   - Success messages: Brief (4s default)
   - Error messages: Persistent until dismissed
   - Loading messages: Persistent, manually dismissed
   - Progress updates: Clear previous, show current

3. **Content Guidelines**
   - Keep modal titles concise and descriptive
   - Use clear, action-oriented button text
   - Provide context for confirmation dialogs
   - Include helpful information in error messages

### Performance

1. **Resource Management**
   - Clean up event listeners in custom button actions
   - Avoid memory leaks in long-running operations
   - Clear notifications when no longer relevant

2. **Accessibility**
   - Always provide meaningful titles and labels
   - Use appropriate ARIA attributes
   - Test with keyboard navigation
   - Verify screen reader compatibility

### Error Handling

```javascript
// Robust error handling pattern
async function robustOperation() {
  try {
    const result = await riskyOperation();
    UniversalNotifications.success("Operation completed!");
    return result;
    
  } catch (error) {
    // Log for debugging
    console.error("Operation failed:", error);
    
    // User-friendly error notification
    UniversalNotifications.error("Something went wrong. Please try again.");
    
    // Optional: Show detailed error in modal for advanced users
    const showDetails = await UniversalModal.confirm(
      "Would you like to see technical details?",
      { title: "Error Details Available" }
    );
    
    if (showDetails) {
      UniversalModal.alert(`Technical details:\n\n${error.stack}`, {
        title: "Error Details",
        type: "error",
        size: "large"
      });
    }
    
    throw error; // Re-throw for calling code
  }
}
```

## Integration with Document Features

### MathJax Integration

```javascript
// Show modal after MathJax rendering
document.addEventListener('DOMContentLoaded', function() {
  if (window.MathJax) {
    MathJax.Hub.Queue(function() {
      UniversalNotifications.success("Mathematical content loaded!");
    });
  }
});
```

### Reading Tools Integration

```javascript
// Confirm before changing accessibility settings
async function changeAccessibilitySetting(setting, value) {
  if (setting === 'fontSize' && value > 1.5) {
    const confirmed = await UniversalModal.confirm(
      "Large font sizes may affect document layout. Continue?",
      { title: "Layout Warning", type: "warning" }
    );
    
    if (!confirmed) return;
  }
  
  // Apply setting
  applyAccessibilitySetting(setting, value);
  UniversalNotifications.info(`${setting} updated`);
}
```

### Theme System Integration

```javascript
// Smooth theme transitions with feedback
async function changeTheme(newTheme) {
  UniversalNotifications.info("Switching theme...");
  
  try {
    await applyTheme(newTheme);
    UniversalNotifications.success(`Switched to ${newTheme} theme`);
  } catch (error) {
    UniversalNotifications.error("Failed to change theme");
    console.error(error);
  }
}
```

## Debugging and Development

### Debug Mode

```javascript
// Enable debug logging
UniversalModal.setLogLevel(3); // DEBUG level
UniversalNotifications.setLogLevel(3); // DEBUG level

// Check modal compliance
const compliance = UniversalModal.checkCompliance();
console.table(compliance);

// Quick diagnostic
UniversalModal.quickDiagnostic();
```

### Testing Utilities

```javascript
// Test modal functionality
function testModalSystem() {
  console.log("Testing modal system...");
  
  // Test basic alert
  UniversalModal.alert("Test alert").then(() => {
    console.log("✅ Alert test passed");
    
    // Test confirmation
    return UniversalModal.confirm("Test confirmation?");
  }).then((confirmed) => {
    console.log("✅ Confirm test passed:", confirmed);
    
    // Test notifications
    UniversalNotifications.success("All tests completed!");
  });
}

// Test notification system
function testNotificationSystem() {
  const types = ['success', 'error', 'warning', 'info', 'loading'];
  
  types.forEach((type, index) => {
    setTimeout(() => {
      UniversalNotifications[type](`Test ${type} notification`);
    }, index * 1000);
  });
  
  // Clear all after tests
  setTimeout(() => {
    UniversalNotifications.clearAll();
    console.log("✅ Notification tests completed");
  }, types.length * 1000);
}
```

## Troubleshooting

### Common Issues

1. **Modals not appearing**
   - Check console for errors
   - Verify DOM is ready before calling modal methods
   - Ensure no CSS conflicts with modal classes

2. **Notifications not showing**
   - Check if container was created successfully
   - Verify no z-index conflicts
   - Check if parent elements have overflow:hidden

3. **Focus management issues**
   - Verify modal has focusable elements
   - Check for JavaScript errors interrupting focus handling
   - Test keyboard navigation (Tab key)

4. **Screen reader problems**
   - Verify ARIA attributes are present
   - Check announcements in screen reader
   - Test with multiple screen readers if possible

### Performance Issues

1. **Memory leaks**
   - Always clean up event listeners
   - Clear notification references
   - Avoid circular references in button actions

2. **Slow rendering**
   - Limit concurrent notifications
   - Optimize custom modal content
   - Use requestAnimationFrame for animations

This documentation should serve as your primary reference for implementing modal and notification features within exported HTML files. Both systems are designed to work together seamlessly while maintaining full accessibility and providing a rich user experience.