type RowBox = Pick<DOMRect, 'top' | 'bottom' | 'height'>;

export function contourPosition(row: RowBox, listTop: number, span: number, edge?: 'top' | 'bottom') {
  // A wrapping title must not move its own width anchor. Use the fixed half-height
  // of a minimum 60px row, from the edge that is held still by the scroll position.
  const anchor = edge === 'top' ? row.top + 30 : edge === 'bottom' ? row.bottom - 30 : row.top + row.height / 2;
  return Math.max(0, Math.min(1, (anchor - listTop) / span));
}
