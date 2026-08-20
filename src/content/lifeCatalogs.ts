export const CITY_OPTIONS = [
  { id: 'city-harborview', name: 'Harborview', countryId: 'country-harbor-republic', moveCostCents: 180_000, vibe: 'Coastal, expensive, connected' },
  { id: 'city-cedar-falls', name: 'Cedar Falls', countryId: 'country-harbor-republic', moveCostCents: 95_000, vibe: 'Affordable, family-friendly, slower' },
  { id: 'city-ironridge', name: 'Ironridge', countryId: 'country-harbor-republic', moveCostCents: 125_000, vibe: 'Industrial, ambitious, practical' },
  { id: 'city-northport', name: 'Northport', countryId: 'country-northland', moveCostCents: 260_000, vibe: 'Finance, universities, colder climate' },
  { id: 'city-sundara-capital', name: 'Sundara City', countryId: 'country-sundara', moveCostCents: 220_000, vibe: 'Fast-growing, politically complex' },
] as const;

export const JOB_MARKET = [
  { id: 'job-retail', title: 'Retail associate', sector: 'Retail', weeklySalaryCents: 62000, minimumAge: 16, minimumKnowledge: 20, requiredDegree: false, requiredExperienceWeeks: 0 },
  { id: 'job-warehouse', title: 'Warehouse technician', sector: 'Logistics', weeklySalaryCents: 79000, minimumAge: 18, minimumKnowledge: 28, requiredDegree: false, requiredExperienceWeeks: 0 },
  { id: 'job-project', title: 'Project coordinator', sector: 'Operations', weeklySalaryCents: 108000, minimumAge: 18, minimumKnowledge: 48, requiredDegree: false, requiredExperienceWeeks: 26 },
  { id: 'job-sales', title: 'Account executive', sector: 'Sales', weeklySalaryCents: 146000, minimumAge: 18, minimumKnowledge: 45, requiredDegree: false, requiredExperienceWeeks: 52 },
  { id: 'job-analyst', title: 'Financial analyst', sector: 'Finance', weeklySalaryCents: 172000, minimumAge: 21, minimumKnowledge: 62, requiredDegree: true, requiredExperienceWeeks: 26 },
  { id: 'job-banker', title: 'Commercial banker', sector: 'Finance', weeklySalaryCents: 205000, minimumAge: 21, minimumKnowledge: 68, requiredDegree: true, requiredExperienceWeeks: 52 },
  { id: 'job-engineer', title: 'Software engineer', sector: 'Technology', weeklySalaryCents: 228000, minimumAge: 20, minimumKnowledge: 72, requiredDegree: true, requiredExperienceWeeks: 26 },
  { id: 'job-attorney', title: 'Attorney', sector: 'Legal', weeklySalaryCents: 262000, minimumAge: 24, minimumKnowledge: 82, requiredDegree: true, requiredExperienceWeeks: 0 },
  { id: 'job-director', title: 'Operations director', sector: 'Operations', weeklySalaryCents: 315000, minimumAge: 25, minimumKnowledge: 68, requiredDegree: true, requiredExperienceWeeks: 208 },
  { id: 'job-vp', title: 'Vice president', sector: 'Executive', weeklySalaryCents: 470000, minimumAge: 30, minimumKnowledge: 76, requiredDegree: true, requiredExperienceWeeks: 364 },
] as const;

export const WELLNESS_ACTIVITIES = [
  { id: 'run', label: 'Go for a run', costCents: 0, fitness: 2.4, health: 0.8, mood: 1.2, stress: -1.4, socialChance: 0.04 },
  { id: 'gym', label: 'Visit the gym', costCents: 2500, fitness: 3.2, health: 1.0, mood: 0.8, stress: -1.0, socialChance: 0.09 },
  { id: 'class', label: 'Take a group class', costCents: 3800, fitness: 2.0, health: 0.7, mood: 1.5, stress: -1.2, socialChance: 0.24 },
  { id: 'therapy', label: 'Go to therapy', costCents: 18000, fitness: 0, health: 0.4, mood: 2.5, stress: -4.5, socialChance: 0 },
  { id: 'massage', label: 'Book a massage', costCents: 12000, fitness: 0.2, health: 0.3, mood: 2.0, stress: -3.0, socialChance: 0.01 },
  { id: 'meditation', label: 'Meditate', costCents: 0, fitness: 0, health: 0.2, mood: 1.0, stress: -2.2, socialChance: 0 },
] as const;

