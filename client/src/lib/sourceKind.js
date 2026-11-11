// What kind of document a guide's source is, read from its name. A Law is enacted by Parliament. An Order is not.
// When the source names both or neither the words stay neutral rather than guess.
export function instrumentOf(sourceLaw) {
  const text = String(sourceLaw ?? '');
  const hasLaw = /\blaw\b/i.test(text);
  const hasOrder = /\border\b/i.test(text);
  if (hasLaw && !hasOrder) {
    return { badge: 'Enacted statute', note: 'Enacted by the Parliament of Rwanda. Published under the authority of the Republic of Rwanda.' };
  }
  if (hasOrder && !hasLaw) {
    const badge = /ministerial/i.test(text) ? 'Ministerial order' : 'Order';
    return { badge, note: 'Issued under the authority of the Republic of Rwanda.' };
  }
  return { badge: 'Official source', note: 'Published under the authority of the Republic of Rwanda.' };
}
