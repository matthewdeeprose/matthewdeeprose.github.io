
  configureUserChoiceIntegration(level, options = {}) {
    try {
      logInfo('[CONFIGURATION] 🔧 Configuring user choice integration:', {
        level: level,
        options: options
      });

      // ✅ Step 1: Validate configuration level
      const validationResult = this.validateConfigurationLevel(level);
      if (!validationResult.valid) {
        logError('[CONFIGURATION] ❌ Invalid configuration level:', {
          level: level,
          error: validationResult.error
        });
        
        return {
          success: false,
          error: validationResult.error,
          level: level,
          action: 'configuration_failed'
        };
      }

      // ✅ Step 2: Get current configuration for comparison
      const currentConfig = this.getUserChoiceConfiguration();
      const previousLevel = currentConfig.level;

      // ✅ Step 3: Create new configuration object
      const newConfiguration = {
        level: level,
        lastUpdated: new Date().toISOString(),
        setBy: options.reason || 'user_preference',
        customOptions: {
          autoApplyThreshold: 4,     // Default high confidence threshold
          choiceTimeout: 15000,      // 15 second timeout
          storageRetention: 30,      // 30 days retention
          userCommunication: true,   // Always provide user feedback
          ...options.customOptions   // Override with any custom options
        },
        version: '1.0.0',
        previousLevel: previousLevel
      };

      // ✅ Step 4: Apply level-specific configuration defaults
      this.applyLevelSpecificDefaults(newConfiguration);

      // ✅ Step 5: Persist configuration if requested
      const persistResult = this.persistUserChoiceConfiguration(newConfiguration, options.persist !== false);

      if (!persistResult.success) {
        logError('[CONFIGURATION] ❌ Failed to persist configuration:', persistResult.error);
        
        return {
          success: false,
          error: persistResult.error,
          level: level,
          action: 'persistence_failed'
        };
      }

      // ✅ Step 6: Update runtime configuration
      this.updateRuntimeConfiguration(newConfiguration);

      // ✅ Step 7: Notify user if requested
      if (options.notifyUser !== false) {
        this.announceConfigurationChange(previousLevel, level, options.reason);
      }

      // ✅ Step 8: Return success result
      const configurationResult = {
        success: true,
        level: level,
        previousLevel: previousLevel,
        configuration: newConfiguration,
        featuresEnabled: this.getActiveIntegrationFeatures(),
        action: 'configuration_updated',
        timestamp: Date.now()
      };

      logInfo('[CONFIGURATION] ✅ User choice integration configured successfully:', {
        level: level,
        previousLevel: previousLevel,
        features: configurationResult.featuresEnabled
      });

      return configurationResult;

    } catch (configurationError) {
      logError('[CONFIGURATION] ❌ Configuration failed:', configurationError);
      
      return {
        success: false,
        error: configurationError.message,
        level: level,
        action: 'configuration_error',
        fallbackToDefault: true
      };
    }
  }
