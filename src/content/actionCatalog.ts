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
  { id: 'education.apply', domain: 'education', label: 'Apply', summary: 'Apply to an education pathway.' },
  { id: 'education.enroll', domain: 'education', label: 'Enroll', summary: 'Accept a place and enroll.' },
  { id: 'education.study', domain: 'education', label: 'Prioritize study', summary: 'Place academics in a focus slot.' },
  { id: 'education.withdraw', domain: 'education', label: 'Withdraw', summary: 'Leave an active program.', destructive: true, confirmationMandatory: true },
  { id: 'career.apply', domain: 'career', label: 'Apply for work', summary: 'Attempt to enter or change a job.' },
  { id: 'career.request_raise', domain: 'career', label: 'Request a raise', summary: 'Negotiate compensation from your current position.' },
  { id: 'career.quit', domain: 'career', label: 'Quit', summary: 'Resign from the current job.', destructive: true, confirmationMandatory: true },
  { id: 'business.create', domain: 'business', label: 'Start a business', summary: 'Found a local business with personal capital.' },
  { id: 'business.contribute_capital', domain: 'business', label: 'Add capital', summary: 'Move personal cash into a business.' },
  { id: 'business.borrow', domain: 'business', label: 'Borrow', summary: 'Add business debt and runway.', confirmationMandatory: true },
  { id: 'business.advertise', domain: 'business', label: 'Set marketing', summary: 'Change marketing as a share of revenue.' },
  { id: 'business.set_price', domain: 'business', label: 'Set pricing', summary: 'Choose value, market, or premium positioning.' },
  { id: 'business.hire', domain: 'business', label: 'Hire', summary: 'Add people and operating capacity.' },
  { id: 'business.delegate', domain: 'business', label: 'Delegate', summary: 'Put routine operations under management.' },
  { id: 'business.raise_capital', domain: 'business', label: 'Raise capital', summary: 'Trade ownership for outside capital.', confirmationMandatory: true },
  { id: 'business.sell', domain: 'business', label: 'Sell business', summary: 'Exit the company at its current valuation.', destructive: true, confirmationMandatory: true },
  { id: 'property.buy', domain: 'property', label: 'Buy property', summary: 'Purchase a property with cash and financing.' },
  { id: 'property.sell', domain: 'property', label: 'Sell', summary: 'Sell a property at the current market value.', destructive: true, confirmationMandatory: true },
  { id: 'property.rent_out', domain: 'property', label: 'Rent it out', summary: 'Operate the property as a rental.' },
  { id: 'property.set_rent', domain: 'property', label: 'Set rent', summary: 'Change the weekly rent target.' },
  { id: 'property.renovate', domain: 'property', label: 'Renovate', summary: 'Spend cash to improve condition and value.' },
  { id: 'property.manage', domain: 'property', label: 'Hire management', summary: 'Trade fees for fewer interruptions.' },
  { id: 'property.refinance', domain: 'property', label: 'Refinance', summary: 'Reset property debt and release eligible equity.', confirmationMandatory: true },
  { id: 'markets.buy', domain: 'markets', label: 'Buy', summary: 'Buy a generated public security.' },
  { id: 'markets.sell', domain: 'markets', label: 'Sell', summary: 'Sell a generated public security.' },
  { id: 'markets.allocate', domain: 'markets', label: 'Auto-allocate', summary: 'Invest cash into the diversified market fund.' },
  { id: 'organization.create', domain: 'organization', label: 'Start an organization', summary: 'Create a club, movement, charity, political group, or other organization.' },
  { id: 'organization.join', domain: 'organization', label: 'Join', summary: 'Seek membership in an organization.' },
  { id: 'organization.fund', domain: 'organization', label: 'Fund', summary: 'Contribute resources to an organization.' },
  { id: 'organization.take_control_attempt', domain: 'organization', label: 'Attempt control', summary: 'Attempt a strategic, abstract change of control.', destructive: true, confirmationMandatory: true },
  { id: 'politics.run_for_office', domain: 'politics', label: 'Run for office', summary: 'Begin a campaign for eligible office.' },
  { id: 'politics.campaign_action', domain: 'politics', label: 'Campaign', summary: 'Spend time and funds to build support.' },
  { id: 'politics.policy_action', domain: 'politics', label: 'Set policy', summary: 'Exercise authority within the current office.' },
  { id: 'legal.hire_counsel', domain: 'legal', label: 'Hire counsel', summary: 'Improve legal representation.' },
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
