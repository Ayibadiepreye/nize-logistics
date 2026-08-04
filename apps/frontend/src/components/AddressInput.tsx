'use client';

interface AddressInputProps {
  value: string;
  onChange: (address: string) => void;
  placeholder: string;
  label: string;
}

export default function AddressInput({ value, onChange, placeholder, label }: AddressInputProps) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
