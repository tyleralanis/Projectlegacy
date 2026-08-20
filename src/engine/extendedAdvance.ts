import { allocateId } from './createWorld';
import { recordHistory } from './history';
import type { WorldState } from './types';

function parseMarker(marker: string, prefix: string): { type: string; weeklyCostCents: number; quality: number } | null {
  if (!marker.startsWith(prefix)) return null;
  const [, type, cost, quality] = marker.split(':');
  return { type, weeklyCostCents: Number(cost) || 0, quality: Number(quality) || 50 };
}

export function applyExtendedAdvance(world: WorldState, weeks: number): WorldState {
  if (weeks <= 0) return world;
  const actor = world.characters[world.playerCharacterId];

  for (const business of Object.values(world.businesses)) {
    if (!business.active || (business.ownerId ?? business.founderId) !== actor.id) continue;
    const organization = world.organizations[business.organizationId];
    const leaderId = organization?.leaderId;
    if (!leaderId || leaderId === actor.id) continue;
    const executive = world.characters[leaderId];
    const executiveCareer = Object.values(world.careers).find((career) => career.characterId === leaderId && career.employerId === business.organizationId && career.active);
    if (!executive || !executiveCareer) continue;
    const payroll = executiveCareer.weeklySalaryCents * weeks;
    if (business.cashCents < payroll) {
      business.cashCents -= Math.min(business.cashCents, payroll);
      executiveCareer.active = false;
      organization.leaderId = actor.id;
      business.delegated = false;
      recordHistory(world, 'business', 'CEO leaves', `${executive.firstName} ${executive.lastName} left ${business.name} after the company could no longer sustain executive payroll. You are back in the operator seat.`, { important: true });
      continue;
    }
    business.cashCents -= payroll;
    business.costWeeklyCents += executiveCareer.weeklySalaryCents;
    executiveCareer.weeksInRole += weeks;
    const executiveFit = Math.max(0, Math.min(100, executiveCareer.performance));
    business.capacity *= 1 + Math.min(0.08, executiveFit / 30_000 * weeks);
    business.quality = Math.min(100, business.quality + Math.min(3.5, (executive.discipline - 50) / 600 * weeks));
    business.reputation = Math.min(100, business.reputation + Math.min(2.5, (executive.reputation.professional - 50) / 900 * weeks));
  }

  for (const organization of Object.values(world.organizations)) {
    if (!organization.memberIds.includes(actor.id)) continue;
    const serviceMarker = organization.history.map((item) => parseMarker(item, 'service:')).find(Boolean);
    const gymMarker = organization.history.map((item) => parseMarker(item, 'membership:')).find(Boolean);
    const marker = serviceMarker ?? gymMarker;
    if (!marker || marker.weeklyCostCents <= 0) continue;
    const due = marker.weeklyCostCents * weeks;
    if (actor.cashCents < due) {
      organization.memberIds = organization.memberIds.filter((id) => id !== actor.id);
      if (marker.type === 'property-manager') Object.values(world.properties).filter((property) => property.ownerId === actor.id).forEach((property) => { property.managed = false; });
      recordHistory(world, marker.type === 'gym' ? 'health' : 'markets', 'Service ended', `${organization.name} ended because the recurring cost could not be covered.`, { important: false });
      continue;
    }
    actor.cashCents -= due;
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'professional-retainer', amountCents: -due, fromId: actor.id, toId: organization.id, memo: `${weeks} weeks of ${organization.name}` });
    organization.resourcesCents += due;
    if (marker.type === 'personal-assistant') actor.stress = Math.max(0, actor.stress - Math.min(8, weeks * 0.16));
    if (marker.type === 'attorney') Object.values(world.legalCases).filter((legalCase) => legalCase.characterId === actor.id && legalCase.stage !== 'resolved').forEach((legalCase) => { legalCase.counselQuality = Math.max(legalCase.counselQuality, marker.quality); legalCase.risk = Math.max(0, legalCase.risk - Math.min(6, weeks * 0.08)); });
    if (marker.type === 'property-manager') Object.values(world.properties).filter((property) => property.ownerId === actor.id).forEach((property) => { property.managed = true; });
    if (marker.type === 'accountant') actor.reputation.professional = Math.min(100, actor.reputation.professional + Math.min(1.5, weeks * 0.02));
    if (marker.type === 'wealth-manager') actor.discipline = Math.min(100, actor.discipline + Math.min(1.2, weeks * 0.015));
    if (marker.type === 'security') actor.stress = Math.max(0, actor.stress - Math.min(2.5, weeks * 0.04));
  }

  return world;
}
