import { LLMProviderId, LLMProviderInfo } from "../types";

export const AVAILABLE_PROVIDERS: LLMProviderInfo[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    badge: "Default",
    description: "Fast multimodal intelligence with native Indian GST comprehension",
    defaultModel: "gemini-3.5-flash",
    ocrModel: "gemini-3.5-flash",
    supportedModels: ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.8-flash"]
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    badge: "GPT-4o",
    description: "Industry-standard OpenAI models with structured reasoning and vision",
    defaultModel: "gpt-4o-mini",
    ocrModel: "gpt-4o-mini",
    supportedModels: ["gpt-4o-mini", "gpt-4o"]
  }
];

const STORAGE_KEY_PROVIDER = "invoicepro_llm_provider";
const STORAGE_KEY_MODEL_PREFIX = "invoicepro_llm_model_";

/**
 * Gets currently selected LLM provider from localStorage, defaulting to 'gemini'.
 */
export function getActiveProvider(): LLMProviderId {
  if (typeof window === "undefined") return "gemini";
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROVIDER) as LLMProviderId | null;
    if (stored === "gemini" || stored === "openai" || stored === "anthropic") {
      return stored;
    }
  } catch {
    // Fall back to gemini
  }
  return "gemini";
}

/**
 * Saves selected LLM provider to localStorage.
 */
export function setActiveProvider(provider: LLMProviderId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
    window.dispatchEvent(new CustomEvent("invoicepro-llm-changed", { detail: { provider } }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Gets the configured model for the given provider.
 */
export function getActiveModel(providerId?: LLMProviderId): string {
  const pId = providerId || getActiveProvider();
  const info = AVAILABLE_PROVIDERS.find(p => p.id === pId) || AVAILABLE_PROVIDERS[0];
  if (typeof window === "undefined") return info.defaultModel;

  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_MODEL_PREFIX}${pId}`);
    if (saved && info.supportedModels.includes(saved)) {
      return saved;
    }
  } catch {
    // Return default
  }
  return info.defaultModel;
}

/**
 * Sets the configured model for a provider.
 */
export function setActiveModel(providerId: LLMProviderId, model: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_MODEL_PREFIX}${providerId}`, model);
    window.dispatchEvent(new CustomEvent("invoicepro-llm-changed", { detail: { provider: providerId, model } }));
  } catch {
    // Ignore storage errors
  }
}
