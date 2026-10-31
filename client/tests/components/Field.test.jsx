import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Field, { CheckField } from '@/components/Field';
import ErrorNotice from '@/components/ErrorNotice';
import SubmitForReview from '@/components/SubmitForReview';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

describe('Field', () => {
  it('ties the label to the box', () => {
    render(<Field id="name" label="Name" defaultValue="Test" />);
    expect(screen.getByLabelText('Name')).toHaveValue('Test');
  });

  it('ties a hint to the box so it is read with the label', () => {
    render(<Field id="law" label="The law" hint="For example Law No. 00/0000." />);
    expect(screen.getByLabelText('The law')).toHaveAccessibleDescription('For example Law No. 00/0000.');
  });

  it('can be a text area or a select', () => {
    render(
      <>
        <Field id="long" label="Long text" as="textarea" rows={3} />
        <Field id="pick" label="Pick" as="select"><option value="a">A</option><option value="b">B</option></Field>
      </>,
    );
    expect(screen.getByLabelText('Long text').tagName).toBe('TEXTAREA');
    expect(screen.getByRole('combobox', { name: 'Pick' })).toBeInTheDocument();
  });

  it('has a box that is at least 44 px high', () => {
    render(<Field id="name" label="Name" />);
    expect(screen.getByLabelText('Name').className).toMatch(/min-h-touch/);
  });
});

describe('CheckField', () => {
  it('reports the new value when ticked', async () => {
    const onChange = vi.fn();
    render(<CheckField id="free" label="It is free" checked={false} onChange={onChange} />);
    await userEvent.setup({ delay: null }).click(screen.getByLabelText('It is free'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('can be tied to a message and marked invalid, so a screen reader reads why', () => {
    render(<CheckField id="free" label="It is free" checked={false} onChange={() => {}} describedBy="problem" invalid />);
    const box = screen.getByLabelText('It is free');
    expect(box).toHaveAttribute('aria-describedby', 'problem');
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('carries neither attribute when nothing is wrong', () => {
    render(<CheckField id="free" label="It is free" checked={false} onChange={() => {}} />);
    const box = screen.getByLabelText('It is free');
    expect(box).not.toHaveAttribute('aria-describedby');
    expect(box).not.toHaveAttribute('aria-invalid');
  });
});

describe('ErrorNotice', () => {
  it('takes an id so a control can point at it', () => {
    render(<ErrorNotice error={{ message: 'Something went wrong' }} id="problem" />);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'problem');
  });
});

describe('SubmitForReview', () => {
  const show = (onDone = vi.fn()) => {
    render(<MemoryRouter><SubmitForReview path="/guides/3" onDone={onDone} /></MemoryRouter>);
    return onDone;
  };

  it('publishes the record and reloads', async () => {
    global.fetch = vi.fn().mockResolvedValue(reply(200, { id: 3, status: 'published' }));
    const onDone = show();
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Publish' }));
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/guides\/3\/publish$/);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the server message and does not reload when it is refused', async () => {
    global.fetch = vi.fn().mockResolvedValue(reply(400, { error: 'That guide could not be found or is already published' }));
    const onDone = show();
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('That guide could not be found or is already published')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
