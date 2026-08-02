export const MOVER_COLOUR_CATALOG = [
  { label: 'Red', value: '#EF4444' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#16A34A' },
  { label: 'Yellow', value: '#FACC15' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Purple', value: '#7C3AED' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Brown', value: '#92400E' },
  { label: 'Black', value: '#111827' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Grey', value: '#6B7280' },
  { label: 'Light Blue', value: '#7DD3FC' },
  { label: 'Dark Blue', value: '#1E3A8A' },
  { label: 'Light Green', value: '#86EFAC' },
  { label: 'Dark Green', value: '#166534' },
  { label: 'Light Pink', value: '#F9A8D4' },
  { label: 'Dark Red', value: '#991B1B' },
  { label: 'Beige', value: '#D6C7A1' },
  { label: 'Gold', value: '#D4A017' },
  { label: 'Silver', value: '#A8A9AD' },
] as const;

export const DEFAULT_MOVER_COLOURS = ['Red', 'Purple', 'Orange', 'Blue', 'Green', 'Yellow'] as const;

export function findMoverColour(label: string, value: string) {
  return MOVER_COLOUR_CATALOG.find(colour => (
    colour.label.toLowerCase() === label.toLowerCase()
    || colour.value.toLowerCase() === value.toLowerCase()
  ));
}
