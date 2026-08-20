import assets from './catalogs/assets.json';
import businessSectors from './catalogs/business-sectors.json';
import countries from './catalogs/countries.json';
import eventTemplates from './catalogs/events.json';
import laws from './catalogs/laws.json';
import performance from './catalogs/performance.json';
import professions from './catalogs/professions.json';
import universities from './catalogs/universities.json';

export const WORLD_CONTENT = {
  assets,
  businessSectors,
  countries,
  eventTemplates,
  laws,
  performance,
  professions,
  universities,
} as const;

export function eventIsAgeEligible(templateId: string, age: number): boolean {
  const template = WORLD_CONTENT.eventTemplates.find((item) => item.id === templateId);
  return template ? age >= template.minimumAge && age <= template.maximumAge : false;
}

export function assertWorldContentValid(): void {
  for (const [name, records] of Object.entries(WORLD_CONTENT)) {
    if (name === 'performance') continue;
    if (!Array.isArray(records) || records.length === 0) throw new Error(`${name} content is empty.`);
    const ids = records.map((record) => record.id);
    if (new Set(ids).size !== ids.length) throw new Error(`${name} content contains duplicate ids.`);
  }
  for (const event of WORLD_CONTENT.eventTemplates) {
    if (event.minimumAge < 0 || event.maximumAge < event.minimumAge) throw new Error(`Invalid age gate for ${event.id}.`);
  }
}
