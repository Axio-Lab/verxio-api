/**
 * Comprehensive list of IANA timezone identifiers
 * Organized by region for easier selection
 * Includes GMT/UTC offsets in labels
 */
export const timezones = [
  // UTC
  { value: "UTC", label: "UTC (GMT+0)" },

  // North America
  { value: "America/New_York", label: "Eastern Time (US & Canada) - GMT-5/-4" },
  { value: "America/Chicago", label: "Central Time (US & Canada) - GMT-6/-5" },
  { value: "America/Denver", label: "Mountain Time (US & Canada) - GMT-7/-6" },
  { value: "America/Phoenix", label: "Arizona - GMT-7" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada) - GMT-8/-7" },
  { value: "America/Anchorage", label: "Alaska - GMT-9/-8" },
  { value: "America/Honolulu", label: "Hawaii - GMT-10" },
  { value: "America/Toronto", label: "Toronto - GMT-5/-4" },
  { value: "America/Vancouver", label: "Vancouver - GMT-8/-7" },
  { value: "America/Mexico_City", label: "Mexico City - GMT-6/-5" },

  // Europe
  { value: "Europe/London", label: "London - GMT+0/+1" },
  { value: "Europe/Paris", label: "Paris - GMT+1/+2" },
  { value: "Europe/Berlin", label: "Berlin - GMT+1/+2" },
  { value: "Europe/Rome", label: "Rome - GMT+1/+2" },
  { value: "Europe/Madrid", label: "Madrid - GMT+1/+2" },
  { value: "Europe/Amsterdam", label: "Amsterdam - GMT+1/+2" },
  { value: "Europe/Brussels", label: "Brussels - GMT+1/+2" },
  { value: "Europe/Vienna", label: "Vienna - GMT+1/+2" },
  { value: "Europe/Stockholm", label: "Stockholm - GMT+1/+2" },
  { value: "Europe/Copenhagen", label: "Copenhagen - GMT+1/+2" },
  { value: "Europe/Oslo", label: "Oslo - GMT+1/+2" },
  { value: "Europe/Helsinki", label: "Helsinki - GMT+2/+3" },
  { value: "Europe/Warsaw", label: "Warsaw - GMT+1/+2" },
  { value: "Europe/Prague", label: "Prague - GMT+1/+2" },
  { value: "Europe/Budapest", label: "Budapest - GMT+1/+2" },
  { value: "Europe/Athens", label: "Athens - GMT+2/+3" },
  { value: "Europe/Istanbul", label: "Istanbul - GMT+3" },
  { value: "Europe/Moscow", label: "Moscow - GMT+3" },
  { value: "Europe/Dublin", label: "Dublin - GMT+0/+1" },
  { value: "Europe/Lisbon", label: "Lisbon - GMT+0/+1" },

  // Asia
  { value: "Asia/Dubai", label: "Dubai - GMT+4" },
  { value: "Asia/Karachi", label: "Karachi - GMT+5" },
  { value: "Asia/Kolkata", label: "Mumbai, New Delhi - GMT+5:30" },
  { value: "Asia/Dhaka", label: "Dhaka - GMT+6" },
  { value: "Asia/Bangkok", label: "Bangkok - GMT+7" },
  { value: "Asia/Singapore", label: "Singapore - GMT+8" },
  { value: "Asia/Hong_Kong", label: "Hong Kong - GMT+8" },
  { value: "Asia/Shanghai", label: "Beijing, Shanghai - GMT+8" },
  { value: "Asia/Tokyo", label: "Tokyo - GMT+9" },
  { value: "Asia/Seoul", label: "Seoul - GMT+9" },
  { value: "Asia/Jakarta", label: "Jakarta - GMT+7" },
  { value: "Asia/Manila", label: "Manila - GMT+8" },
  { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur - GMT+8" },
  { value: "Asia/Taipei", label: "Taipei - GMT+8" },
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City - GMT+7" },

  // Australia & Pacific
  { value: "Australia/Sydney", label: "Sydney - GMT+10/+11" },
  { value: "Australia/Melbourne", label: "Melbourne - GMT+10/+11" },
  { value: "Australia/Brisbane", label: "Brisbane - GMT+10" },
  { value: "Australia/Perth", label: "Perth - GMT+8" },
  { value: "Australia/Adelaide", label: "Adelaide - GMT+9:30/+10:30" },
  { value: "Pacific/Auckland", label: "Auckland - GMT+12/+13" },
  { value: "Pacific/Fiji", label: "Fiji - GMT+12/+13" },

  // South America
  { value: "America/Sao_Paulo", label: "São Paulo - GMT-3" },
  { value: "America/Buenos_Aires", label: "Buenos Aires - GMT-3" },
  { value: "America/Lima", label: "Lima - GMT-5" },
  { value: "America/Bogota", label: "Bogotá - GMT-5" },
  { value: "America/Santiago", label: "Santiago - GMT-3/-4" },
  { value: "America/Caracas", label: "Caracas - GMT-4" },

  // Africa
  { value: "Africa/Cairo", label: "Cairo - GMT+2" },
  { value: "Africa/Johannesburg", label: "Johannesburg - GMT+2" },
  { value: "Africa/Lagos", label: "Lagos - GMT+1" },
  { value: "Africa/Nairobi", label: "Nairobi - GMT+3" },
  { value: "Africa/Casablanca", label: "Casablanca - GMT+1/+0" },
];

/**
 * Get timezone label by value
 */
export function getTimezoneLabel(value: string): string {
  const timezone = timezones.find((tz) => tz.value === value);
  return timezone?.label || value;
}

/**
 * Get all timezone values
 */
export function getTimezoneValues(): string[] {
  return timezones.map((tz) => tz.value);
}
