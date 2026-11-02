/**
 * Kill switches for Pulse features that reach outside the visitor's own browser.
 *
 * Code constants, deliberately not environment variables: both features below
 * were switched off for security containment on 30 October 2026, and turning
 * one back on must be a reviewed code change rather than a dashboard setting
 * someone can flip in production. Isomorphic, so the server routes and the
 * client UI read the same value.
 *
 * - `blueprintEmail`: "Email me my blueprint". Off because the address it sends
 *   to is whatever a visitor typed, never verified, so anyone could make ACEVA's
 *   verified sender deliver visitor-written text and links to a stranger.
 *   Re-enable only once the address has been proven to belong to the visitor
 *   (for example a single-use link sent to it) and the email body no longer
 *   carries visitor text.
 *
 * - `pulseIdLookupDetails`: showing a saved direction in chat when a visitor
 *   types its PULSE ID. Off because a PULSE ID is short and guessable and the
 *   chat is unauthenticated, so any detail shown is shown to whoever guesses.
 *   While off, every PULSE ID mention gets the same reply and the store is not
 *   read, so the reply cannot reveal whether an ID exists. Re-enable only behind
 *   an ownership check approved by the business.
 */
export interface PulseFeatureFlags {
  blueprintEmail: boolean;
  pulseIdLookupDetails: boolean;
}

export const PULSE_FEATURES: PulseFeatureFlags = {
  blueprintEmail: false,
  pulseIdLookupDetails: false,
};
