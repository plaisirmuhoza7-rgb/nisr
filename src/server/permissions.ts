import type { Actor, Role } from '@/lib/contracts';
export class DomainError extends Error {constructor(message:string,public status=400){super(message);this.name='DomainError';}}
export type Permission='read'|'contribute'|'request'|'approve'|'repay'|'manage'|'report';
const matrix:Record<Role,Record<string,Permission[]>>={
 member:{'group-ubumwe':['read','contribute','request','repay'],'fund-school':['read','contribute']},
 president:{'group-ubumwe':['read','contribute','request','approve','repay','manage','report'],'coop-imena':['read','contribute','request','approve','manage','report'],'fund-school':['read','contribute','request','approve','manage','report']},
 treasurer:{'group-ubumwe':['read','contribute','repay','manage','report'],'coop-imena':['read','contribute','manage','report'],'fund-school':['read','contribute','request','manage','report']},
 accountant:{'group-ubumwe':['read','contribute','request','repay','report'],'coop-imena':['read','report'],'fund-school':['read','request','report']},
 secretary:{'group-ubumwe':['read','contribute','repay','report'],'coop-imena':['read','report'],'fund-school':['read']},
 cooperative:{'coop-imena':['read','contribute','request','approve','manage','report'],'fund-school':['read','contribute']},
 ngo:{'ngo-imizi':['read','manage','report'],'fund-school':['read','contribute']}
};
export async function assertPermission(actor:Actor,orgId:string,action:Permission):Promise<void>{
 const targetOrg = orgId.startsWith('coop-') ? 'coop-imena' : orgId.startsWith('group-') ? 'group-ubumwe' : orgId.startsWith('fund-') ? 'fund-school' : orgId;
 if(!actor.tenantId || !actor.userId || !matrix[actor.role]?.[targetOrg]?.includes(action)) throw new DomainError('Your role cannot perform this action in this organization.',403);
}
export function orgPermissions(role:Role){return matrix[role];}