export const POLITICAL_ACTIVITIES = [
  { id: 'press', label: 'Hold a press conference', costCents: 120000, skill: 'charisma', upside: 8, downside: -7, note: 'Public speaking and political reputation matter heavily.' },
  { id: 'townhall', label: 'Host a town hall', costCents: 45000, skill: 'empathy', upside: 5, downside: -3, note: 'Empathy and listening matter more than polish.' },
  { id: 'policy', label: 'Release a policy proposal', costCents: 25000, skill: 'knowledge', upside: 6, downside: -4, note: 'Knowledge and current authority improve credibility.' },
  { id: 'fundraiser', label: 'Host a fundraiser', costCents: 90000, skill: 'charisma', upside: 4, downside: -2, note: 'Networks and business reputation improve the haul.' },
  { id: 'doorstep', label: 'Meet voters directly', costCents: 12000, skill: 'empathy', upside: 3, downside: -1, note: 'Low cost, slow gains, useful for unknown candidates.' },
] as const;

export const ADVISOR_OPTIONS = [
  { id: 'wealth-manager', role: 'Wealth manager', annualCostCents: 4800000, minimumNetWorthCents: 100000000, benefit: 'Improves diversification and reduces routine investment attention.' },
  { id: 'attorney', role: 'Personal attorney', annualCostCents: 3600000, minimumNetWorthCents: 50000000, benefit: 'Improves readiness for contracts, disputes, and legal exposure.' },
  { id: 'tax-advisor', role: 'Tax advisor', annualCostCents: 2400000, minimumNetWorthCents: 30000000, benefit: 'Reduces avoidable tax mistakes without changing illegal-choice risk.' },
  { id: 'security', role: 'Security consultant', annualCostCents: 7200000, minimumNetWorthCents: 250000000, benefit: 'Reduces some high-profile lifestyle and political risk.' },
  { id: 'family-office', role: 'Family office', annualCostCents: 18000000, minimumNetWorthCents: 1000000000, benefit: 'Coordinates wealth, entities, advisors, and succession.' },
] as const;

export function weeklyJobListings(week: number) {
  const offset = Math.floor(week) % JOB_MARKET.length;
  return Array.from({ length: Math.min(6, JOB_MARKET.length) }, (_, index) => JOB_MARKET[(offset + index * 3) % JOB_MARKET.length]);
}

export function monthlyPropertyListings(week: number, cityId: string) {
  const month = Math.floor(week / 4);
  const templates = [
    { kind: 'condo', label: 'Downtown condo', base: 18000000, rent: 150000 },
    { kind: 'single-family', label: 'Three-bedroom house', base: 32000000, rent: 225000 },
    { kind: 'multifamily', label: 'Duplex', base: 46000000, rent: 390000 },
    { kind: 'multifamily', label: 'Eight-unit apartment', base: 165000000, rent: 1320000 },
    { kind: 'commercial', label: 'Neighborhood retail strip', base: 240000000, rent: 1780000 },
    { kind: 'commercial', label: 'Small office building', base: 390000000, rent: 2550000 },
    { kind: 'land', label: 'Development parcel', base: 125000000, rent: 0 },
  ] as const;
  return templates.slice(0, 5).map((template, index) => {
    const swing = 0.88 + (((month * 17 + index * 29 + cityId.length * 7) % 31) / 100);
    const valueCents = Math.round(template.base * swing);
    return {
      id: `listing-${month}-${index}`,
      name: `${template.label} #${((month + 1) * (index + 3)) % 97 + 1}`,
      kind: template.kind,
      valueCents,
      weeklyRentCents: Math.round(template.rent * swing),
      condition: 58 + ((month * 11 + index * 13) % 38),
      cityId,
    };
  });
}
