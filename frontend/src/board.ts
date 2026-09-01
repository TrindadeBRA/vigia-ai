export type CardSize = "lg" | "sm";

export type BoardLayout = {
  order: string[];
  size: Record<string, CardSize>;
};

export function emptyBoard(): BoardLayout {
  return { order: [], size: {} };
}

export function syncBoard(ids: string[], board: BoardLayout | undefined): BoardLayout {
  const prev = board || emptyBoard();
  const seen = new Set(ids);
  const order = [...prev.order.filter((id) => seen.has(id)), ...ids.filter((id) => !prev.order.includes(id))];
  const size: Record<string, CardSize> = {};
  for (const id of order) {
    size[id] = prev.size[id] === "sm" ? "sm" : "lg";
  }
  return { order, size };
}

export function moveId(order: string[], from: string, to: string): string[] {
  if (from === to) return order;
  const next = order.filter((id) => id !== from);
  const i = next.indexOf(to);
  if (i < 0) return order;
  next.splice(i, 0, from);
  return next;
}
