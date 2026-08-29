/**
 * Kosvia is not a medical service (02_RODO.md §9). The system prompt says so,
 * but a prompt is a request, not a guarantee — every answer is checked here
 * before it reaches the user.
 */
const FORBIDDEN_PHRASES: RegExp[] = [
  /\bwylecz\w*/i,
  /\bleczy\b/i,
  /\bleczenie\b/i,
  /\bdiagnoz\w*/i,
  /\bchorob\w*/i,
  /\bzalecam odstawi\w*/i,
  /\bodstaw\w* lek\w*/i,
  /\bcures?\b/i,
  /\bcured\b/i,
  /\btreats?\b(?! (it|this|that) as)/i,
  /\bdiagnos\w*/i,
  /\bdisease\b/i,
  /\bstop taking\b/i,
  /\bprescription\b/i,
];

export const findMedicalLanguage = (answer: string): string | null => {
  for (const pattern of FORBIDDEN_PHRASES) {
    const match = pattern.exec(answer);
    if (match) {
      return match[0];
    }
  }
  return null;
};

export const REPHRASE_INSTRUCTION =
  'Your previous answer used medical language (curing, treating, diagnosing, diseases, or advising to stop a medication). Rewrite it: describe what the ingredients do informationally, never promise a health outcome, and if the question describes a medical concern, suggest seeing a dermatologist instead of recommending products.';
