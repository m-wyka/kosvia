import type {
  AlternativeGroupDto,
  DupeResultDto,
  PlanTier,
  RoutineAnalysisDto,
} from '@kosvia/shared';

const FREE_OBSERVATION_KINDS = new Set(['gap', 'balance']);

/**
 * The Free shelf analysis keeps the descriptive basics (routine gaps, balance)
 * and reserves duplicate detection for Premium.
 */
export const restrictRoutineAnalysis = (
  analysis: RoutineAnalysisDto,
  plan: PlanTier,
): RoutineAnalysisDto => {
  if (plan === 'PREMIUM') {
    return analysis;
  }
  return {
    ...analysis,
    observations: analysis.observations.filter((observation) =>
      FREE_OBSERVATION_KINDS.has(observation.kind),
    ),
  };
};

/** Trims the alternative groups to the plan's total ceiling, dropping emptied groups. */
export const restrictAlternativeGroups = (
  groups: AlternativeGroupDto[],
  limit: number | null,
): AlternativeGroupDto[] => {
  if (limit === null) {
    return groups;
  }
  let remaining = limit;
  const trimmed: AlternativeGroupDto[] = [];
  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }
    const products = group.products.slice(0, remaining);
    remaining -= products.length;
    if (products.length > 0) {
      trimmed.push({ ...group, products });
    }
  }
  return trimmed;
};

/** Trims the dupe list to the plan's ceiling, reporting how many stay locked. */
export const restrictDupes = (result: DupeResultDto, limit: number | null): DupeResultDto => {
  if (limit === null) {
    return { ...result, lockedDupeCount: 0 };
  }
  return {
    ...result,
    dupes: result.dupes.slice(0, limit),
    lockedDupeCount: Math.max(0, result.dupes.length - limit),
  };
};
