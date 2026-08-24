import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Runs an axe scan and fails on any critical or serious violation, which is
 * the bar MA-3 sets for every auth state.
 *
 * Moderate and minor findings are reported by axe but not failed here, so
 * the gate stays the one the story defines rather than silently becoming
 * stricter or looser.
 */
export async function expectNoSeriousAccessibilityViolations(
  page: Page,
  context: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();

  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );

  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
    `axe found critical or serious violations in: ${context}`,
  ).toEqual([]);
}
