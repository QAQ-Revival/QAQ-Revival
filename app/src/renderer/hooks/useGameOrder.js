import { useSortableOrder } from "./useSortableOrder.js";
import React from "react";
const isVisible = (game) => game.hidden !== true;
function useGameOrder(games, sortable = false) {
  const defaults = React.useMemo(
    () =>
      [...games].sort(
        (a, b) =>
          Number(Boolean(b.modFolderPath)) - Number(Boolean(a.modFolderPath)),
      ),
    [games],
  );
  return useSortableOrder(defaults, "qaqm.gameOrder", sortable, isVisible);
}
export { useGameOrder };
