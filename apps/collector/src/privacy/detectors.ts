const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MIN_PERSONAL_DIGIT_RUN = 9;
const PERSONAL_DIGIT_RUN = new RegExp(`\\d{${MIN_PERSONAL_DIGIT_RUN},}`);

/**
 * Heuristic detector for personal data in free text: an email-like string or a run of
 * 9+ digits (separators ignored). It does not catch names, addresses or short IDs.
 */
export function looksPersonal(value: string): boolean {
  if (EMAIL_LIKE.test(value)) {
    return true;
  }
  const compact = value.replace(/[\s\-.()]/g, "");
  return PERSONAL_DIGIT_RUN.test(compact);
}
