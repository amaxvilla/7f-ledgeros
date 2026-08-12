import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextField, Button, Select } from '../Form';
import { tokens } from '../../tokens';

describe('TextField', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<TextField label="Customer ID" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Customer ID');
    expect(input).toBeInTheDocument();
  });

  it('derives a stable id from the label when none is given', () => {
    render(<TextField label="Move-in date" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Move-in date')).toHaveAttribute('id', 'field-move-in-date');
  });

  it('uses an explicitly-provided id over the derived one', () => {
    render(<TextField label="Customer ID" id="custom-id" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Customer ID')).toHaveAttribute('id', 'custom-id');
  });

  it('calls onChange as the user types', () => {
    const onChange = vi.fn();
    render(<TextField label="Notes" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders an error message and a negative-toned border when error is set', () => {
    // FE-1.6 — `tokens.color.negative` (and every other `tokens.color.*`
    // value) is now `var(--ledgeros-negative)`, not a literal hex value
    // (see `tokens.ts`'s own doc comment). `toHaveStyle`'s internal
    // diffing expands a shorthand like `border` into its own
    // border-width/-style/-color longhands and compares those — jsdom's
    // `cssstyle` package cannot resolve a `var(...)` reference into a
    // longhand `border-color` (it has no real cascade/stylesheet to
    // resolve against), so that comparison spuriously fails under
    // jsdom even though a real browser renders this correctly (the
    // point of the CSS-variable conversion in the first place).
    // `element.style.border` itself, read directly rather than through
    // `toHaveStyle`'s longhand expansion, DOES retain the exact literal
    // string React wrote — confirmed directly against cssstyle's own
    // behavior before changing this assertion, not assumed — so
    // asserting against that string is the correct, still-meaningful
    // check here: it still fails if the border reverts to a plain
    // color, uses the wrong token, or drops the negative tone on error.
    render(<TextField label="Unit ID" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit ID').style.border).toBe(`1px solid ${tokens.color.negative}`);
  });

  it('omits the error message entirely when none is provided', () => {
    const { container } = render(<TextField label="Unit ID" value="" onChange={() => {}} />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('sets aria-invalid and aria-describedby, pointing at the error message, when error is set', () => {
    render(<TextField label="Unit ID" value="" onChange={() => {}} error="Required" />);
    const input = screen.getByLabelText('Unit ID');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('Required')).toHaveAttribute('id', describedBy);
  });

  it('gives the error message role="alert" so assistive tech announces it', () => {
    render(<TextField label="Unit ID" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('omits aria-invalid and aria-describedby entirely when no error is set', () => {
    render(<TextField label="Unit ID" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Unit ID');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('forwards native input props (placeholder, required, type)', () => {
    render(<TextField label="Move-in date" type="date" placeholder="pick a date" required value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Move-in date');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('placeholder', 'pick a date');
    expect(input).toBeRequired();
  });

  it('FC-4 — uses 16px font-size (prevents iOS Safari auto-zoom-on-focus) and 12px vertical padding', () => {
    render(<TextField label="Customer ID" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Customer ID')).toHaveStyle({ fontSize: '16px', padding: '12px 12px' });
  });
});

describe('Select', () => {
  const OPTIONS = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  it('associates the label with the select via htmlFor/id', () => {
    render(<Select label="Status" value="a" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('derives a stable id from the label when none is given', () => {
    render(<Select label="Consolidation parent" value="a" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByLabelText('Consolidation parent')).toHaveAttribute('id', 'field-consolidation-parent');
  });

  it('uses an explicitly-provided id over the derived one', () => {
    render(<Select label="Status" id="custom-id" value="a" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByLabelText('Status')).toHaveAttribute('id', 'custom-id');
  });

  it('renders every option plus a disabled placeholder when one is given', () => {
    render(<Select label="Status" value="" onChange={() => {}} options={OPTIONS} placeholder="Select a status…" />);
    expect(screen.getByRole('option', { name: 'Select a status…' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });

  it('calls onChange as the user picks an option', () => {
    const onChange = vi.fn();
    render(<Select label="Status" value="a" onChange={onChange} options={OPTIONS} />);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders an error message when error is set', () => {
    render(<Select label="Status" value="a" onChange={() => {}} options={OPTIONS} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('sets aria-invalid and aria-describedby, pointing at the error message, when error is set', () => {
    render(<Select label="Status" value="a" onChange={() => {}} options={OPTIONS} error="Required" />);
    const select = screen.getByLabelText('Status');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    const describedBy = select.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('Required')).toHaveAttribute('id', describedBy);
  });

  it('gives the error message role="alert" so assistive tech announces it', () => {
    render(<Select label="Status" value="a" onChange={() => {}} options={OPTIONS} error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('forwards native select props (required)', () => {
    render(<Select label="Status" value="a" onChange={() => {}} options={OPTIONS} required />);
    expect(screen.getByLabelText('Status')).toBeRequired();
  });

  it('FC-4 — uses 16px font-size (prevents iOS Safari auto-zoom-on-focus) and 12px vertical padding', () => {
    render(<Select label="Status" value="a" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByLabelText('Status')).toHaveStyle({ fontSize: '16px', padding: '12px 12px' });
  });

  describe('with an empty options array (FE-10.2)', () => {
    it('renders the default "No options available." message instead of an empty dropdown', () => {
      const { container } = render(<Select label="Parent entity" value="" onChange={() => {}} options={[]} />);
      expect(screen.getByText('No options available.')).toBeInTheDocument();
      expect(container.querySelector('select')).toBeNull();
    });

    it('renders a caller-supplied emptyMessage instead of the default', () => {
      render(<Select label="Parent entity" value="" onChange={() => {}} options={[]} emptyMessage="No other entities exist yet." />);
      expect(screen.getByText('No other entities exist yet.')).toBeInTheDocument();
    });

    it('associates the label with the empty-state element via aria-labelledby (FE-10.7 fix — htmlFor alone cannot label a non-labelable div)', () => {
      render(<Select label="Parent entity" value="" onChange={() => {}} options={[]} />);
      expect(screen.getByLabelText('Parent entity')).toHaveTextContent('No options available.');
    });

    it('ignores placeholder entirely once options is empty — emptyMessage takes over', () => {
      render(<Select label="Parent entity" value="" onChange={() => {}} options={[]} placeholder="Pick a parent…" />);
      expect(screen.queryByText('Pick a parent…')).not.toBeInTheDocument();
      expect(screen.getByText('No options available.')).toBeInTheDocument();
    });
  });
});

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Add tenant</Button>);
    expect(screen.getByRole('button', { name: 'Add tenant' })).toBeInTheDocument();
  });

  it('defaults to the primary variant styling', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({ background: tokens.color.accent, color: tokens.color.bg });
  });

  it('FC-4 — uses 12px vertical padding, a real (if modest) mobile touch-target improvement for every form\'s primary submit control', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({ padding: '12px 16px' });
  });

  it('applies secondary variant styling when requested', () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveStyle({ background: 'transparent', color: tokens.color.textPrimary });
  });

  it('reduces opacity and shows a not-allowed cursor when disabled', () => {
    render(<Button disabled>Adding…</Button>);
    expect(screen.getByRole('button', { name: 'Adding…' })).toHaveStyle({ opacity: '0.6', cursor: 'not-allowed' });
  });

  it('is a real disabled button element when disabled', () => {
    render(<Button disabled>Adding…</Button>);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('forwards onClick and other native button props', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add tenant</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Add tenant' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
