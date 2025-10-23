import React, { useEffect, useState, useRef } from 'react';
import { PROCESSES } from '../data/processes';
// React-Leaflet imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default icon path for Leaflet when using bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export default function NotarialSystem(){
  const [name, setName] = useState(localStorage.getItem('userName') || '');
  const [editingName, setEditingName] = useState(false);
  const [step, setStep] = useState(name ? 'list' : 'welcome');
  const [processes, setProcesses] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef();
  const [notariesNearby, setNotariesNearby] = useState([]);
  const [userPos, setUserPos] = useState(null);

  const sampleNotaries = [
    { id: 'n1', name: 'Notaría Paz', lat: -17.3936, lon: -66.1570, address: 'Calle Aroma 123' },
    { id: 'n2', name: 'Notaría Central', lat: -17.3989, lon: -66.1568, address: 'Plaza Principal 45' },
    { id: 'n3', name: 'Notaría Sucre', lat: -17.3920, lon: -66.1480, address: 'Av. Heroínas 230' },
    { id: 'n4', name: 'Notaría Cochabamba', lat: -17.3850, lon: -66.1560, address: 'C. España 10' }
  ];

  useEffect(()=> {
    fetch('/api/processes').then(r=>r.json()).then(data=>{
      setProcesses(data);
    }).catch(()=> setProcesses(PROCESSES));
  },[]);

  function saveName(e){
    e?.preventDefault();
    if(!name) return alert('Ingresa tu nombre');
    localStorage.setItem('userName', name);
    setStep('list');
    setEditingName(false);
  }

  function changeName(){
    setEditingName(true);
    setStep('welcome');
  }

  function openProcess(p){
    setSelectedProcess(p);
    setSelectedRequirement(null);
    setStep('process');
  }

  function validateFile(file){
    if(!file) return false;
    if(file.type !== 'application/pdf'){ alert('Solo se permiten PDF'); return false; }
    if(file.size > 15*1024*1024){ alert('Archivo mayor a 15MB'); return false; }
    return true;
  }

  function handleFileChange(e){
    const f = e.target.files[0];
    if(!f) return;
    if(!validateFile(f)) return;
    setSelectedFile(f);
  }

  async function upload(){
    if(!selectedFile || !selectedProcess || !selectedRequirement) return alert('Selecciona un requisito y un archivo');
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('processId', selectedProcess.id);
    fd.append('requirementId', selectedRequirement.id);
    fd.append('uploaderName', name);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if(res.ok){
      alert('Subida exitosa');
      const resp = await fetch('/api/processes');
      const data = await resp.json();
      setProcesses(data);
      const p = data.find(x=>x.id===selectedProcess.id);
      setSelectedProcess(p);
      setSelectedFile(null);
      if(fileRef.current) fileRef.current.value = '';
    } else {
      const err = await res.json().catch(()=>({}));
      alert('Error al subir: '+ (err.error||res.status));
    }
  }

  function distanceKm(lat1, lon1, lat2, lon2){
    const toRad = v => v*Math.PI/180;
    const R = 6371;
    const dLat = toRad(lat2-lat1);
    const dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R*c;
  }

  function findNearby(lat, lon){
    const nearby = sampleNotaries.map(n=>{
      return { ...n, dist: distanceKm(lat, lon, n.lat, n.lon) };
    }).filter(n=>n.dist < 50).sort((a,b)=>a.dist-b.dist);
    setNotariesNearby(nearby);
  }

  function askGeo(){
    if(!navigator.geolocation) return alert('Geolocalización no soportada');
    navigator.geolocation.getCurrentPosition(pos=>{
      setUserPos([pos.coords.latitude, pos.coords.longitude]);
      findNearby(pos.coords.latitude, pos.coords.longitude);
    }, err => {
      alert('No se pudo obtener la ubicación: '+err.message);
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="header">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <h1 style={{fontSize:24, fontWeight:700, color:'white'}}>Sistema Notarial - Interactivo</h1>
            <div style={{color:'rgba(255,255,255,0.9)'}}>Trámites y requisitos notariales de Bolivia</div>
          </div>
          <div>
            <button className="button" onClick={askGeo} style={{marginRight:8}}>Buscar notarias</button>
            <button className="button" onClick={changeName}>Cambiar nombre</button>
          </div>
        </div>
      </header>

      <main style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginTop:20}}>
        <section>
          {step==='welcome' && (
            <div className="card">
              <form onSubmit={saveName}>
                <label className="small">Tu nombre</label>
                <div style={{display:'flex', gap:10, marginTop:8}}>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Juan Pérez" style={{flex:1, padding:10, borderRadius:6, border:'1px solid #e5e7eb'}} />
                  <button className="button">Continuar</button>
                </div>
                <div className="small" style={{marginTop:8}}>Tu nombre se guardará localmente en este equipo.</div>
              </form>
            </div>
          )}

          {step==='list' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                <h2 style={{margin:0}}>Hola, <strong>{name}</strong>. Selecciona un trámite</h2>
                <button onClick={changeName} style={{background:'transparent', border:'none', color:'#0369a1', textDecoration:'underline'}}>Editar nombre</button>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12}}>
                {processes.map(p=>(
                  <div key={p.id} className="card" style={{display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
                    <div>
                      <h3 style={{margin:0, color:'#075985'}}>{p.title}</h3>
                      <p className="small" style={{marginTop:6}}>{p.summary}</p>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10}}>
                      <div className="small">Reglamentos: {p.regulations ? p.regulations.length : 0}</div>
                      <button className="button" onClick={()=>openProcess(p)}>Ver requisitos</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step==='process' && selectedProcess && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
                <div>
                  <button onClick={()=>setStep('list')} style={{background:'transparent', border:'none', color:'#0369a1', textDecoration:'underline'}}>← Volver</button>
                  <h2 style={{marginTop:8}}>{selectedProcess.title}</h2>
                  <div className="small">{selectedProcess.summary}</div>
                </div>
                <div>
                  <div className="small">Código</div>
                  <div style={{fontWeight:700, color:'#075985'}}>{selectedProcess.id.toUpperCase()}</div>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:16}}>
                <div>
                  {selectedProcess.requirements.map(r=>(
                    <div key={r.id} className="card" style={{marginBottom:10}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:700, color:'#075985'}}>{r.title}</div>
                          <div className="small">{r.description}</div>
                        </div>
                        <div>
                          <button onClick={()=>{ setSelectedRequirement(r); }} style={{background:'transparent', border:'none', color:'#0369a1', textDecoration:'underline'}}>Subir PDF</button>
                        </div>
                      </div>
                      <div style={{marginTop:8}}>
                        <div className="small">Archivos:</div>
                        <ul>
                          {r.uploads && r.uploads.length>0 ? r.uploads.map(f=>(
                            <li key={f.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <a href={f.url} target="_blank" rel="noreferrer">{f.originalName}</a>
                              <span className="small">{new Date(f.createdAt).toLocaleString()}</span>
                            </li>
                          )) : <li className="small">Sin archivos</li>}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>

                <aside>
                  <div className="card" style={{marginBottom:12}}>
                    <h4 style={{marginTop:0}}>Reglamentos</h4>
                    <ul>
                      {selectedProcess.regulations && selectedProcess.regulations.map((rg,i)=>(<li key={i} className="small">{rg}</li>))}
                    </ul>
                    {selectedProcess.help && <div style={{marginTop:8}} className="small"><strong>Ayuda:</strong> {selectedProcess.help}</div>}
                  </div>

                  <div className="card">
                    <h4 style={{marginTop:0}}>Mapa - Notarías cercanas</h4>
                    <div style={{height:220}}>
                      <MapContainer center={userPos || [-17.3925, -66.1560]} zoom={13} style={{height:'100%', borderRadius:8}}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {userPos && <Marker position={userPos}><Popup>Tú estás aquí</Popup></Marker>}
                        {sampleNotaries.map(n=>(
                          <Marker key={n.id} position={[n.lat,n.lon]}>
                            <Popup><strong>{n.name}</strong><br/>{n.address}</Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                    <div className="small" style={{marginTop:8}}>Usa el botón superior para ubicarte y ver notarías cercanas.</div>
                  </div>
                </aside>
              </div>

              {selectedRequirement && (
                <div className="card" style={{marginTop:12}}>
                  <h4>Subir archivo para: {selectedRequirement.title}</h4>
                  <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFileChange} style={{marginTop:8}} />
                  <div style={{marginTop:8}}>
                    <button className="button" onClick={upload}>Subir PDF</button>
                    <button onClick={()=>{ setSelectedRequirement(null); setSelectedFile(null); if(fileRef.current) fileRef.current.value=''; }} style={{marginLeft:8}}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside style={{width:320}}>
          <div className="card" style={{marginBottom:12}}>
            <h4 style={{marginTop:0}}>Notarías cercanas</h4>
            {notariesNearby.length===0 ? <div className="small">Presiona "Buscar notarias"</div> : (
              <ul>
                {notariesNearby.map(n=>(
                  <li key={n.id} style={{marginBottom:8}}>
                    <div style={{fontWeight:700, color:'#075985'}}>{n.name}</div>
                    <div className="small">{n.address}</div>
                    <div className="small">{n.dist.toFixed(2)} km</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h4 style={{marginTop:0}}>Atajos</h4>
            <button className="button" onClick={()=>{ setStep('list'); }}>Ver todos los trámites</button>
            <div style={{height:12}} />
            <button className="button" onClick={()=>{ localStorage.removeItem('userName'); setName(''); setStep('welcome'); }}>Cerrar sesión</button>
          </div>
        </aside>
      </main>
    </div>
  );
}
