import {z} from 'zod';

/** Shared request validation with actionable errors; values are never logged. */
export const groupCreateSchema=z.object({
 model:z.enum(['ACCUMULATING','ROTATING']),
 name:z.string().trim().min(2,'Enter a group name of at least 2 characters.').max(100,'Group name must be at most 100 characters.'),
 description:z.string().max(2000,'Description must be at most 2000 characters.'),
 location:z.string().trim().min(2,'Enter the group location.').max(100,'Location must be at most 100 characters.'),
 contact:z.string().trim().min(3,'Enter a contact phone number.').max(150,'Contact must be at most 150 characters.'),
 administratorLabel:z.string().max(120,'Administrator name must be at most 120 characters.').default(''),
 expectedMembers:z.number().int().min(2,'Enter at least 2 members.').max(500,'Enter no more than 500 members.'),
 contributionAmount:z.number().int().min(1,'Contribution must be at least 1 RWF.').max(9_007_199_254_740_991,'Contribution is too large.'),
 frequency:z.enum(['weekly','monthly']),
 startDate:z.iso.date({error:'Enter a valid start date.'}),
 endDate:z.iso.date({error:'Enter a valid cycle end date.'}),
 shareOutDate:z.iso.date({error:'Enter a valid payout date.'}),
 rotationOrder:z.array(z.string().trim().min(1).max(120)).max(500),
 reserveBps:z.number().int().min(0,'Reserve cannot be negative.').max(10000,'Reserve cannot exceed 100%.'),
 accepted:z.literal(true,{error:'Confirm that the group agreed to its rules.'}),
});
