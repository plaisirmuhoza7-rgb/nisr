'use client';
import {useState} from 'react';
import s from '../info.module.css';
import {useLanguage} from '@/lib/i18n/context';

export default function Calculator(){
  const { t, isKinyarwanda } = useLanguage();
  const [organizations,setOrganizations]=useState(10),[price,setPrice]=useState(20000),[cost,setCost]=useState(5000);
  const revenue=BigInt(organizations)*BigInt(price);
  const contribution=BigInt(organizations)*BigInt(price-cost);

  const fields: [string, number, (n:number)=>void, number][] = isKinyarwanda ? [
    ['Imiryango yishyura', organizations, setOrganizations, 100000],
    [`Igiciro ku kwezi kuri buri muryango (${t.common.rwf})`, price, setPrice, 10000000],
    [`Ibiciro bihinduka kuri buri muryango (${t.common.rwf})`, cost, setCost, 10000000]
  ] : [
    ['Paying organizations', organizations, setOrganizations, 100000],
    ['Monthly price per organization (RWF)', price, setPrice, 10000000],
    ['Variable cost per organization (RWF)', cost, setCost, 10000000]
  ];

  return <article className={s.card}>
    <span className={s.pill}>{isKinyarwanda ? 'Ibitekerezo by’igerageza' : 'Hypothetical assumptions'}</span>
    <h2>{isKinyarwanda ? 'Genzura ubukungu bw’ubwisungane' : 'Explore subscription economics'}</h2>
    <p>{isKinyarwanda ? 'Hindura iyi mibare kugira ngo urebe uko uburyo bwo kwiyandikisha ku kwezi bwakora. Iyi mibare ni iy’icyitegererezo gusa, si igiciro cyemejwe cyangwa inyungu ziriho.' : 'Change the assumptions to explore a possible monthly subscription model. These are illustrative inputs, not validated prices, customers, or actual revenue.'}</p>
    <div className={s.form}>
      {fields.map(([label,value,set,max])=><label key={String(label)}>{String(label)}<input type="number" min="0" max={Number(max)} value={Number(value)} onChange={e=>(set as (n:number)=>void)(Math.max(0,Math.min(Number(max),Math.floor(Number(e.target.value)||0))))}/></label>)}
    </div>
    <p>{isKinyarwanda ? 'Umusaruro w’icyitegererezo ku kwezi' : 'Illustrative monthly revenue'}<strong className={s.result}>{revenue.toLocaleString()} {t.common.rwf}</strong></p>
    <p>{isKinyarwanda ? 'Umusaruro ukuyemo ibiciro bihinduka' : 'Revenue less assumed variable costs'}<strong className={s.result}>{contribution.toLocaleString()} {t.common.rwf}</strong></p>
    <p>{isKinyarwanda ? 'Ntiharimo ibiciro by’ikoranabuhanga, imisoro, n’ubufasha. Ibi ntabwo ari iteganyamutungo ry’inyungu.' : 'Excludes fixed engineering, sales, compliance, taxes, implementation, and support costs. This is not a profit forecast.'}</p>
  </article>;
}
