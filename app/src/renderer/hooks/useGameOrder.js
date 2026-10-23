import { useSortableOrder } from "./useSortableOrder.js";
function useGameOrder(games, sortable = false) {
  return useSortableOrder(
    [...games].sort(
      (a, b) =>
        Number(Boolean(b.modFolderPath)) - Number(Boolean(a.modFolderPath)),
    ),
    "qaqm.gameOrder",
    sortable,
  );
}
export { useGameOrder };
