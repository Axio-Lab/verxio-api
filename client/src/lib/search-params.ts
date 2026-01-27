import {
  parseAsString,
  parseAsBoolean,
  parseAsInteger,
  createSearchParamsCache,
} from "nuqs/server";

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

/**
 * Search parameters for the workflows page
 */
export const workflowSearchParams = {
  // Search query
  search: parseAsString.withDefault(""),

  // Pagination
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(5),
};

/**
 * Search parameters for the templates page
 */
export const templateSearchParams = {
  search: parseAsString.withDefault(""),
  category: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(10),
};

export const searchParamsCache = createSearchParamsCache(searchParams);
export const workflowSearchParamsCache = createSearchParamsCache(workflowSearchParams);
export const templateSearchParamsCache = createSearchParamsCache(templateSearchParams);
