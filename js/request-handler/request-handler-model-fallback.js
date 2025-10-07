import { modelRegistry } from "../model-registry/model-registry-index.js";
import { a11y } from "../accessibility-helpers.js";

export class ModelFallbackManager {
  getFallbackModel(currentModel, error) {
    let fallbackModel;

    if (error.status === 429 || error.metadata?.quota_exceeded) {
      fallbackModel = modelRegistry.getFallbackModel(currentModel);
      if (fallbackModel) {
        a11y.announceStatus(
          `Switching to fallback model: ${fallbackModel.name}`,
          "polite"
        );
      }
    }

    if (!fallbackModel) {
      // Find first available free model
      const allModels = modelRegistry.getAllModels
        ? modelRegistry.getAllModels()
        : [];
      fallbackModel = allModels.find((model) => model.isFree)?.id;

      if (fallbackModel) {
        a11y.announceStatus(
          `Switching to free model: ${
            modelRegistry.getModel(fallbackModel).name
          }`,
          "polite"
        );
      }
    }

    return fallbackModel;
  }

  shouldSwitchModel(error) {
    return (
      error.status === 429 ||
      error.metadata?.quota_exceeded ||
      error.metadata?.model_unavailable
    );
  }
}
