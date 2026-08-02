import type { ListeningRegion } from '../../../../listening/types';

export const createMoverEditorId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const createMoverDefaultRegion = (index: number): ListeningRegion => ({
  shape: 'rect',
  x: 0.06 + (index % 3) * 0.31,
  y: 0.12 + Math.floor(index / 3) * 0.42,
  width: 0.12,
  height: 0.055,
});
