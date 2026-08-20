import type { ActionDefinition } from './actionCatalog';

export const LIFE_SYSTEM_ACTION_CATALOG: ActionDefinition[] = [
  { id: 'career.negotiate_hours', domain: 'career', label: 'Negotiate work hours', summary: 'Trade pay and career momentum for more weekly time, or commit more hours for stronger career momentum.' },
  { id: 'health.sleep', domain: 'health', label: 'Protect sleep', summary: 'Give recovery real priority instead of treating exhaustion as free productivity.' },
  { id: 'health.nutrition', domain: 'health', label: 'Improve nutrition', summary: 'Spend money and attention on a more deliberate food routine with modest long-term health benefits.' },
  { id: 'health.checkup', domain: 'health', label: 'Get a checkup', summary: 'Use preventive care to monitor health pressure before it becomes a crisis.' },
  { id: 'health.rehab', domain: 'health', label: 'Do rehab', summary: 'Actively manage an injury or persistent health issue with time and healthcare cost.' },
  { id: 'health.rest_week', domain: 'health', label: 'Take a recovery week', summary: 'Give up some short-term output so stress, mood, and health can recover.' },
  { id: 'property.screen_tenant', domain: 'property', label: 'Screen a tenant', summary: 'Turn vacancy into a persistent tenant relationship rather than an anonymous occupancy flag.' },
  { id: 'property.repair', domain: 'property', label: 'Repair property', summary: 'Spend cash to improve condition, value, and the tenant relationship together.' },
  { id: 'property.develop', domain: 'property', label: 'Develop land', summary: 'Commit capital and carrying costs to turn an owned land parcel into an operating multifamily or commercial asset.' },
  { id: 'sports.sign_endorsement', domain: 'career', label: 'Sign endorsement', summary: 'Convert professional sports performance, fame, and media skill into sponsorship income.' },
  { id: 'sports.recover', domain: 'health', label: 'Recover from sports injury', summary: 'Protect the longer athletic career by giving an injury a dedicated recovery block.' },
  { id: 'sports.retire', domain: 'career', label: 'Retire from professional sports', summary: 'End the playing career while keeping the reputation, network, skill, and leverage it created.' },
  { id: 'sports.coach', domain: 'career', label: 'Become a coach', summary: 'Convert a completed professional playing career into a leadership-based sports career.' },
  { id: 'wealth.set_lifestyle', domain: 'markets', label: 'Set lifestyle', summary: 'Choose recurring lifestyle spending deliberately instead of making wealth automatically expensive.' },
  { id: 'wealth.create_family_office', domain: 'markets', label: 'Create family office', summary: 'Build a high-net-worth institution that coordinates wealth, advisors, administration, and succession.' },
];

export function lifeSystemActionDefinition(id: string): ActionDefinition | undefined {
  return LIFE_SYSTEM_ACTION_CATALOG.find((action) => action.id === id);
}
