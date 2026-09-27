import { Link } from 'react-router-dom';
import { ArrowUpRight, Scissors, Sparkles } from 'lucide-react';
import './login-demos.css';
import { DEMO_STARTER } from './starter-plan';
export default function LoginDemos() {
 return <section className="login-demos" aria-labelledby="login-demos-title">
  <div className="login-demos-heading"><h3 id="login-demos-title">Conoce Nuvia en acción</h3><span>Sin cuenta</span></div>
  <p>Explora dos negocios de ejemplo y descubre cómo sería gestionar el tuyo.</p>
  <div className="login-demos-grid">
   <Link to="/demo/barberia" className="login-demo-card login-demo-barber" aria-label="Abrir demo de barbería"><Scissors size={24}/><span className="login-demo-category">CORTE & CARÁCTER</span><strong>Barbería</strong><span className="login-demo-action">Explorar demo <ArrowUpRight size={17}/></span></Link>
   <Link to="/demo/estetica" className="login-demo-card login-demo-spa" aria-label="Abrir demo de estética"><Sparkles size={24}/><span className="login-demo-category">BELLEZA & BIENESTAR</span><strong>Estética</strong><span className="login-demo-action">Explorar demo <ArrowUpRight size={17}/></span></Link>
  </div>
  <p className="login-demo-plan"><strong>Starter</strong> · Hasta {DEMO_STARTER.maxWorkers} trabajadores · {DEMO_STARTER.maxMonthlyAppointments} citas/mes · {DEMO_STARTER.maxStorageMb} MB<br/>Web · Fidelización · Copiloto IA · WhatsApp<br/>Sin multisucursal</p>
  <small>Datos ficticios. Sin reservas ni cobros reales.</small>
 </section>;
}
