// One icon from the icon font. It is decoration. The words next to it carry the meaning.
// `name` is the glyph name such as "menu". The font file holds only the glyphs the app uses.
export default function Icon({ name, className = '' }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}
