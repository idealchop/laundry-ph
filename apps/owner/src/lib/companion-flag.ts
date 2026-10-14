/** AI Companion is shown only where COMPANION_ENABLED=1 (apphosting.dev.yaml). Off in prod. */
export const companionEnabled = () => process.env.NEXT_PUBLIC_COMPANION_ENABLED === "1";
