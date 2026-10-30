// A button that is busy or not ready yet is marked aria-disabled and not `disabled`. A disabled
// button loses keyboard focus, so a person pressing it is thrown back to the top of the page.
// aria-disabled keeps focus where it is and still tells a screen reader the button is off.
// The catch is that the browser still sends the click. This stops that click before any page
// code sees it, for a pointer, for Enter and Space, and for Enter inside a form.
function stopClick(event) {
  const target = event.target instanceof Element ? event.target.closest('[aria-disabled="true"]') : null;
  if (!target || !['BUTTON', 'A'].includes(target.tagName)) return;
  event.preventDefault();
  event.stopPropagation();
}

export function blockAriaDisabledClicks(doc = document) {
  doc.addEventListener('click', stopClick, true);
  return () => doc.removeEventListener('click', stopClick, true);
}
