import React, { useEffect, useState } from "react";
import type { VocabItem } from "../../types";

interface VocabItemImageProps {
  item: VocabItem;
  revealAnswer?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

export default function VocabItemImage({
  item,
  revealAnswer = false,
  className = "",
}: VocabItemImageProps) {
  const source = item as VocabItem & { image?: string };
  const imageUrl = item.imageUrl || source.image;
  const [failedUrl, setFailedUrl] = useState("");

  useEffect(() => setFailedUrl(""), [imageUrl]);

  if (!imageUrl || failedUrl === imageUrl) return null;
  const alt = revealAnswer
    ? `Ảnh minh họa cho ${item.term}`
    : "Ảnh minh họa cho câu hỏi từ vựng";

  return (
    <figure className={`flex flex-col items-center ${className}`} data-vocab-item-image>
      <div className="flex h-36 w-48 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white md:h-48 md:w-64">
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(imageUrl)}
        />
      </div>
    </figure>
  );
}
