import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { PersonalMatchDto } from '@kosvia/shared';
import MatchScore from '@@/layers/core/app/components/product/MatchScore.vue';

const match = (overrides: Partial<PersonalMatchDto> = {}): PersonalMatchDto => ({
  score: 92,
  tier: 'perfect',
  reasons: [{ code: 'concerns', label: 'Targets dehydration', impact: 11 }],
  warnings: [],
  personalised: true,
  ...overrides,
});

describe('MatchScore', () => {
  it('renders the score and its tier', () => {
    const component = mount(MatchScore, { props: { match: match() } });
    expect(component.text()).toContain('92');
    expect(component.text()).toContain('Perfect match');
  });

  it('describes the score to screen readers, not just with colour', () => {
    const component = mount(MatchScore, { props: { match: match() } });
    const label = component.find('svg[role="img"]').attributes('aria-label');
    expect(label).toBe('Personal match 92 percent — Perfect match');
  });

  it('invites the user to complete their profile when the score is generic', () => {
    const component = mount(MatchScore, {
      props: { match: match({ personalised: false, tier: 'great', score: 80 }) },
    });
    expect(component.text()).toContain('Formula score');
    expect(component.text()).toContain('Complete your profile');
  });

  it('renders nothing when there is no match to show', () => {
    const component = mount(MatchScore, { props: { match: null } });
    expect(component.text().trim()).toBe('');
  });
});
