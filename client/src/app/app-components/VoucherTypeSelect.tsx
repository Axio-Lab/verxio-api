"use client";

import CustomSelect from "./CustomSelect";

const VOUCHER_TYPES = [
  { value: "default", label: "Default" },
  { value: "percentage_off", label: "Percentage Off" },
  { value: "fixed_amount_off", label: "Fixed Amount Off" },
  { value: "buy_one_get_one", label: "Buy One Get One" },
  { value: "custom_reward", label: "Custom Reward" },
  { value: "free_shipping", label: "Free Shipping" },
  { value: "free_delivery", label: "Free Delivery" },
  { value: "free_gift", label: "Free Gift" },
  { value: "free_item", label: "Free Item" },
  { value: "free_trial", label: "Free Trial" },
  { value: "free_sample", label: "Free Sample" },
  { value: "free_consultation", label: "Free Consultation" },
  { value: "free_repair", label: "Free Repair" },
];

type VoucherTypeSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function VoucherTypeSelect({
  value,
  onChange,
  placeholder = "Select voucher type",
}: VoucherTypeSelectProps) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={VOUCHER_TYPES}
      placeholder={placeholder}
      maxHeight="200px"
    />
  );
}
