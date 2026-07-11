/** User-facing error messages — never expose raw Supabase errors. */

const MESSAGES: Record<string, string> = {
  property: "Unable to save this property. Please try again.",
  property_load: "Unable to load your properties. Please try again.",
  maintenance: "Unable to save this maintenance item. Please try again.",
  repair: "Unable to save this repair. Please try again.",
  appliance: "Unable to save this appliance. Please try again.",
  document: "Unable to upload this document.",
  photo: "Unable to upload this photo.",
  paint: "Unable to save this paint color. Please try again.",
  contractor: "Unable to save this contractor. Please try again.",
  sharing: "Property sharing is temporarily unavailable.",
  sharing_create: "Unable to create a share link. Please try again.",
  sharing_revoke: "Unable to revoke this share link. Please try again.",
  profile: "Unable to save your profile. Please try again.",
  generic: "Something went wrong. Please try again.",
};

export function friendlyMessage(key: keyof typeof MESSAGES | string): string {
  return MESSAGES[key] ?? MESSAGES.generic;
}

export function logTechnicalError(context: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(`[HomeWise:${context}]`, msg);
}

export class UserFacingError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly context: string,
    cause?: unknown
  ) {
    super(userMessage);
    logTechnicalError(context, cause ?? userMessage);
  }
}

export function toUserError(context: string, error: unknown, messageKey?: string): UserFacingError {
  const userMessage = friendlyMessage(messageKey ?? context);
  return new UserFacingError(userMessage, context, error);
}

export function assertNoError(context: string, error: { message: string } | null, messageKey?: string) {
  if (error) {
    throw toUserError(context, error, messageKey);
  }
}
