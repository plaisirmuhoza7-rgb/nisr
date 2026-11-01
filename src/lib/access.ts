import type {Role} from './contracts';
export type Workspace='personal'|'groups'|'fundraising'|'cooperative'|'guardian'|'simulator'|'connect';
export interface AccountMembership {orgId:string;role:Role}
export interface AccountUser {id:string;name:string;email:string;role:Role;tenantId:string;workspaces:Workspace[];homeWorkspace:Workspace;organizationName:string|null;memberships:AccountMembership[];emailVerified:boolean;isTestAccount:boolean;dedicatedWorkspace?:Workspace|null}
export const WORKSPACES:Workspace[]=['personal','groups','fundraising','cooperative','guardian','simulator','connect'];
export function accessibleWorkspaces(role:Role,memberships:AccountMembership[],dedicatedWorkspace?:Workspace|null):Workspace[]{
 if(dedicatedWorkspace)return [dedicatedWorkspace];
 const own=(orgId:string)=>memberships.some(m=>m.orgId===orgId&&m.role===role);
 return WORKSPACES.filter(w=>['personal','guardian','simulator'].includes(w)||w==='groups'&&memberships.some(m=>m.orgId.startsWith('group-'))||w==='connect'&&own('group-ubumwe')||w==='fundraising'&&own('fund-school')||w==='cooperative'&&(role==='cooperative'&&own('coop-imena')||memberships.some(m=>m.orgId.startsWith('coop-'))));
}
export function homeWorkspace(role:Role,workspaces:Workspace[],dedicatedWorkspace?:Workspace|null):Workspace {
 if(dedicatedWorkspace&&workspaces.includes(dedicatedWorkspace))return dedicatedWorkspace;
 const preferred:Workspace=role==='cooperative'?'cooperative':['president','treasurer','accountant','secretary'].includes(role)?'groups':'personal';
 return workspaces.includes(preferred)?preferred:workspaces[0]||'personal';
}
export function safeAccountRedirect(requested:unknown,user:Pick<AccountUser,'workspaces'|'homeWorkspace'>):string {
 if(user.workspaces.length===1&&['groups','cooperative'].includes(user.homeWorkspace)&&(requested==='/app/groups/start'||requested==='/app/onboarding'||typeof requested==='string'&&requested.startsWith('/app/onboarding?')))return `/app/${user.homeWorkspace}`;
 if(requested==='/app/groups/start')return user.workspaces.includes('groups')?'/app/groups':requested;
 if(requested==='/app/onboarding'||['fundraising','cooperative'].some(purpose=>requested===`/app/onboarding?purpose=${purpose}`))return user.workspaces.some(w=>requested===`/app/onboarding?purpose=${w}`)&&user.workspaces.length===1?`/app/${user.homeWorkspace}`:requested as string;
 if(typeof requested==='string'&&user.workspaces.some(w=>requested===`/app/${w}`))return requested;
 return `/app/${user.homeWorkspace}`;
}
