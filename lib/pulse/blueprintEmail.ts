import { formatEnrichedProjectContext, getRecommendedModules } from "./modules";
import type { SavedDirection } from "./directionStore";

/**
 * The blueprint as plain text, addressed to the visitor rather than the team.
 *
 * Built from the same `formatEnrichedProjectContext` and `getRecommendedModules`
 * that the on-screen panel, the saved record and the .docx use, so the emailed
 * copy cannot drift from what the visitor saw.
 */
export function renderBlueprintEmail(direction: SavedDirection): { subject: string; text: string } {
  const enriched = formatEnrichedProjectContext(direction.context, direction.answers);

  // The stored list is the record of what the visitor was actually shown, so it
  // wins over regenerating — which would quietly diverge if the module rules
  // change after a direction is saved. Same precedence as the PULSE ID lookup.
  const modules =
    direction.recommendedModules && direction.recommendedModules.length > 0
      ? direction.recommendedModules
      : getRecommendedModules(direction.context?.industry, direction.context, direction.answers ?? []);

  const firstName = direction.lead.name.trim().split(/\s+/)[0] || "there";

  const lines = [
    `Hi ${firstName},`,
    ``,
    `Here is the project direction you mapped out with Aceva Pulse.`,
    ``,
    `PULSE Reference ID: ${direction.pulseId}`,
    `Quote this ID when you speak to the ACEVA team and they will already have the context.`,
    ``,
    `--- YOUR PROJECT AT A GLANCE ---`,
    `Industry focus:   ${enriched.industryFocus}`,
    `Primary intent:   ${enriched.primaryIntent}`,
    `Project scale:    ${enriched.projectScale}`,
    `Target timeline:  ${enriched.targetTimeline}`,
    `Budget:           ${enriched.budgetAllocation}`,
    `Primary goals:    ${enriched.primaryGoals}`,
    ``,
    `--- RECOMMENDED SYSTEM ARCHITECTURE ---`,
    ...modules.map((module, index) => `${index + 1}. ${module}`),
    ``,
  ];

  if (direction.answers && direction.answers.length > 0) {
    lines.push(
      `--- WHAT YOU TOLD US ---`,
      ...direction.answers.map((answer, index) => `${index + 1}. ${answer}`),
      ``
    );
  }

  lines.push(
    `Nothing here is a quote or a commitment — it is the shape of the work as Pulse understood it.`,
    `Reply to this email if anything looks wrong and the team will correct it.`,
    ``,
    `— ACEVA Technology`
  );

  return {
    subject: `Your ACEVA project blueprint (${direction.pulseId})`,
    text: lines.join("\n"),
  };
}
