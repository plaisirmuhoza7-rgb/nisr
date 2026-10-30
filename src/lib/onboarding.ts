export const ORGANIZATION_PURPOSES=['fundraising','cooperative'] as const;
export type OrganizationPurpose=typeof ORGANIZATION_PURPOSES[number];
export function organizationPurpose(value:unknown):OrganizationPurpose|undefined {
 return value==='fundraising'||value==='cooperative'?value:undefined;
}
export const ORGANIZATION_LABELS:Record<OrganizationPurpose,string>={fundraising:'Fundraising organizer',cooperative:'Cooperative'};
export type WorkspaceRequest={id:string;purpose:OrganizationPurpose;organizationName:string;district:string;description:string;status:'submitted';createdAt:string};
