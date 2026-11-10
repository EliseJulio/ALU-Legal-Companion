import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import StatusPill from '@/components/StatusPill';
import { ADMIN_BACK_LINK } from '@/components/AdminRecords';
import { CARD, PAGE_TITLE } from '@/lib/ui';

// The frame every record editor shares so the four editors (routes and guides and checklists and entries) cannot drift apart.
// It has a way back to the list then the breadcrumb then the heading then the status then ONE card holding the form.
// Save and Cancel belong to each form.
// `above` is an optional block between the status and the card for an action on the record (such as publish).
// Put nothing else in a card here. A card inside this card is a double border.
export default function AdminEditorPage({ title, status, backTo, backLabel, above = null, children }) {
  return (
    <div>
      <p className="text-sm">
        <Link to={backTo} className={ADMIN_BACK_LINK}>← {backLabel}</Link>
      </p>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current={title} />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>{title}</h1>
      {status && <p className="mt-2 flex items-center gap-2 text-sm">Status: <StatusPill status={status} /></p>}
      {above}
      <div className={`mt-4 ${CARD}`}>{children}</div>
    </div>
  );
}
