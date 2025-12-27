import { parseAsString, parseAsBoolean, createSearchParamsCache } from "nuqs/server";

/**
 * Search parameters for the explore/deals page
 */
export const searchParams = {
  // Search query
  q: parseAsString.withDefault(""),
  
  // Filters
  country: parseAsString.withDefault(""),
  category: parseAsString.withDefault(""),
  merchant: parseAsString.withDefault(""),
  dealType: parseAsString.withDefault(""),
  expiringSoon: parseAsBoolean.withDefault(false),
  
  // Pagination
  page: parseAsString.withDefault("1"),
  limit: parseAsString.withDefault("20"),
  
  // Sorting
  sortBy: parseAsString.withDefault(""),
  sortOrder: parseAsString.withDefault("asc"),
};

export const searchParamsCache = createSearchParamsCache(searchParams);

