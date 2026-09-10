import type { CompetencyKey, Domain } from '@/engine/types';

export interface ProjectDefinition {
  id: string;
  title: string;
  detail: string;
  minimumAge: number;
  weeks: number;
  hours: number;
  costCents: number;
  skill: CompetencyKey;
  domain: Domain;
  checkpoint: string;
  outcome: string;
}

export const PERSONAL_PROJECTS: readonly ProjectDefinition[] = [
  { id: 'family-stories', title: 'Record your family stories', detail: 'Collect the small memories that usually disappear between generations.', minimumAge: 8, weeks: 6, hours: 2, costCents: 0, skill: 'communication', domain: 'family', checkpoint: 'The stories do not always agree. You can keep a personal record, research a fuller history, or invite others to add their own version.', outcome: 'A family keepsake now preserves this chapter of your life. Communication and family reputation improved.' },
  { id: 'creative', title: 'Finish a creative project', detail: 'Turn an idea into a short collection of writing, art, or music.', minimumAge: 8, weeks: 8, hours: 3, costCents: 0, skill: 'media', domain: 'life', checkpoint: 'The first draft is ready, but the ending is not working yet. Finish a small piece, give yourself time for a more ambitious version, or invite someone to collaborate.', outcome: 'You finished something you can call your own. Media skills and confidence improved.' },
  { id: 'community', title: 'Help your neighborhood', detail: 'Commit to a local volunteer effort, from a shared garden to a community cleanup.', minimumAge: 12, weeks: 8, hours: 3, costCents: 0, skill: 'leadership', domain: 'organization', checkpoint: 'More neighbors want to take part. Deliver the original plan, take on a larger effort, or share responsibility with the people already involved.', outcome: 'Your neighborhood effort made a visible difference. Leadership and public reputation improved.' },
  { id: 'practical', title: 'Build a practical skill', detail: 'Work through a hands-on repair or making project, one manageable step at a time.', minimumAge: 14, weeks: 12, hours: 4, costCents: 8000, skill: 'trades', domain: 'education', checkpoint: 'The basic work is taking shape. Finish the essentials, attempt a more demanding version, or learn alongside someone you know.', outcome: 'A finished practical project is now part of your experience. Trade skills and discipline improved.' },
  { id: 'mentoring', title: 'Share what you know', detail: 'Make time to mentor people at an earlier stage of their working lives.', minimumAge: 25, weeks: 12, hours: 2, costCents: 0, skill: 'management', domain: 'career', checkpoint: 'The people you are helping need different things. Keep the sessions focused, develop a longer program, or turn the group into a shared learning circle.', outcome: 'You helped others take their next step. Management skills and professional reputation improved.' },
];
