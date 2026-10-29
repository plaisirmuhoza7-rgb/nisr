export const ORGANIZATION_PURPOSES=['fundraising','cooperative','impact'] as const;
export type OrganizationPurpose=typeof ORGANIZATION_PURPOSES[number];
export function organizationPurpose(value:unknown):OrganizationPurpose|undefined {
 return value==='fundraising'||value==='cooperative'||value==='impact'?value:undefined;
}
export const ORGANIZATION_LABELS:Record<OrganizationPurpose,string>={fundraising:'Fundraising organizer',cooperative:'Cooperative',impact:'NGO / Development organization'};
export type WorkspaceRequest={id:string;purpose:OrganizationPurpose;organizationName:string;district:string;description:string;status:'submitted';createdAt:string};
