import React, { useState, useEffect } from "react";
import { 
  getActiveProvider, 
  setActiveProvider, 
  getActiveModel, 
  setActiveModel, 
  AVAILABLE_PROVIDERS 
} from "../utils/aiConfig";
import { LLMProviderId } from "../types";
import { Sparkles, Cpu, ChevronDown, Check } from "lucide-react";

interface LLMProviderSelectorProps {
  compact?: boolean;
  className?: string;
  id?: string;
  showModelSubtext?: boolean;
}

export default function LLMProviderSelector({
  compact = false,
  className = "",
  id = "llm-provider-selector",
  showModelSubtext = true
}: LLMProviderSelectorProps) {
  const [currentProvider, setCurrentProvider] = useState<LLMProviderId>(getActiveProvider());
  const [currentModel, setCurrentModel] = useState<string>(getActiveModel());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setCurrentProvider(getActiveProvider());
      setCurrentModel(getActiveModel());
    };

    window.addEventListener("invoicepro-llm-changed", handleUpdate);
    return () => window.removeEventListener("invoicepro-llm-changed", handleUpdate);
  }, []);

  const selectedConfig = AVAILABLE_PROVIDERS.find(p => p.id === currentProvider) || AVAILABLE_PROVIDERS[0];

  const handleSelectProvider = (pId: LLMProviderId, modelId: string) => {
    setActiveProvider(pId);
    setActiveModel(pId, modelId);
    setCurrentProvider(pId);
    setCurrentModel(modelId);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
        title="Select AI Model Provider"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {selectedConfig.id === "gemini" ? (
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        ) : (
          <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        <span className="font-medium text-[11px]">{selectedConfig.name}</span>
        {showModelSubtext && (
          <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
            ({currentModel})
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          {/* Menu */}
          <div className="absolute right-0 mt-1.5 w-64 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-fade-in-up">
            <div className="px-2 py-1.5 border-b border-white/5 mb-1 text-[11px] font-semibold text-slate-400">
              Select AI Engine
            </div>

            {AVAILABLE_PROVIDERS.map((provider) => {
              const isSelected = provider.id === currentProvider;
              return (
                <div key={provider.id} className="space-y-1 mb-1">
                  <div
                    onClick={() => handleSelectProvider(provider.id, provider.defaultModel)}
                    className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
                        : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {provider.id === "gemini" ? (
                        <div className="p-1 bg-indigo-500/10 rounded text-indigo-400">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 bg-emerald-500/10 rounded text-emerald-400">
                          <Cpu className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-xs flex items-center space-x-1.5">
                          <span>{provider.name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-300 font-normal">
                            {provider.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          {provider.defaultModel}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}

            <div className="px-2 pt-1.5 border-t border-white/5 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Keys stored securely server-side</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
