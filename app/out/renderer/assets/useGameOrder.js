import { useSortableOrder } from './useSortableOrder.js';

// Both the sidebar and settings follow the saved order, then configured games first.
export function useGameOrder(games, sortable = false) {
  return useSortableOrder(
    [...games].sort((a, b) => Number(Boolean(b.modFolderPath)) - Number(Boolean(a.modFolderPath))),
    'qaqm.gameOrder', sortable
  );
}
