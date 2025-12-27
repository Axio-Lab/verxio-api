/**
 * Authenticated API client utilities
 * Automatically includes Better Auth session in requests
 * 
 * These functions should be used for all protected API routes.
 * They automatically include the session cookie and user email header.
 */

import { getSession } from "@/lib/auth-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Authenticated fetch wrapper that includes Better Auth session
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getSession();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Better Auth uses HTTP-only cookies for session management
  // The session cookie is automatically sent with credentials: "include"
  // If your backend needs additional validation, you can extract user info from the session
  if (session && "data" in session && session.data?.user) {
    // Optionally include user email for backend validation
    headers["X-User-Email"] = session.data.user.email || "";
  }

  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: "include", // Include cookies for Better Auth session
  });
}

/**
 * Helper for GET requests
 */
export async function authenticatedGet<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    // Handle authentication errors
    if (response.status === 401) {
      throw new Error("Authentication required. Please log in.");
    }
    if (response.status === 403) {
      throw new Error("Access forbidden. You don't have permission to access this resource.");
    }
    
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Helper for POST requests
 */
export async function authenticatedPost<T>(
  url: string,
  data?: unknown
): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    // Handle authentication errors
    if (response.status === 401) {
      throw new Error("Authentication required. Please log in.");
    }
    if (response.status === 403) {
      throw new Error("Access forbidden. You don't have permission to access this resource.");
    }
    
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Helper for PUT requests
 */
export async function authenticatedPut<T>(
  url: string,
  data?: unknown
): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    // Handle authentication errors
    if (response.status === 401) {
      throw new Error("Authentication required. Please log in.");
    }
    if (response.status === 403) {
      throw new Error("Access forbidden. You don't have permission to access this resource.");
    }
    
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Helper for DELETE requests
 */
export async function authenticatedDelete<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    // Handle authentication errors
    if (response.status === 401) {
      throw new Error("Authentication required. Please log in.");
    }
    if (response.status === 403) {
      throw new Error("Access forbidden. You don't have permission to access this resource.");
    }
    
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

