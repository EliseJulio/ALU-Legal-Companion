import { useRef, useState } from 'react';
import { CORNER_CLASS, nearestCorner, moveCorner } from '@/lib/callLayout';
import { RING } from '@/lib/ui';

// The small picture of yourself. Drag it and it settles in the nearest corner of the area.
// The arrow keys move it too. The area is the element the corners belong to.
export default function DraggablePreview({ areaRef, children }) {
  const [corner, setCorner] = useState('top-right');
  const [drag, setDrag] = useState(null);
  const box = useRef(null);

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 });
  }

  function onPointerMove(e) {
    setDrag((d) => (d ? { ...d, dx: e.clientX - d.startX, dy: e.clientY - d.startY } : d));
  }

  function onPointerUp() {
    if (!drag) return;
    const area = areaRef.current?.getBoundingClientRect();
    const me = box.current?.getBoundingClientRect();
    if (area && me) {
      const center = { x: me.left + me.width / 2 - area.left, y: me.top + me.height / 2 - area.top };
      setCorner(nearestCorner(center, { width: area.width, height: area.height }));
    }
    setDrag(null);
  }

  function onKeyDown(e) {
    const next = moveCorner(corner, e.key);
    if (next === corner) return;
    e.preventDefault();
    setCorner(next);
  }

  return (
    <div
      ref={box}
      role="group"
      tabIndex={0}
      aria-label="Your camera. Drag it or use the arrow keys to move it."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
      className={`absolute z-10 aspect-[3/4] w-1/4 touch-none select-none overflow-hidden rounded-control border border-inverse-foreground bg-inverse sm:aspect-video sm:w-1/5 ${drag ? 'cursor-grabbing' : 'cursor-grab'} ${CORNER_CLASS[corner]} ${RING}`}
    >
      {children}
    </div>
  );
}
