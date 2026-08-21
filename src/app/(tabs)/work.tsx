import React from 'react';
import { View } from 'react-native';

import { MenuTile } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { topCompetencies } from '@/engine/competencies';
import { playerAgeYears } from '@/engine/createWorld';
import { innerCircleProfile } from '@/engine/factionDepth';
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
  const privateMovement = innerCircleProfile(world);
  const strongest = topCompetencies(world, actor.id, 1)[0];

  return (
    <AppScreen>
      <View style={{ gap: 4, paddingTop: 8 }}><Eyebrow>{age < 18 ? 'GROWING UP' : 'WORK & AMBITION'}</Eyebrow><Heading size="large">Work & ambition</Heading><Body secondary>{age < 14 ? 'School and interests come first.' : 'Jobs, school, business, politics, and skills.'}</Body></View>

      {age >= 5 ? <MenuTile icon="🧠" title="Skills & competence" subtitle="What you are actually getting good at." route="/skills" badge={strongest ? `${strongest.label} ${Math.round(strongest.value)}` : 'Developing'} /> : null}
      {age >= 5 && age < 18 ? <MenuTile icon="🎒" title="School" subtitle="Grades, friends, sports, clubs, and study habits." route="/school" badge={education ? `${Math.round(education.recordedGrade)} grade` : 'School'} /> : null}
      {age >= 14 ? <MenuTile icon="💼" title="Jobs" subtitle="Find work and build experience." route="/jobs" badge={career ? career.title : 'Looking'} /> : null}
      {age >= 15 ? <MenuTile icon="🎓" title="College & training" subtitle="College, trade school, internships, and tuition." route="/college" badge={education && education.status !== 'school' ? education.status : 'Options'} /> : null}
      {age >= 16 ? <MenuTile icon="🏢" title="Businesses" subtitle="Start, buy, grow, and manage companies." route="/businesses" badge={`${businesses.length} owned`} /> : null}
      {age >= 18 ? <MenuTile icon="🗳️" title="Politics" subtitle="Campaigns, approval, coalitions, and office." route="/politics" badge={`${Math.round(politics?.approval ?? 50)}%`} /> : null}
      {privateMovement ? <MenuTile icon="◈" title="Inner Circle" subtitle="Your private movement, people, money, and influence." route="/inner-circle" badge={`${privateMovement.followers.toLocaleString()} following`} /> : null}

      {career ? <Card accent><Heading size="small">Right now</Heading><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}><Stat label="Job" value={career.title} /><Stat label="Weekly pay" value={formatMoney(career.weeklySalaryCents)} /><Stat label="Performance" value={Math.round(career.performance).toString()} /><Stat label="Hours" value={`${career.hoursPerWeek ?? 40}/wk`} /></View></Card> : null}

      {age < 5 ? <Card accent><Heading size="small">Being a kid is the job</Heading><Body secondary>Family, health, play, and learning come first.</Body><StatusPill tone="accent">Age {age}</StatusPill></Card> : age < 14 ? <Card accent><Heading size="small">Habits start early</Heading><Body secondary>School, skills, friends, and confidence can build for years.</Body><StatusPill tone="accent">Age {age}</StatusPill></Card> : null}

      {age >= 14 ? <OtherActionComposer domains={['education', 'career', 'business', 'organization', 'politics', 'geopolitics']} placeholder="Something else…" /> : null}
    </AppScreen>
  );
}
