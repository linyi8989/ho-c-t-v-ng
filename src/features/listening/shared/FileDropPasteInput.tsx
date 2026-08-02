import React, { useRef, useState } from 'react';
import { ClipboardPaste, Upload } from 'lucide-react';

interface FileDropPasteInputProps {
  accept: string;
  disabled?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  pasteImages?: boolean;
  uploadLabel?: string;
  onFiles: (files: File[]) => Promise<void> | void;
}

const acceptedTypes = (accept: string) => accept
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

const isAcceptedFile = (file: File, accept: string) => {
  const rules = acceptedTypes(accept);
  if (!rules.length) return true;
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  return rules.some(rule => {
    if (rule.startsWith('.')) return fileName.endsWith(rule);
    if (rule.endsWith('/*')) return mimeType.startsWith(rule.slice(0, -1));
    return mimeType === rule;
  });
};

const filesFromList = (list: FileList) => {
  const files: File[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const file = list.item(index);
    if (file) files.push(file);
  }
  return files;
};

export default function FileDropPasteInput({
  accept,
  disabled = false,
  multiple = false,
  maxFiles = multiple ? 20 : 1,
  pasteImages = false,
  uploadLabel = 'Tải lên',
  onFiles,
}: FileDropPasteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const processFiles = async (incoming: File[]) => {
    if (disabled || busyRef.current) return;
    const files = incoming.filter(file => isAcceptedFile(file, accept)).slice(0, maxFiles);
    if (!files.length) {
      setMessage('Không tìm thấy tệp đúng định dạng để tải lên.');
      return;
    }
    setMessage('');
    busyRef.current = true;
    setBusy(true);
    try {
      await onFiles(files);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Không thể tải tệp lên.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? filesFromList(event.target.files) : [];
    event.target.value = '';
    void processFiles(files);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!pasteImages || disabled || busy) return;
    const files: File[] = [];
    for (let index = 0; index < event.clipboardData.items.length; index += 1) {
      const item = event.clipboardData.items[index];
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (!files.length) {
      setMessage('Clipboard chưa có ảnh. Hãy copy ảnh rồi nhấn Ctrl+V tại vùng này.');
      return;
    }
    event.preventDefault();
    void processFiles(files);
  };

  const readClipboard = async () => {
    dropZoneRef.current?.focus();
    if (!pasteImages || !navigator.clipboard?.read) {
      setMessage('Hãy copy ảnh, chọn vùng này rồi nhấn Ctrl+V.');
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of clipboardItems) {
        for (const type of item.types.filter(value => value.startsWith('image/'))) {
          const blob = await item.getType(type);
          const extension = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
          files.push(new File([blob], `clipboard-${Date.now()}.${extension}`, { type }));
        }
      }
      if (!files.length) {
        setMessage('Clipboard chưa có ảnh. Hãy copy ảnh rồi thử lại.');
        return;
      }
      await processFiles(files);
    } catch {
      setMessage('Trình duyệt chưa cấp quyền đọc clipboard. Hãy chọn vùng này rồi nhấn Ctrl+V.');
    }
  };

  const inactive = disabled || busy;

  return (
    <div
      ref={dropZoneRef}
      tabIndex={inactive ? -1 : 0}
      onPaste={handlePaste}
      onDragEnter={event => {
        event.preventDefault();
        if (!inactive) setDragActive(true);
      }}
      onDragOver={event => {
        event.preventDefault();
        if (!inactive) event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={event => {
        const relatedTarget = event.relatedTarget;
        if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) setDragActive(false);
      }}
      onDrop={event => {
        event.preventDefault();
        setDragActive(false);
        void processFiles(filesFromList(event.dataTransfer.files));
      }}
      onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && !inactive) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label={pasteImages ? 'Tải, kéo thả hoặc dán ảnh từ clipboard' : 'Tải hoặc kéo thả tệp'}
      className={`rounded-xl border-2 border-dashed p-2 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200 ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={inactive}
        onChange={handleInput}
        className="hidden"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-slate-500">
          {dragActive ? 'Thả tệp vào đây' : pasteImages ? 'Kéo thả ảnh hoặc dán trực tiếp bằng Ctrl+V' : 'Kéo thả tệp vào đây'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={inactive}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700 disabled:opacity-50"
          >
            <Upload size={13} /> {busy ? 'Đang tải…' : uploadLabel}
          </button>
          {pasteImages && (
            <button
              type="button"
              disabled={inactive}
              onClick={() => void readClipboard()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-black text-violet-700 disabled:opacity-50"
            >
              <ClipboardPaste size={13} /> Dán ảnh
            </button>
          )}
        </div>
      </div>
      {message && <p role="status" className="mt-1.5 text-[10px] font-bold text-amber-700">{message}</p>}
    </div>
  );
}
