import type { Domain } from '@/engine/types';

export interface ActionDefinition {
  id: string;
  domain: Domain;
  label: string;
  destructive?: boolean;
  confirmationMandatory?: boolean;
  summary: string;
}

export const ACTION_CATALOG: ActionDefinition[] = [
  { id: 'relationship.contact', domain: 'relationship', label: 'Reach out', summary: 'Contact someone in your network.' },
  { id: 'relationship.spend_time', domain: 'relationship', label: 'Spend time', summary: 'Invest time in a relationship.' },
  { id: 'relationship.date', domain: 'relationship', label: 'Ask on a date', summary: 'Explore a partnership with an eligible person.' },
  { id: 'relationship.support', domain: 'relationship', label: 'Offer support', summary: 'Offer practical and emotional support.' },
  { id: 'relationship.transfer_cash', domain: 'relationship', label: 'Give money', summary: 'Transfer cash to a person.', confirmationMandatory: true },
  { id: 'relationship.propose', domain: 'relationship', label: 'Propose', summary: 'Ask a partner to marry.' },
  { id: 'relationship.separate', domain: 'relationship', label: 'Separate', summary: 'End a partnership.', destructive: true, confirmationMandatory: true },
  { id: 'relationship.prioritize', domain: 'relationship', label: 'Make them a priority', summary: 'Protect recurring time for this relationship in the weekly time budget.' },
  { id: 'relationship.deep_talk', domain: 'relationship', label: 'Have a real conversation', summary: 'Try to deepen understanding or work through something that is not surface-level.' },
  { id: 'relationship.check_in', domain: 'relationship', label: 'Ask about their life', summary: 'Check in on what is actually happening in the other person’s life.' },
  { id: 'relationship.apologize', domain: 'relationship', label: 'Apologize', summary: 'Take responsibility for unresolved hurt without erasing the history.' },
  { id: 'relationship.forgive', domain: 'relationship', label: 'Forgive', summary: 'Reduce active resentment while allowing trust to rebuild separately.' },
  { id: 'relationship.celebrate', domain: 'relationship', label: 'Celebrate them', summary: 'Spend time and money making an important moment in their life feel noticed.' },
  { id: 'relationship.gift', domain: 'relationship', label: 'Give a thoughtful gift', summary: 'Give a meaningful gift whose impact depends on the relationship, not only the price.', confirmationMandatory: true },
  { id: 'relationship.date_night', domain: 'relationship', label: 'Plan a date night', summary: 'Protect a night for an active romantic relationship.' },
  { id: 'relationship.weekend_away', domain: 'relationship', label: 'Take a weekend away', summary: 'Spend more money and time creating a larger shared romantic memory.', confirmationMandatory: true },
  { id: 'relationship.support_goal', domain: 'relationship', label: 'Support their goal', summary: 'Back something the other person is trying to accomplish in their own life.' },
  { id: 'relationship.ask_favor', domain: 'relationship', label: 'Ask a favor', summary: 'Ask the relationship to carry some practical weight and remember the obligation.' },
  { id: 'relationship.lend_money', domain: 'relationship', label: 'Lend money', summary: 'Create a personal loan that remains part of the relationship until repaid.', confirmationMandatory: true },
  { id: 'relationship.collect_loan', domain: 'relationship', label: 'Ask for repayment', summary: 'Ask someone to repay money they owe you.' },
  { id: 'relationship.set_boundary', domain: 'relationship', label: 'Set a boundary', summary: 'Protect a line in the relationship, even if the immediate reaction is uncomfortable.' },
  { id: 'relationship.one_on_one', domain: 'relationship', label: 'Spend one-on-one time', summary: 'Give this person attention that is not shared with work, family, or a group.' },
  { id: 'relationship.reminisce', domain: 'relationship', label: 'Reminisce', summary: 'Bring an older shared memory back into the current relationship.' },
  { id: 'relationship.plan_future', domain: 'relationship', label: 'Plan the future', summary: 'Create expectations in a committed relationship that later choices can honor or contradict.' },
  { id: 'relationship.introduce_network', domain: 'relationship', label: 'Make an introduction', summary: 'Use your network to create a real relationship between this person and one of your contacts.' },
  { id: 'family.family_dinner', domain: 'family', label: 'Have a family dinner', summary: 'Bring nearby family together for ordinary shared time.' },
  { id: 'family.help_school', domain: 'family', label: 'Help with school', summary: 'Help a child or younger relative academically while building the relationship.' },
  { id: 'family.teach_money', domain: 'family', label: 'Teach about money', summary: 'Pass along financial judgment and habits to a family member.' },
  { id: 'family.attend_event', domain: 'family', label: 'Show up for their event', summary: 'Spend time being present for something important in a family member’s life.' },
  { id: 'family.caregiving', domain: 'family', label: 'Help care for them', summary: 'Take on practical cost and stress to help an aging or unhealthy family member.' },
  { id: 'family.set_expectations', domain: 'family', label: 'Set expectations', summary: 'Parent with boundaries whose result depends on trust, empathy, and discipline.' },
  { id: 'family.invite_business', domain: 'family', label: 'Bring into the business', summary: 'Hire a family member into a company and entangle work, loyalty, performance, and succession.' },
  { id: 'family.discuss_inheritance', domain: 'family', label: 'Discuss inheritance', summary: 'Reduce ambiguity around money, control, succession, and expectations before death forces the issue.' },

  { id: 'education.apply', domain: 'education', label: 'Apply', summary: 'Apply to a specific education pathway.' },
  { id: 'education.enroll', domain: 'education', label: 'Enroll', summary: 'Accept a place and enroll.' },
  { id: 'education.study', domain: 'education', label: 'Study', summary: 'Spend time improving academic performance.' },
  { id: 'education.pay_tuition', domain: 'education', label: 'Pay tuition', summary: 'Pay some or all of the current academic-year tuition bill.' },
  { id: 'education.party', domain: 'education', label: 'Go out', summary: 'Trade study time for mood, social connections, and possible consequences.' },
  { id: 'education.sports', domain: 'education', label: 'Play college sports', summary: 'Build fitness, school ties, and reputation through athletics.' },
  { id: 'education.withdraw', domain: 'education', label: 'Drop out', summary: 'Leave an active program.', destructive: true, confirmationMandatory: true },

  { id: 'career.apply', domain: 'career', label: 'Apply for work', summary: 'Apply to a specific opening weighted against the resume.' },
  { id: 'career.request_raise', domain: 'career', label: 'Request a raise', summary: 'Negotiate compensation from your current position.' },
  { id: 'career.quit', domain: 'career', label: 'Quit', summary: 'Resign from the current job.', destructive: true, confirmationMandatory: true },

  { id: 'business.create', domain: 'business', label: 'Start a business', summary: 'Found a business with personal capital and a weekly time burden.' },
  { id: 'business.contribute_capital', domain: 'business', label: 'Add capital', summary: 'Move personal cash into a business.' },
  { id: 'business.borrow', domain: 'business', label: 'Borrow', summary: 'Add business debt and runway.', confirmationMandatory: true },
  { id: 'business.advertise', domain: 'business', label: 'Set marketing', summary: 'Change marketing as a share of revenue.' },
  { id: 'business.set_price', domain: 'business', label: 'Set pricing', summary: 'Choose value, market, or premium positioning.' },
  { id: 'business.hire', domain: 'business', label: 'Hire', summary: 'Add people and operating capacity.' },
  { id: 'business.delegate', domain: 'business', label: 'Hire a CEO', summary: 'Hire professional management so ownership consumes less personal time.' },
  { id: 'business.hire_ceo', domain: 'business', label: 'Hire selected CEO', summary: 'Choose a specific executive by salary, management ability, leadership, finance, and sector fit.' },
  { id: 'business.raise_capital', domain: 'business', label: 'Raise capital', summary: 'Trade ownership for outside capital.', confirmationMandatory: true },
  { id: 'business.sell', domain: 'business', label: 'Sell business', summary: 'Exit the company at its current valuation.', destructive: true, confirmationMandatory: true },

  { id: 'property.buy', domain: 'property', label: 'Buy property', summary: 'Purchase a listed residential or commercial property with cash and financing.' },
  { id: 'property.sell', domain: 'property', label: 'Sell', summary: 'Sell a property at the current market value.', destructive: true, confirmationMandatory: true },
  { id: 'property.rent_out', domain: 'property', label: 'Find a tenant', summary: 'Operate the property as a rental.' },
  { id: 'property.evict', domain: 'property', label: 'End tenancy', summary: 'Remove the current tenant through an abstract legal process.', confirmationMandatory: true },
  { id: 'property.set_rent', domain: 'property', label: 'Set rent', summary: 'Change the weekly rent target.' },
  { id: 'property.renovate', domain: 'property', label: 'Renovate', summary: 'Spend cash on kitchens, bathrooms, systems, or general improvements.' },
  { id: 'property.manage', domain: 'property', label: 'Hire management', summary: 'Trade fees for fewer routine property interruptions.' },
  { id: 'property.refinance', domain: 'property', label: 'Refinance', summary: 'Reset property debt and release eligible equity.', confirmationMandatory: true },

  { id: 'markets.buy', domain: 'markets', label: 'Buy', summary: 'Buy a generated public security.' },
  { id: 'markets.sell', domain: 'markets', label: 'Sell', summary: 'Sell a generated public security.' },
  { id: 'markets.allocate', domain: 'markets', label: 'Auto-allocate', summary: 'Invest cash into the diversified market fund.' },
  { id: 'markets.hire_wealth_manager', domain: 'markets', label: 'Hire wealth manager', summary: 'Pay ongoing fees for portfolio oversight and better information.' },

  { id: 'health.run', domain: 'health', label: 'Go for a run', summary: 'Spend time improving fitness and reducing stress.' },
  { id: 'health.gym', domain: 'health', label: 'Go to the gym', summary: 'Pay for a visit or use a membership and improve fitness.' },
  { id: 'health.join_gym', domain: 'health', label: 'Join gym', summary: 'Buy an annual gym membership so future visits are included.' },
  { id: 'health.group_class', domain: 'health', label: 'Take a group class', summary: 'Pay for wellness, fitness, and a chance to meet someone.' },
  { id: 'health.therapy', domain: 'health', label: 'Go to therapy', summary: 'Pay for help reducing stress and improving mood.' },
  { id: 'health.outdoors', domain: 'health', label: 'Get outside', summary: 'Spend time outdoors for mood and health.' },

  { id: 'life.move_city', domain: 'life', label: 'Move cities', summary: 'Relocate within or across regions and change local opportunities and costs.' },
  { id: 'life.emigrate', domain: 'life', label: 'Emigrate', summary: 'Move to another country and reset local ties and opportunities.', confirmationMandatory: true },

  { id: 'organization.create', domain: 'organization', label: 'Start an organization', summary: 'Create a club, movement, charity, political group, or other organization.' },
  { id: 'organization.join', domain: 'organization', label: 'Join', summary: 'Seek membership in an organization.' },
  { id: 'organization.fund', domain: 'organization', label: 'Fund', summary: 'Contribute resources to an organization.' },
  { id: 'organization.take_control_attempt', domain: 'organization', label: 'Attempt control', summary: 'Attempt a strategic, abstract change of control.', destructive: true, confirmationMandatory: true },

  { id: 'politics.run_for_office', domain: 'politics', label: 'Run for office', summary: 'Begin a campaign for an eligible office.' },
  { id: 'politics.campaign_action', domain: 'politics', label: 'Campaign', summary: 'Spend time and funds to build support.' },
  { id: 'politics.press_conference', domain: 'politics', label: 'Hold press conference', summary: 'Risk approval on public speaking, reputation, and preparation.' },
  { id: 'politics.town_hall', domain: 'politics', label: 'Hold town hall', summary: 'Meet voters directly; empathy and speaking skill matter.' },
  { id: 'politics.fundraiser', domain: 'politics', label: 'Host fundraiser', summary: 'Build money and donor support using network and charisma.' },
  { id: 'politics.constituent_work', domain: 'politics', label: 'Do constituent work', summary: 'Spend time solving ordinary problems to build durable approval.' },
  { id: 'politics.policy_action', domain: 'politics', label: 'Set policy', summary: 'Exercise authority within the current office.' },

  { id: 'legal.hire_counsel', domain: 'legal', label: 'Hire counsel', summary: 'Hire an attorney for an active matter or ongoing advice.' },
  { id: 'legal.hire_private_counsel', domain: 'legal', label: 'Retain private counsel', summary: 'Pay a recurring premium for a standing personal attorney.' },
  { id: 'legal.cooperate', domain: 'legal', label: 'Cooperate', summary: 'Cooperate with an active matter.' },
  { id: 'legal.contest', domain: 'legal', label: 'Contest', summary: 'Contest an active legal matter.' },
  { id: 'misconduct.tax_evasion_attempt', domain: 'legal', label: 'Attempt tax evasion', summary: 'Abstract illegal shortcut with delayed exposure.', destructive: true, confirmationMandatory: true },
  { id: 'misconduct.insider_trade_attempt', domain: 'legal', label: 'Trade improperly', summary: 'Abstract confidential-information misconduct.', destructive: true, confirmationMandatory: true },
  { id: 'misconduct.bribery_attempt', domain: 'legal', label: 'Attempt bribery', summary: 'Abstract corruption choice with evidence risk.', destructive: true, confirmationMandatory: true },
  { id: 'misconduct.faction_power_seizure_attempt', domain: 'geopolitics', label: 'Attempt to seize power', summary: 'Strategic fictional power struggle without tactical detail.', destructive: true, confirmationMandatory: true },

  { id: 'estate.designate_successor', domain: 'dynasty', label: 'Designate successor', summary: 'Set a preferred eligible family successor.' },
  { id: 'estate.gift_asset', domain: 'dynasty', label: 'Gift an asset', summary: 'Transfer an owned asset to family.', confirmationMandatory: true },
];

export function actionsForDomains(domains: Domain[]): ActionDefinition[] {
  return ACTION_CATALOG.filter((action) => domains.includes(action.domain));
}

export function actionDefinition(actionId: string): ActionDefinition | undefined {
  return ACTION_CATALOG.find((action) => action.id === actionId);
}
