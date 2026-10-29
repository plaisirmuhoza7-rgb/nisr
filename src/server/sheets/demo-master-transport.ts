import {GoogleAuth} from 'google-auth-library';
import {randomInt} from 'node:crypto';
import {decodeDemoEnvelope, encodeDemoEnvelope, type DecodedDemoEnvelope, type DemoMasterSlot} from './demo-envelope';

const MASTER_TAB = 'HURIZA master';
const TAB_MARKER = 'HURIZA_ENCRYPTED_DEMO_MASTER_V1';
const ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
type RequestOptions = {url:string; method?:'GET'|'POST'; data?:unknown};
export type MasterRequest = (options:RequestOptions) => Promise<unknown>;

/** The master tab is shared at the file level; its snapshot is authenticated ciphertext. */
export function createDemoMasterTransport(spreadsheetId:string, key:Buffer, request:MasterRequest = googleRequest) {
  if (!ID_PATTERN.test(spreadsheetId)) throw new Error('Invalid demo spreadsheet ID.');
  if (!Buffer.isBuffer(key) || key.length!==32) throw new Error('A 32-byte demo master key is required.');
  const base=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;

  async function readRange(range:string):Promise<unknown[][]> {
    const url=`${base}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
    const raw=await request({url}) as {values?:unknown[][]};
    return Array.isArray(raw.values)?raw.values:[];
  }
  async function marker():Promise<void> {
    const rows=await readRange("'HURIZA master'!L1");
    if(rows[0]?.[0]!==TAB_MARKER)throw new Error('Demo master tab is missing or not owned by HURIZA.');
  }
  async function read():Promise<DecodedDemoEnvelope|null> {
    await marker();
    const raw=await readRange("'HURIZA master'!A1:K47");
    const grid=Array.from({length:47},(_,r)=>Array.from({length:11},(_,c)=>raw[r]?.[c]??''));
    const slots:DecodedDemoEnvelope[]=[];
    for(const [slot,start] of [['A',0],['B',6]] as const){
      const cells=grid.map(row=>row.slice(start,start+5));
      if(cells.every(row=>row.every(value=>value==='')))continue;
      slots.push(decodeDemoEnvelope(cells,{slot,key}));
    }
    if(slots.length===0)return null;
    slots.sort((a,b)=>BigInt(a.revision)<BigInt(b.revision)?1:BigInt(a.revision)>BigInt(b.revision)?-1:0);
    if(slots.length===2 && BigInt(slots[0].revision)-BigInt(slots[1].revision)!==1n)throw new Error('Demo master generations are inconsistent.');
    return slots[0];
  }
  async function write(slot:DemoMasterSlot,revision:string,payload:string):Promise<void> {
    await marker();
    const update=encodeDemoEnvelope({slot,revision,payload,key});
    await request({url:`${base}/values:batchUpdate`,method:'POST',data:{valueInputOption:'RAW',data:[update]}});
  }
  return {read,write};
}

async function googleRequest(options:RequestOptions):Promise<unknown> {
  try {
    const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets']});
    const client=await auth.getClient();
    const result=await client.request({url:options.url,method:options.method??'GET',data:options.data,timeout:15000,retry:false});
    return result.data;
  } catch { throw new Error('Demo master spreadsheet is unavailable.'); }
}

/** Called only by a trusted local bootstrap after confirming this tab does not exist. */
export async function prepareDemoMasterTab(spreadsheetId:string):Promise<void> {
  if(!ID_PATTERN.test(spreadsheetId))throw new Error('Invalid demo spreadsheet ID.');
  const base=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const metadata=await googleRequest({url:`${base}?fields=sheets(properties(sheetId,title))`}) as {sheets?:{properties?:{sheetId?:number;title?:string}}[]};
  if(metadata.sheets?.some(sheet=>sheet.properties?.title===MASTER_TAB))throw new Error('A HURIZA master tab already exists; it was not changed.');
  // A fixed random integer identifies the newly created tab in this atomic batch.
  let sheetId:number;
  do {sheetId=randomInt(100000000,2000000000);} while(metadata.sheets?.some(sheet=>sheet.properties?.sheetId===sheetId));
  await googleRequest({url:`${base}:batchUpdate`,method:'POST',data:{requests:[
    {addSheet:{properties:{sheetId,title:MASTER_TAB,hidden:true,gridProperties:{rowCount:100,columnCount:13}}}},
    {updateCells:{start:{sheetId,rowIndex:0,columnIndex:11},rows:[{values:[{userEnteredValue:{stringValue:TAB_MARKER}}]}],fields:'userEnteredValue'}},
  ]}});
}
