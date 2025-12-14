"use client";

import CustomSelect from "./CustomSelect";

const CATEGORIES = [
  { value: "Fashion", label: "Fashion" },
  { value: "Sport", label: "Sport" },
  { value: "Entertainment", label: "Entertainment" },
  { value: "Dining", label: "Dining" },
  { value: "Travel", label: "Travel" },
  { value: "Lifestyle & Wellness", label: "Lifestyle & Wellness" },
  { value: "Technology", label: "Technology" },
  { value: "Beauty", label: "Beauty" },
  { value: "Health", label: "Health" },
  { value: "Education", label: "Education" },
  { value: "Home & Garden", label: "Home & Garden" },
  { value: "Automotive", label: "Automotive" },
  { value: "Work", label: "Work" },
  { value: "Retail", label: "Retail" },
  { value: "Services", label: "Services" },
  { value: "Gaming", label: "Gaming" },
  { value: "Music", label: "Music" },
  { value: "Art & Culture", label: "Art & Culture" },
  { value: "Fitness", label: "Fitness" },
  { value: "Food & Beverage", label: "Food & Beverage" },
];

type CategorySelectProps = {
  value?: string;
  onChange: (category: string) => void;
  placeholder?: string;
};

export default function CategorySelect({
  value,
  onChange,
  placeholder = "Select category",
}: CategorySelectProps) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={CATEGORIES}
      placeholder={placeholder}
      maxHeight="200px"
    />
  );
}
