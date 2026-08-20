import type { ActionDefinition } from './actionCatalog';

export const DEPTH_ACTION_CATALOG: ActionDefinition[] = [
  { id: 'markets.research', domain: 'markets', label: 'Research investment', summary: 'Build a current thesis around a listed company instead of buying blind.' },
  { id: 'markets.set_strategy', domain: 'markets', label: 'Set investing strategy', summary: 'Choose a persistent investment philosophy such as index, value, growth, income, concentrated, or speculative.' },
  { id: 'markets.rebalance', domain: 'markets', label: 'Rebalance portfolio', summary: 'Reduce concentration by reweighting existing positions.' },

  { id: 'business.set_growth_posture', domain: 'business', label: 'Set growth posture', summary: 'Choose conservative, balanced, or aggressive company growth.' },
  { id: 'business.invest_quality', domain: 'business', label: 'Invest in quality', summary: 'Spend company cash on execution quality and customer reputation.' },
  { id: 'business.invest_rd', domain: 'business', label: 'Invest in R&D', summary: 'Spend company cash on capability, product, or process development.' },
  { id: 'business.reward_staff', domain: 'business', label: 'Reward staff', summary: 'Put company money behind employee rewards and culture.' },
  { id: 'business.expand_location', domain: 'business', label: 'Open another location', summary: 'Add physical operating capacity, headcount, cost, and management complexity.' },

  { id: 'education.choose_major', domain: 'education', label: 'Choose a major', summary: 'Give an active college degree a specialization that can shape later career stories.' },
  { id: 'education.office_hours', domain: 'education', label: 'Go to office hours', summary: 'Trade time for grades, knowledge, and faculty familiarity.' },
  { id: 'education.join_club', domain: 'education', label: 'Join a club', summary: 'Create a persistent campus organization and network.' },
  { id: 'education.internship', domain: 'education', label: 'Take an internship', summary: 'Turn college into real work experience and professional reputation.' },
  { id: 'education.sports_train', domain: 'education', label: 'Train seriously', summary: 'Invest in athletic development at a small academic and stress cost.' },
  { id: 'education.sports_compete', domain: 'education', label: 'Compete', summary: 'Create an athletic result that can affect reputation and opportunity.' },
  { id: 'education.sports_seek_scholarship', domain: 'education', label: 'Seek athletic scholarship', summary: 'Use a strong athletic profile to pursue education support.' },

  { id: 'career.work_hard', domain: 'career', label: 'Push at work', summary: 'Trade stress for performance and employee reputation.' },
  { id: 'career.network', domain: 'career', label: 'Build career network', summary: 'Invest in professional reputation and relationships around the job.' },
  { id: 'career.train', domain: 'career', label: 'Build job skills', summary: 'Improve competence rather than only tenure.' },
  { id: 'career.seek_promotion', domain: 'career', label: 'Push for promotion', summary: 'Make a promotion case based on tenure, performance, reputation, and people skills.' },
  { id: 'career.office_politics', domain: 'career', label: 'Navigate office politics', summary: 'Try to build internal support, with relationship risk if you misread the room.' },

  { id: 'organization.found_inner_circle', domain: 'organization', label: 'Start a private movement', summary: 'Unlock a hidden player-led movement with its own followers, resources, doctrine, cohesion, and strategic branches.' },
  { id: 'faction.set_archetype', domain: 'organization', label: 'Choose movement type', summary: 'Define a private movement as religious, military, political, communal, or commercial.' },
  { id: 'faction.recruit', domain: 'organization', label: 'Recruit followers', summary: 'Grow the movement at the cost of added organizational complexity.' },
  { id: 'faction.hold_gathering', domain: 'organization', label: 'Hold gathering', summary: 'Spend organization resources to build devotion and cohesion.' },
  { id: 'faction.collect_contributions', domain: 'organization', label: 'Collect contributions', summary: 'Raise organization money, with harsher collection creating social and legal exposure.' },
  { id: 'faction.buy_land', domain: 'organization', label: 'Buy land', summary: 'Use organization resources to acquire a persistent physical base.' },
  { id: 'faction.spread_doctrine', domain: 'organization', label: 'Spread doctrine', summary: 'Grow recognition, followers, and ideological reach.' },
  { id: 'faction.elevate_leader', domain: 'organization', label: 'Center doctrine on leader', summary: 'Increase devotion and leader status while reducing outside legitimacy.' },
  { id: 'faction.adopt_plural_household', domain: 'organization', label: 'Adopt plural household doctrine', summary: 'Allow consensual adult plural-spouse invitations within eligible movement types.' },
  { id: 'faction.invite_plural_spouse', domain: 'organization', label: 'Invite additional spouse', summary: 'Invite an adult follower into a consensual additional spouse relationship.' },
  { id: 'faction.build_security', domain: 'organization', label: 'Build security capacity', summary: 'Increase abstract organizational security readiness without tactical or weapons modeling.' },
  { id: 'faction.expand_public_influence', domain: 'organization', label: 'Build public influence', summary: 'Spend resources becoming more legitimate, visible, and politically relevant.' },
  { id: 'faction.member_welfare', domain: 'organization', label: 'Support members', summary: 'Spend resources on member welfare to build a more stable and cohesive movement.' },
  { id: 'faction.attempt_power_seizure', domain: 'geopolitics', label: 'Attempt national power seizure', summary: 'High-level fictional struggle for national control based on movement scale and institutional resistance.', destructive: true, confirmationMandatory: true },
];
