// Where the small picture of yourself sits on the call stage.
// It rests in one of four corners. Dragging or the arrow keys move it to another.

export const CORNER_CLASS = {
  'top-left': 'left-3 top-3',
  'top-right': 'right-3 top-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

// The corner closest to a point. The point and the stage use the same units.
export function nearestCorner(center, stage) {
  const vertical = center.y < stage.height / 2 ? 'top' : 'bottom';
  const horizontal = center.x < stage.width / 2 ? 'left' : 'right';
  return `${vertical}-${horizontal}`;
}

// One step to the next corner for an arrow key. Any other key changes nothing.
export function moveCorner(corner, key) {
  const [vertical, horizontal] = corner.split('-');
  if (key === 'ArrowLeft') return `${vertical}-left`;
  if (key === 'ArrowRight') return `${vertical}-right`;
  if (key === 'ArrowUp') return `top-${horizontal}`;
  if (key === 'ArrowDown') return `bottom-${horizontal}`;
  return corner;
}
