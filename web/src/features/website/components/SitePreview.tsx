import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { PublicSite } from '../../../types/domain';
import SiteRenderer from '../SiteRenderer';
import css from '../site.css?inline';
export default function SitePreview({site,width=1100,height=570,onEscape}:{site:PublicSite;width?:number;height?:number;onEscape?:()=>void}) {
 const container=useRef<HTMLDivElement>(null);const frame=useRef<HTMLIFrameElement>(null);
 const [notice,setNotice]=useState(false);const [available,setAvailable]=useState(width);const [target,setTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>{if(!container.current)return;const observer=new ResizeObserver(([entry])=>{if(entry)setAvailable(entry.contentRect.width);});observer.observe(container.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{const doc=target?.ownerDocument;if(!doc||!onEscape)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onEscape();};doc.addEventListener('keydown',key);return()=>doc.removeEventListener('keydown',key);},[target,onEscape]);
 const scale=Math.min(1,available/width)||1;
 return <div ref={container} style={{width:'100%',height,overflow:'hidden',position:'relative',background:'#e9e5df',borderRadius:12}}><iframe ref={frame} title="Vista previa privada de tu página" srcDoc="<!doctype html><html lang='es'><head><meta name='viewport' content='width=device-width, initial-scale=1'><link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap'><style>html,body{margin:0;padding:0}*{box-sizing:border-box}</style></head><body><div id='preview-root'></div></body></html>" onLoad={()=>setTarget(frame.current?.contentDocument?.getElementById('preview-root')??null)} style={{border:0,width,height:height/scale,transform:`scale(${scale})`,transformOrigin:'top left',position:'absolute',left:Math.max(0,(available-width*scale)/2),top:0}}/>{target&&createPortal(<><style>{css}</style><SiteRenderer site={site} preview onBook={()=>setNotice(true)}/></>,target)}{notice&&<button onClick={()=>setNotice(false)} style={{position:'absolute',bottom:12,left:12,right:12,padding:14,borderRadius:10,background:'#191410',color:'#fff',fontSize:12}}>Vista previa privada: las reservas funcionan en el enlace publicado. ×</button>}</div>;
}
