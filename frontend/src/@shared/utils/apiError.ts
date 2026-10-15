/**
 * Extracts the message from the backend error envelope (`{ error: { message } }`)
 * or an axios-style error, falling back when nothing usable is present.
 */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}
