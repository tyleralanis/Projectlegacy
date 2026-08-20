import React from 'react';
import { View } from 'react-native';

import { MenuTile } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function WorkScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  const businesses = Object.values(world.businesses).filter((item) => item.active && (item.ownerId ?? item.founderId) === actor.id && item.playerOwnershipBps > 0);
  const education = Object.values(world.education).find((item) => item.characterId === actor.id && !['completed', 'withdrawn'].includes(item.status));
  const politics = world.politics[actor.id];

  return (
    <AppScreen>
      <View style={{ gap: 4, paddingTop: 8 }}><Eyebrow>{age < 18 ? 'WHAT ARE WE BECOMING?' : 'WHAT ARE WE DOING WITH OUR LIFE?'}</Eyebrow><Heading size="large">Work & ambition</Heading><Body secondary>{age < 14 ? 'School, interests, friends, and family come first. The resume can wait a minute.' : 'Jobs, school, companies, and politics each get their own room now. Pick a lane—or juggle several badly.'}</Body></View>

      {age >= 5 && age < 18 ? <MenuTile icon="🎒" title="School" subtitle="Grades, studying, sports, friends, clubs, and the habits that quietly become your adult skill set." route="/school" badge={education ? `${Math.round(education.recordedGrade)} grade` : 'School'} /> : null}
      {age >= 14 ? <MenuTile icon="💼" title="Jobs" subtitle="Browse openings that rotate every week. Better jobs care about education, experience, skills, and reputation." route="/jobs" badge={career ? career.title : 'Looking'} /> : null}
      {age >= 15 ? <MenuTile icon="🎓" title="College & training" subtitle="Apply, enroll, study, party, play sports, pay tuition, or walk away." route="/college" badge={education && education.status !== 'school' ? education.status : 'Options'} /> : null}
      {age >= 16 ? <MenuTile icon="🏢" title="Businesses" subtitle="Start companies, manage operations, hire people, raise money, install CEOs, and build an empire without cloning yourself." route="/businesses" badge={`${businesses.length} owned`} /> : null}
      {age >= 18 ? <MenuTile icon="🗳️" title="Politics" subtitle="Approval, eligibility, campaigns, press conferences, town halls, fundraising, policy, and public mistakes." route="/politics" badge={`${Math.round(politics?.approval ?? 50)}%`} /> : null}

      {career ? <Card accent><Heading size="small">Right now</Heading><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}><Stat label="Job" value={career.title} /><Stat label="Weekly pay" value={formatMoney(career.weeklySalaryCents)} /><Stat label="Performance" value={Math.round(career.performance).toString()} /></View></Card> : null}

      {age < 5 ? <Card accent><Heading size="small">No résumé required</Heading><Body secondary>For a while, becoming a person is the whole job. Family, health, curiosity, and the world around you are already shaping what comes next.</Body><StatusPill tone="accent">Age {age}</StatusPill></Card> : age < 14 ? <Card accent><Heading size="small">The stakes are small. The compounding is not.</Heading><Body secondary>Grades do not decide your life, but habits, skills, friendships, confidence, and opportunities can start building years before adulthood.</Body><StatusPill tone="accent">Age {age}</StatusPill></Card> : null}

      {age >= 14 ? <OtherActionComposer domains={['education', 'career', 'business', 'organization', 'politics']} placeholder="Something we did not put in a menu…" /> : null}
    </AppScreen>
  );
}
