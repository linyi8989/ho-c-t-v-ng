import React, { useEffect, useMemo, useState } from "react";
import { Check, ImagePlus, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import type { VocabItem, VocabImageGenerationProviderId } from "../../../types";
import type {
  ManagedVocabImageAsset,
  VocabImageGenerationResult,
  VocabImageProviderOption,
} from "./types";

interface VocabImageGenerateDialogProps {
  item: VocabItem | null;
  providers: VocabImageProviderOption[];
  onClose: () => void;
  onLoadPrompt: (item: VocabItem) => Promise<string>;
  onGenerate: (provider: VocabImageGenerationProviderId, item: VocabItem, prompt: string) => Promise<VocabImageGenerationResult>;
  onApplied: (itemId: string, asset: ManagedVocabImageAsset) => void;
}

export function VocabImageGenerateDialog({ item, providers, onClose, onLoadPrompt, onGenerate, onApplied }: VocabImageGenerateDialogProps) {
  const configured = useMemo(() => providers.filter(provider => provider.configured), [providers]);
  const [providerId, setProviderId] = useState<VocabImageGenerationProviderId>("stali");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [result, setResult] = useState<VocabImageGenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setProviderId(configured[0]?.id || "stali");
    setResult(null);
    setError("");
  }, [item?.id, configured]);

  useEffect(() => {
    let cancelled = false;
    if (!item) {
      setDefaultPrompt("");
      setPrompt("");
      setPromptLoading(false);
      return () => { cancelled = true; };
    }
    setDefaultPrompt("");
    setPrompt("");
    setPromptLoading(true);
    setError("");
    onLoadPrompt(item)
      .then(value => {
        if (cancelled) return;
        setDefaultPrompt(value);
        setPrompt(value);
      })
      .catch((requestError: any) => {
        if (cancelled) return;
        setError(requestError?.message || "Không tải được prompt mặc định.");
      })
      .finally(() => {
        if (!cancelled) setPromptLoading(false);
      });
    return () => { cancelled = true; };
  }, [item?.id, item?.term, item?.meaning, item?.pos]);

  if (!item) return null;
  const selectedProvider = providers.find(provider => provider.id === providerId);

  const generate = async () => {
    if (!prompt.trim()) {
      setError("Prompt tạo ảnh không được để trống.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const generated = await onGenerate(providerId, item, prompt);
      setResult(generated);
      setPrompt(generated.prompt);
    } catch (requestError: any) {
      setResult(null);
      setError(requestError?.message || "Không tạo được ảnh cho từ này.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={`Tạo ảnh cho ${item.term}`}>
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Tạo ảnh cho “{item.term}”</h3>
            <p className="mt-1 text-xs text-slate-500">AI tạo ảnh flashcard 3D tỷ lệ 4:3, phủ kín khung và không chữ để dùng thống nhất trong các trò chơi từ vựng.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={20} /></button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-xs font-black text-slate-600">
            Dịch vụ tạo ảnh
            <select value={providerId} onChange={event => { setProviderId(event.target.value as VocabImageGenerationProviderId); setResult(null); }} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold">
              {providers.map(provider => (
                <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                  {provider.label} · {provider.model}{provider.configured ? "" : " · chưa cấu hình"}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void generate()} disabled={loading || promptLoading || !prompt.trim() || !item.term.trim() || !selectedProvider?.configured} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:bg-slate-300">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {result ? "Tạo lại" : "Tạo ảnh"}
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="vocab-image-custom-prompt" className="text-xs font-black text-slate-700">Prompt gửi tới AI</label>
            <button
              type="button"
              onClick={() => setPrompt(defaultPrompt)}
              disabled={loading || promptLoading || !defaultPrompt || prompt === defaultPrompt}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={12} /> Khôi phục mặc định
            </button>
          </div>
          <div className="relative">
            <textarea
              id="vocab-image-custom-prompt"
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              disabled={loading || promptLoading}
              maxLength={8000}
              rows={8}
              placeholder={promptLoading ? "Đang tải prompt mặc định..." : "Nhập prompt tạo ảnh..."}
              className="block w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-xs leading-5 text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white disabled:cursor-wait disabled:text-slate-400"
            />
            {promptLoading && <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-indigo-500" />}
          </div>
          <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] text-slate-500">
            <p>Nội dung trong ô này được gửi cho model ở lần tạo riêng lẻ. Luồng tạo hàng loạt vẫn dùng prompt mặc định.</p>
            <span className="shrink-0 font-mono">{prompt.length.toLocaleString("vi-VN")}/8.000</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Mỗi lần bấm tạo sẽ gọi dịch vụ AI và có thể phát sinh chi phí. Ảnh chỉ được gắn vào bộ từ sau khi bạn bấm “Dùng ảnh này” và lưu bộ từ.
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

        <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500"><Loader2 size={32} className="animate-spin" /><p className="text-sm font-bold">AI đang tạo ảnh, vui lòng chờ...</p></div>
          ) : result ? (
            <>
              <div className="flex h-72 w-96 max-w-full items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm"><img src={result.asset.publicUrl} alt={`Ảnh AI cho ${item.term}`} className="h-full w-full object-contain" /></div>
              <p className="mt-3 text-xs font-bold text-slate-500">{selectedProvider?.label} · {result.model}</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400"><ImagePlus size={38} /><p className="text-sm font-semibold">Chọn dịch vụ rồi bấm “Tạo ảnh”.</p></div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Đóng</button>
          <button type="button" onClick={() => result && onApplied(item.id, result.asset)} disabled={!result} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:bg-slate-300"><Check size={16} />Dùng ảnh này</button>
        </div>
      </div>
    </div>
  );
}
