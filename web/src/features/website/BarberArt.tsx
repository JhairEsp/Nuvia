import { Scissors } from 'lucide-react';
import chair from './assets/barber-chair.webp';
/** Arte decorativo; nunca se presenta como fotografía de un local o trabajo real. */
export function BarberArt({small=false}:{small?:boolean}) {
 return <div className={`nw-barber-art ${small?'nw-barber-art-small':''}`} aria-hidden="true">
  <img src={chair} alt="" decoding="async"/>
  <div className="nw-barber-light"/>
  <div className="nw-barber-seal"><span>OFICIO & ESTILO</span><Scissors size={30}/><span>BARBERÍA</span></div>
  <span className="nw-barber-art-credit">Arte decorativo · Nuvia</span>
 </div>;
}
export function BarberRibbon(){return <div className="nw-barber-ribbon" aria-hidden="true"><div>{[0,1].map(n=><span key={n}>OFICIO <i>✦</i> DETALLE <i>✦</i> CARÁCTER <i>✦</i> ESTILO <i>✦</i> </span>)}</div></div>;}
