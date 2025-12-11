"use client";

import { getNames } from "country-list";
import CustomSelect from "./CustomSelect";

type CountrySelectProps = {
  value?: string;
  onChange: (country: string) => void;
  placeholder?: string;
};

export default function CountrySelect({
  value,
  onChange,
  placeholder = "Select country",
}: CountrySelectProps) {
  const countries = getNames();
  const sortedCountries = Object.entries(countries)
    .map(([, name]) => ({ name: name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const options = sortedCountries.map(({ name }) => ({
    value: name,
    label: name,
  }));

  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      maxHeight="200px"
    />
  );
}
