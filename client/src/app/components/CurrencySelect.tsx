"use client";

import getSymbolFromCurrency from "currency-symbol-map";
import CustomSelect from "./CustomSelect";

const COMMON_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "INR", name: "Indian Rupee" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "ZAR", name: "South African Rand" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "KRW", name: "South Korean Won" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "SOL", name: "Solana" },
  { code: "USDC", name: "USD Coin" },
];

type CurrencySelectProps = {
  value?: string;
  onChange: (code: string) => void;
  placeholder?: string;
};

export default function CurrencySelect({
  value,
  onChange,
  placeholder = "Select currency",
}: CurrencySelectProps) {
  const options = COMMON_CURRENCIES.map((currency) => {
    const symbol = getSymbolFromCurrency(currency.code) || currency.code;
    return {
      value: currency.code,
      label: `${currency.name} (${currency.code}) ${symbol}`,
    };
  });

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
