import React from 'react';
import type { SmartImportCrop } from './types';

export default function CropPreview({ imageUrl, crop, label }: { imageUrl?: string; crop: SmartImportCrop; label: string }) {
  return (
    <div className="space-y-1">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Crop ${label}`}
            className="pointer-events-none absolute max-w-none"
            style={{
              left: `${-(crop.x / crop.width) * 100}%`,
              top: `${-(crop.y / crop.height) * 100}%`,
              width: `${100 / crop.width}%`,
              height: `${100 / crop.height}%`,
            }}
          />
        ) : null}
      </div>
      <p className="text-center text-[10px] font-black text-slate-500">{label}</p>
    </div>
  );
}
