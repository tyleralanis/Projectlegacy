import { describe, expect, it } from 'vitest';

import { WORLD_CONTENT } from '@/content/worldContent';

import { createWorld } from '../createWorld';
import { executeSecondarySchoolApplication } from '../educationApplicationBridge';

describe('secondary-school college application bridge', () => {
  it('allows an eligible student to apply without withdrawing from secondary school', () => {
    const university = WORLD_CONTENT.universities[0];
    const age = Math.max(17, university.minimumAge);
    const world = createWorld({ seed: 'early-college-application', startAgeYears: age, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    world.education = {
      'education-secondary-test': {
        id: 'education-secondary-test',
        characterId: actor.id,
        institutionId: 'organization-harborview-academy',
        status: 'school',
        startedWeek: 5 * 52,
        level: 'General studies',
        recordedGrade: 91,
        knowledgeGain: actor.knowledge,
        prestige: 52,
        network: 44,
        tuitionCentsPerYear: 0,
        manipulatedCredential: false,
      },
    };
    actor.knowledge = 92;
    actor.charisma = 82;
    actor.reputation.professional = 78;

    const result = executeSecondarySchoolApplication(world, { verb: 'education.apply', targetIds: [], parameters: { universityId: university.id } });
    expect(result).not.toBeNull();
    expect(result!.validation.valid).toBe(true);
    expect(result!.world.education['education-secondary-test'].status).toBe('school');
    const postsecondary = Object.values(result!.world.education).filter((record) => record.id !== 'education-secondary-test');
    expect(postsecondary.every((record) => record.status === 'accepted')).toBe(true);
  });
});
