import type { FocusArea } from './types';

export interface DevelopmentPriority {
  title: string;
  detail: string;
}

export function canManagePriorities(age: number): boolean {
  return age >= 8;
}

export function availableFocusesForAge(age: number): FocusArea[] {
  if (age < 8) return [];
  if (age < 12) return ['Academics', 'Sport', 'Family', 'Creative Work'];
  if (age < 15) return ['Academics', 'Sport', 'Family', 'Health', 'Creative Work'];
  if (age < 16) return ['Academics', 'Sport', 'Family', 'Health', 'Networking', 'Creative Work'];
  if (age < 18) return ['Academics', 'Sport', 'Family', 'Partner', 'Job', 'Health', 'Networking', 'Creative Work'];
  return ['Academics', 'Sport', 'Family', 'Partner', 'Job', 'Startup', 'Health', 'Networking', 'Campaign', 'Creative Work'];
}

export function automaticFocusesForAge(age: number): FocusArea[] {
  if (age < 3) return ['Family', 'Health', 'Creative Work'];
  if (age < 5) return ['Academics', 'Family', 'Creative Work'];
  if (age < 8) return ['Academics', 'Sport', 'Family'];
  if (age < 12) return ['Academics', 'Family', 'Sport'];
  if (age < 16) return ['Academics', 'Family', 'Health'];
  if (age < 18) return ['Academics', 'Job', 'Health'];
  return ['Job', 'Health', 'Family'];
}

export function normalizeFocusesForAge(age: number, focuses: FocusArea[]): FocusArea[] {
  if (!canManagePriorities(age)) return automaticFocusesForAge(age);
  const allowed = availableFocusesForAge(age);
  const filtered = [...new Set(focuses)].filter((focus) => allowed.includes(focus)).slice(0, 3);
  for (const fallback of automaticFocusesForAge(age)) {
    if (filtered.length >= 3) break;
    if (allowed.includes(fallback) && !filtered.includes(fallback)) filtered.push(fallback);
  }
  return filtered;
}

export function developmentPrioritiesForAge(age: number): DevelopmentPriority[] {
  if (age < 1) return [
    { title: 'Bond with caregivers', detail: 'Food, sleep, comfort, and being cared for.' },
    { title: 'Build basic movement', detail: 'Head control, rolling, reaching, and sitting.' },
    { title: 'Take in the world', detail: 'Faces, sounds, routines, and early communication.' },
  ];
  if (age < 2) return [
    { title: 'Learn to walk', detail: 'Balance, coordination, and getting around.' },
    { title: 'First words', detail: 'Understanding more and starting to talk.' },
    { title: 'Safe routines', detail: 'Caregivers still handle almost everything important.' },
  ];
  if (age < 3) return [
    { title: 'Talk more', detail: 'Words start turning into short conversations.' },
    { title: 'Move with confidence', detail: 'Running, climbing, throwing, and coordination.' },
    { title: 'Learn independence', detail: 'Small choices, routines, and doing simple things yourself.' },
  ];
  if (age < 5) return [
    { title: 'Letters and numbers', detail: 'Alphabet, counting, shapes, and basic patterns.' },
    { title: 'Play with other kids', detail: 'Sharing, taking turns, and making friends.' },
    { title: 'Get ready for school', detail: 'Attention, routines, language, and curiosity.' },
  ];
  if (age < 8) return [
    { title: 'Reading and math', detail: 'Practice the basics.' },
    { title: 'School habits', detail: 'Listen, finish work, and ask questions.' },
    { title: 'Friends and interests', detail: 'Sports, art, games, clubs, and friends.' },
  ];
  if (age < 12) return [
    { title: 'School', detail: 'Grades and learning habits matter more now.' },
    { title: 'Find your thing', detail: 'Sports, music, art, building, gaming, or whatever sticks.' },
    { title: 'Keep good people close', detail: 'Family and friendships are becoming more two-way.' },
  ];
  if (age < 15) return [
    { title: 'Build useful skills', detail: 'School, sports, hobbies, and social confidence.' },
    { title: 'More independence', detail: 'You are handling more on your own.' },
    { title: 'Think ahead', detail: 'Work, college, trades, and adult life are getting closer.' },
  ];
  if (age < 16) return [
    { title: 'Start learning to drive', detail: 'Start now so you can be ready at 16.' },
    { title: 'School and future plans', detail: 'Grades, skills, college, trades, or work.' },
    { title: 'Handle more yourself', detail: 'Money, time, friendships, and responsibility.' },
  ];
  if (age < 18) return [
    { title: 'Driving and mobility', detail: 'A license opens up work, school, and more independence.' },
    { title: 'First real work', detail: 'Earn, save, and build experience.' },
    { title: 'Plan what comes next', detail: 'College, training, work, moving out, or another path.' },
  ];
  return [];
}

export function minimumAgeForWellnessVerb(verb: string): number {
  switch (verb) {
    case 'health.run': return 8;
    case 'health.group_class': return 12;
    case 'health.gym':
    case 'health.join_gym': return 16;
    case 'health.therapy': return 8;
    case 'health.outdoors': return 5;
    default: return 0;
  }
}

export function wellnessAgeMessage(verb: string, age: number): string {
  const minimum = minimumAgeForWellnessVerb(verb);
  if (age >= minimum) return '';
  if (age < 5) return 'Your caregivers handle health and activity at this age.';
  if (verb === 'health.gym' || verb === 'health.join_gym') return 'Gym memberships open at 16.';
  if (verb === 'health.run') return 'Running as a fitness activity opens later in childhood.';
  return `That activity opens at age ${minimum}.`;
}
