import {NextResponse} from 'next/server';
import {z} from 'zod';
import {calculateScenario} from '@/lib/guardian';
import {apiError,checkMutation} from '@/server/http';
const n=z.number().int().min(0).max(1_000_000_000_000);
export async function POST(request:Request){try{checkMutation(request);const input=z.object({cash:n,reserveBps:n.max(10000),requests:n.max(1000),loanAmount:n,contributions:n,expectedRepayments:n,delayBps:n.max(10000),investment:n,outstandingLoans:n}).parse(await request.json());return NextResponse.json(calculateScenario(input));}catch(error){return apiError(error);}}
