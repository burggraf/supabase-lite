import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RowEditPanel } from '../RowEditPanel';
import type { ColumnInfo } from '@/types';

const mockColumns: ColumnInfo[] = [
  {
    column_name: 'id',
    data_type: 'uuid',
    is_nullable: 'NO',
    column_default: null,
    is_primary_key: true,
  },
  {
    column_name: 'name',
    data_type: 'text',
    is_nullable: 'NO',
    column_default: null,
    is_primary_key: false,
  },
  {
    column_name: 'age',
    data_type: 'integer',
    is_nullable: 'YES',
    column_default: null,
    is_primary_key: false,
  },
  {
    column_name: 'active',
    data_type: 'boolean',
    is_nullable: 'YES',
    column_default: 'true',
    is_primary_key: false,
  },
];

const mockRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  age: 30,
  active: true,
};

const mockOnSave = vi.fn();
const mockOnClose = vi.fn();

describe('RowEditPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when not open', () => {
    render(
      <RowEditPanel
        isOpen={false}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    expect(screen.queryByText('Update row from users')).not.toBeInTheDocument();
  });

  it('should render when open with correct title', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Update row from users')).toBeInTheDocument();
    expect(screen.getByText('Edit the values for this row and save your changes')).toBeInTheDocument();
  });

  it('should display all columns with their data types', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('uuid')).toBeInTheDocument();
    expect(screen.getByText('PK')).toBeInTheDocument();

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();

    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getByText('integer')).toBeInTheDocument();

    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('boolean')).toBeInTheDocument();
  });

  it('should populate form fields with row data', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    const idInput = screen.getByDisplayValue('123e4567-e89b-12d3-a456-426614174000');
    const nameInput = screen.getByDisplayValue('John Doe');
    const ageInput = screen.getByDisplayValue('30');
    const activeSelect = screen.getByDisplayValue('true') as HTMLSelectElement;

    expect(idInput).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(ageInput).toBeInTheDocument();
    expect(activeSelect.value).toBe('true');
  });

  it('should call onClose when cancel button is clicked', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when X button is clicked', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onSave with updated data when save button is clicked', async () => {
    mockOnSave.mockResolvedValue(true);

    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    // Update the name field
    const nameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    // Update the age field
    const ageInput = screen.getByDisplayValue('30');
    fireEvent.change(ageInput, { target: { value: '25' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Jane Doe',
        age: 25, // Should be converted to number
        active: true,
      });
    });
  });

  it('should handle boolean field changes', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    const activeSelect = screen.getByDisplayValue('true') as HTMLSelectElement;
    fireEvent.change(activeSelect, { target: { value: 'false' } });

    expect(activeSelect.value).toBe('false');
  });

  it('should close panel after successful save', async () => {
    mockOnSave.mockResolvedValue(true);

    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should not close panel after failed save', async () => {
    mockOnSave.mockResolvedValue(false);

    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    // Panel should remain open
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should group required and optional fields correctly', () => {
    render(
      <RowEditPanel
        isOpen={true}
        onClose={mockOnClose}
        row={mockRow}
        columns={mockColumns}
        tableName="users"
        schema="public"
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Required Fields')).toBeInTheDocument();
    expect(screen.getByText('Optional Fields')).toBeInTheDocument();
    expect(screen.getByText('These are columns that do not need any value')).toBeInTheDocument();
  });
});