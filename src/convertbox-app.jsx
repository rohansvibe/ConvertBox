import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const API = "http://localhost:5000";

const OUTPUT_GROUPS = [
  {
    group: "Image", icon: "🖼", color: "#f97316", formats: [
      { label: "JPG", ext: "jpg", mime: "image/jpeg", clientOk: true },
      { label: "PNG", ext: "png", mime: "image/png", clientOk: true },
      { label: "WEBP", ext: "webp", mime: "image/webp", clientOk: true },
      { label: "BMP", ext: "bmp", mime: "image/bmp", clientOk: true },
      { label: "GIF", ext: "gif", mime: "image/gif" },
      { label: "TIFF", ext: "tiff", mime: "image/tiff" },
      { label: "ICO", ext: "ico", mime: "image/x-icon" },
    ],
  },
  {
    group: "Audio", icon: "🎵", color: "#a78bfa", formats: [
      { label: "MP3", ext: "mp3" }, { label: "WAV", ext: "wav" },
      { label: "OGG", ext: "ogg" }, { label: "FLAC", ext: "flac" },
      { label: "AAC", ext: "aac" }, { label: "OPUS", ext: "opus" },
      { label: "M4A", ext: "m4a" }, { label: "WMA", ext: "wma" },
    ],
  },
  {
    group: "Video", icon: "🎬", color: "#38bdf8", formats: [
      { label: "MP4", ext: "mp4" }, { label: "WEBM", ext: "webm" },
      { label: "AVI", ext: "avi" }, { label: "MKV", ext: "mkv" },
      { label: "MOV", ext: "mov" }, { label: "FLV", ext: "flv" },
      { label: "WMV", ext: "wmv" }, { label: "3GP", ext: "3gp" },
    ],
  },
];

const ALL_FORMATS = OUTPUT_GROUPS.flatMap(g => g.formats);
const CLIENT_IMG = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif"]);

function canClient(file, fmt) {
  if (!fmt.clientOk) return false;
  return CLIENT_IMG.has(file.name.split(".").pop().toLowerCase());
}
function baseName(n) { const p = n.split("."); if (p.length > 1) p.pop(); return p.join("."); }
function fmtSize(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
function getFileColor(name) {
  const e = name.split(".").pop().toLowerCase();
  const img = ["png","jpg","jpeg","webp","bmp","gif","tiff","ico","avif","svg","raw","psd"];
  const aud = ["mp3","wav","ogg","flac","aac","opus","m4a","wma"];
  const vid = ["mp4","webm","avi","mkv","mov","flv","wmv","3gp","m4v"];
  if (img.includes(e)) return "#f97316";
  if (aud.includes(e)) return "#a78bfa";
  if (vid.includes(e)) return "#38bdf8";
  return "#6b7280";
}

async function clientConvert(file, fmt, q) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (["image/jpeg","image/bmp"].includes(fmt.mime)) { ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); }
      ctx.drawImage(img,0,0);
      c.toBlob(b => { URL.revokeObjectURL(u); b ? res(b) : rej(new Error("Failed")); }, fmt.mime, q/100);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Cannot load")); };
    img.src = u;
  });
}
async function serverConvert(file, ext, q) {
  const fd = new FormData(); fd.append("file",file); fd.append("format",ext); fd.append("quality",q+"");
  const r = await fetch(`${API}/api/convert`, { method:"POST", body:fd });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error||`Error ${r.status}`); }
  return await r.blob();
}

function Spinner({ s=18 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{animation:"spin .7s linear infinite"}}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity=".12"/>
    <path d="M12 2a10 10 0 018.66 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>;
}

// Animated background orbs
function BgOrbs() {
  return <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
    <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(249,115,22,.06) 0%,transparent 70%)",top:"-15%",right:"-10%",animation:"orbFloat 20s ease-in-out infinite"}}/>
    <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(167,139,250,.05) 0%,transparent 70%)",bottom:"-10%",left:"-8%",animation:"orbFloat2 25s ease-in-out infinite"}}/>
    <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(56,189,248,.04) 0%,transparent 70%)",top:"40%",left:"60%",animation:"orbFloat3 18s ease-in-out infinite"}}/>
  </div>;
}

// File type icon with animated ring
function FileIcon({ name, size=42 }) {
  const color = getFileColor(name);
  const ext = name.split(".").pop().toUpperCase().slice(0,4);
  return <div style={{width:size,height:size,position:"relative",flexShrink:0}}>
    <svg width={size} height={size} viewBox="0 0 42 42" style={{position:"absolute",inset:0}}>
      <circle cx="21" cy="21" r="19" fill="none" stroke={color} strokeWidth="1.5" opacity=".15"/>
      <circle cx="21" cy="21" r="19" fill="none" stroke={color} strokeWidth="1.5"
        strokeDasharray="120" strokeDashoffset="30" strokeLinecap="round" opacity=".5"
        style={{animation:"ringPulse 3s ease-in-out infinite"}}/>
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{fontSize:ext.length>3?8:9,fontWeight:800,color,fontFamily:"'JetBrains Mono'",letterSpacing:".04em"}}>{ext}</span>
    </div>
  </div>;
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [fmt, setFmt] = useState(null);
  const [q, setQ] = useState(85);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({i:0,n:0});
  const [results, setResults] = useState([]);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState(null);
  const [srv, setSrv] = useState(false);
  const [checked, setChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [previews, setPreviews] = useState({});
  const ref = useRef();

  useEffect(() => {
    fetch(`${API}/api/health`,{signal:AbortSignal.timeout(3000)})
      .then(r=>r.ok&&setSrv(true)).catch(()=>{}).finally(()=>setChecked(true));
  }, []);

  // Generate image previews
  useEffect(() => {
    files.forEach((f, i) => {
      if (previews[i] || !f.type.startsWith("image/")) return;
      const u = URL.createObjectURL(f);
      setPreviews(p => ({...p, [i]: u}));
    });
  }, [files]);

  const showQ = fmt && ["jpg","webp"].includes(fmt.ext);

  const addFiles = useCallback(list => {
    const a = Array.from(list);
    if (!a.length) return;
    setErr(null); setResults([]);
    setFiles(prev => [...prev,...a]);
    setFmt(null);
  }, []);

  const drop = useCallback(e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }, [addFiles]);
  const remove = i => {
    if (previews[i]) URL.revokeObjectURL(previews[i]);
    const np = {...previews}; delete np[i];
    const nf = files.filter((_,j)=>j!==i);
    // Reindex previews
    const rp = {};
    nf.forEach((f,ni) => { const oi = files.indexOf(f); if(np[oi]) rp[ni]=np[oi]; });
    setPreviews(rp);
    if (!nf.length) reset(); else setFiles(nf);
  };

  const convert = async () => {
    if (!fmt||!files.length) return;
    setBusy(true); setErr(null); setProg({i:0,n:files.length});
    const out = [];
    for (let i=0;i<files.length;i++) {
      setProg({i,n:files.length});
      const f=files[i];
      try {
        let blob;
        if (srv) blob = await serverConvert(f,fmt.ext,q);
        else if (canClient(f,fmt)) blob = await clientConvert(f,fmt,q);
        else throw new Error("Needs server. Run: python app.py");
        out.push({name:baseName(f.name)+"."+fmt.ext,blob,origSize:f.size});
      } catch(e) { out.push({name:f.name,error:e.message,origSize:f.size}); }
    }
    setProg({i:files.length,n:files.length}); setResults(out); setBusy(false);
  };

  const dl = r => { const u=URL.createObjectURL(r.blob); const a=document.createElement("a"); a.href=u; a.download=r.name; a.click(); URL.revokeObjectURL(u); };
  const dlAll = () => results.filter(r=>r.blob).forEach(dl);
  const reset = () => {
    Object.values(previews).forEach(u=>URL.revokeObjectURL(u));
    setFiles([]); setFmt(null); setResults([]); setErr(null);
    setBusy(false); setSearch(""); setPreviews({}); setActiveGroup(null);
  };

  const ok=results.filter(r=>r.blob).length;
  const fail=results.filter(r=>r.error).length;

  const filtered = useMemo(() => OUTPUT_GROUPS.map(g => ({
    ...g,
    formats: g.formats.filter(f =>
      !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.ext.includes(search.toLowerCase())
    ),
  })).filter(g => g.formats.length > 0), [search]);

  const progressPct = busy ? Math.round((prog.i / Math.max(prog.n,1)) * 100) : 0;

  // Browser-mode awareness
  const hasNonImageFiles = files.some(f => !CLIENT_IMG.has(f.name.split(".").pop().toLowerCase()));
  const allFilesClientCompatible = fmt ? files.every(f => canClient(f, fmt)) : false;
  const browserModeWarning = !srv && files.length > 0 && hasNonImageFiles;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
        @keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-30px,20px) scale(1.1)}}
        @keyframes orbFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-25px) scale(1.05)}}
        @keyframes orbFloat3{0%,100%{transform:translate(0,0)}50%{transform:translate(-15px,15px)}}
        @keyframes ringPulse{0%,100%{stroke-dashoffset:30;opacity:.5}50%{stroke-dashoffset:80;opacity:.8}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(249,115,22,.15)}50%{box-shadow:0 0 40px rgba(249,115,22,.25)}}
        @keyframes progressStripe{0%{background-position:0 0}100%{background-position:40px 0}}
        @keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes dropPulse{0%,100%{border-color:rgba(249,115,22,.3)}50%{border-color:rgba(249,115,22,.7)}}

        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:3px}

        input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:linear-gradient(90deg,#f97316 0%,#f97316 var(--q-pct,85%),#1a1a1a var(--q-pct,85%),#1a1a1a 100%);outline:none;transition:background .1s}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#f97316;cursor:pointer;border:3px solid #0a0a0a;box-shadow:0 0 10px rgba(249,115,22,.4);transition:box-shadow .2s}
        input[type=range]::-webkit-slider-thumb:hover{box-shadow:0 0 16px rgba(249,115,22,.6)}
        input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#f97316;cursor:pointer;border:3px solid #0a0a0a}

        .glass{background:rgba(255,255,255,.02);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.04)}

        .file-card{transition:all .2s}
        .file-card:hover{background:rgba(255,255,255,.04)!important;transform:translateX(2px)}
        .file-card:hover .rm-btn{opacity:1!important}

        .fmt-chip{transition:all .18s}
        .fmt-chip:hover:not(:disabled){background:rgba(255,255,255,.06)!important;border-color:#444!important;color:#e5e5e5!important;transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.3)}

        .dl-btn{transition:all .18s}
        .dl-btn:hover{background:rgba(249,115,22,.12)!important;box-shadow:0 0 16px rgba(249,115,22,.2)}

        .main-btn{transition:all .22s}
        .main-btn:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(249,115,22,.35);filter:brightness(1.08)}
        .main-btn:not(:disabled):active{transform:translateY(0);box-shadow:0 2px 10px rgba(249,115,22,.2)}

        .group-tab{transition:all .15s;cursor:pointer}
        .group-tab:hover{background:rgba(255,255,255,.04)!important}

        .search-box:focus{outline:none;border-color:#444!important;box-shadow:0 0 0 3px rgba(249,115,22,.08)}
        .search-box::placeholder{color:#555}

        .drop-zone{transition:all .3s cubic-bezier(.4,0,.2,1)}
      `}</style>

      <BgOrbs />

      <div style={S.wrap}>
        {/* ─── Header ─── */}
        <header style={{...S.hdr, animation:"fadeUp .5s ease"}}>
          <div style={S.hdrRow}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={S.logoWrap}>
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  <defs>
                    <linearGradient id="lg1" x1="0" y1="0" x2="34" y2="34">
                      <stop offset="0%" stopColor="#f97316"/>
                      <stop offset="100%" stopColor="#fb923c"/>
                    </linearGradient>
                  </defs>
                  <rect x="2" y="2" width="13" height="13" rx="4" fill="url(#lg1)"/>
                  <rect x="19" y="2" width="13" height="13" rx="4" fill="#f97316" opacity=".5"/>
                  <rect x="2" y="19" width="13" height="13" rx="4" fill="#f97316" opacity=".5"/>
                  <rect x="19" y="19" width="13" height="13" rx="4" fill="#f97316" opacity=".18"/>
                </svg>
              </div>
              <div>
                <h1 style={S.logoText}>ConvertBox</h1>
                <p style={S.logoSub}>Universal file converter</p>
              </div>
            </div>
            <div className="glass" style={S.statusPill}>
              {!checked ? <Spinner s={10}/> : <>
                <span style={{width:7,height:7,borderRadius:"50%",background:srv?"#22c55e":"#404040",
                  boxShadow:srv?"0 0 8px rgba(34,197,94,.5)":"none"}}/>
                <span style={{fontSize:11,fontWeight:500,color:srv?"#4ade80":"#999",letterSpacing:".02em"}}>
                  {srv?"Server connected":"Browser mode"}
                </span>
              </>}
            </div>
          </div>
        </header>

        {/* ─── Drop Zone ─── */}
        {results.length===0 && (
          <div
            className="drop-zone"
            style={{
              ...S.dz,
              ...(drag ? S.dzDrag : {}),
              ...(files.length>0 ? S.dzMini : {}),
            }}
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onDrop={drop}
            onClick={()=>ref.current?.click()}
          >
            <input ref={ref} type="file" multiple style={{display:"none"}}
              onChange={e=>{addFiles(e.target.files);e.target.value=""}}/>

            {files.length===0 ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,animation:"fadeUp .6s ease .1s both"}}>
                <div style={S.dzIconWrap}>
                  <svg width="32" height="32" viewBox="0 0 44 44" fill="none"
                    stroke={drag?"#f97316":"#444"} strokeWidth="1.8" style={{transition:"stroke .3s"}}>
                    <path d="M22 30V14m0 0l-6 6m6-6l6 6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 28v4a3 3 0 003 3h22a3 3 0 003-3v-4" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{textAlign:"center"}}>
                  <p style={{fontSize:16,fontWeight:600,color:drag?"#f97316":"#999",transition:"color .3s"}}>
                    {drag ? "Release to add files" : "Drop any files here"}
                  </p>
                  <p style={{fontSize:13,color:"#777",marginTop:4}}>or click to browse · no restrictions on file types</p>
                </div>
                <div style={S.dzFormats}>
                  {["JPG","PNG","MP4","MP3","WEBP","MKV","FLAC","GIF"].map((f,i) => (
                    <span key={f} style={{...S.dzTag,animationDelay:`${.6+i*.06}s`}}>{f}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{fontSize:13,fontWeight:500,color:"#999"}}>
                + Drop or click to add more files
              </p>
            )}
          </div>
        )}

        {err && <div style={{...S.toast,animation:"scaleIn .25s ease"}}><span style={{fontSize:14}}>&#9888;&#65039;</span> {err}</div>}

        {/* ─── File List + Conversion ─── */}
        {files.length>0 && results.length===0 && (
          <div>
            {/* Files */}
            <div style={{...S.secRow,animation:"fadeUp .35s ease"}}>
              <span style={S.secLabel}>
                <span style={S.fileCount}>{files.length}</span>
                file{files.length!==1?"s":""}
              </span>
              <button style={S.link} onClick={reset}>Clear all</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {files.map((f,i) => (
                <div key={`${f.name}-${i}`} className="file-card glass"
                  style={{...S.fCard,animation:`slideIn .3s ease ${i*.04}s both`}}>
                  {/* Image preview or file icon */}
                  {previews[i] ? (
                    <div style={{...S.thumb,backgroundImage:`url(${previews[i]})`}} />
                  ) : (
                    <FileIcon name={f.name}/>
                  )}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={S.fName}>{f.name}</p>
                    <p style={S.fMeta}>
                      <span>{fmtSize(f.size)}</span>
                      <span style={{...S.fTypePill,color:getFileColor(f.name),borderColor:getFileColor(f.name)+"33"}}>
                        {f.name.split(".").pop().toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <button className="rm-btn" style={S.rmBtn} onClick={e=>{e.stopPropagation();remove(i)}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
                  </button>
                </div>
              ))}
            </div>

            {/* ─── Browser Mode Warning ─── */}
            {browserModeWarning && (
              <div style={S.warnBanner}>
                <div style={S.warnIcon}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="8" stroke="#f59e0b" strokeWidth="1.5"/>
                    <path d="M9 5.5v4M9 12v.5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p style={S.warnTitle}>Browser mode has limited format support</p>
                  <p style={S.warnText}>
                    Non-image files (like PDFs, audio, video) need the server to convert.
                    In browser mode, only image → image works (JPG, PNG, WEBP, BMP).
                  </p>
                  <p style={S.warnHint}>
                    Run <code style={S.warnCode}>python app.py</code> or <code style={S.warnCode}>docker compose up</code> locally for full conversion.
                  </p>
                </div>
              </div>
            )}

            {/* ─── Format Picker ─── */}
            <div style={{...S.secRow,marginTop:28,animation:"fadeUp .4s ease .1s both"}}>
              <span style={S.secLabel}>Convert to</span>
              <span style={{fontSize:11,color:"#666"}}>{ALL_FORMATS.length} formats</span>
            </div>

            {/* Search */}
            <div style={{position:"relative",marginBottom:14,animation:"fadeUp .4s ease .15s both"}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.3"
                style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>
                <circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5L13 13" strokeLinecap="round"/>
              </svg>
              <input className="search-box" type="text" placeholder="Search formats..."
                value={search} onChange={e=>setSearch(e.target.value)}
                style={S.searchInput}/>
            </div>

            {/* Group tabs */}
            <div style={{display:"flex",gap:6,marginBottom:16,animation:"fadeUp .4s ease .2s both"}}>
              <button className="group-tab"
                style={{...S.gTab,...(!activeGroup?S.gTabActive:{})}}
                onClick={()=>setActiveGroup(null)}>All</button>
              {OUTPUT_GROUPS.map(g => (
                <button key={g.group} className="group-tab"
                  style={{...S.gTab,...(activeGroup===g.group?{...S.gTabActive,borderColor:g.color+"44",color:g.color}:{})}}
                  onClick={()=>setActiveGroup(activeGroup===g.group?null:g.group)}>
                  <span style={{fontSize:12}}>{g.icon}</span> {g.group}
                </button>
              ))}
            </div>

            {/* Format chips */}
            {filtered.filter(g=>!activeGroup||g.group===activeGroup).map(g => (
              <div key={g.group} style={{marginBottom:16,animation:"fadeUp .35s ease .25s both"}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                  <span style={{fontSize:13}}>{g.icon}</span>
                  <span style={{...S.groupName,color:g.color}}>{g.group}</span>
                  <div style={{flex:1,height:1,background:`linear-gradient(90deg,${g.color}15,transparent)`}}/>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {g.formats.map(f => {
                    const active = fmt?.ext===f.ext;
                    const same = files.length===1 && files[0].name.split(".").pop().toLowerCase()===f.ext;
                    const needsSrv = !srv && !files.every(file=>canClient(file,f));
                    return (
                      <button key={f.ext} className="fmt-chip"
                        disabled={needsSrv}
                        style={{
                          ...S.chip,
                          ...(active ? {...S.chipActive,borderColor:g.color,color:g.color,
                            boxShadow:`0 0 16px ${g.color}22`,background:`${g.color}10`} : {}),
                          ...(same ? {opacity:.15,cursor:"not-allowed"} : {}),
                          ...(needsSrv ? {opacity:.25,cursor:"not-allowed",borderStyle:"dashed"} : {}),
                        }}
                        title={needsSrv ? "Requires server (python app.py)" : same ? "Same as input format" : ""}
                        onClick={()=>!needsSrv && !same && setFmt(f)}>
                        {f.label}
                        {needsSrv && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{marginLeft:3,opacity:.6}}>
                            <rect x="3.5" y="6" width="5" height="4" rx=".8" stroke="currentColor" strokeWidth="1.1"/>
                            <path d="M4.5 6V4.5a1.5 1.5 0 013 0V6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quality slider */}
            {showQ && (
              <div style={{marginTop:12,padding:"14px 16px",borderRadius:12,animation:"fadeUp .3s ease"}}
                className="glass">
                <div style={S.secRow}>
                  <span style={{...S.secLabel,margin:0}}>Quality</span>
                  <span style={S.qVal}>{q}%</span>
                </div>
                <input type="range" min="10" max="100" value={q}
                  onChange={e=>setQ(+e.target.value)}
                  style={{"--q-pct":`${q}%`}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#666",marginTop:5}}>
                  <span>Smaller file</span><span>Maximum quality</span>
                </div>
              </div>
            )}

            {/* Convert button */}
            <button className="main-btn"
              disabled={!fmt||busy}
              style={{...S.mainBtn,...(!fmt||busy?{opacity:.25,cursor:"not-allowed"}:{})}}
              onClick={convert}>
              {busy ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,width:"100%"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Spinner s={17}/> Converting {prog.i+1} of {prog.n}...
                  </div>
                  <div style={S.progressTrack}>
                    <div style={{...S.progressBar,width:`${progressPct}%`}}/>
                  </div>
                </div>
              ) : (
                <span style={{display:"flex",alignItems:"center",gap:8}}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 9h12M11 5l4 4-4 4"/>
                  </svg>
                  Convert{files.length>1?` ${files.length} files`:""} to {fmt?.label||"..."}
                </span>
              )}
            </button>

            <p style={S.modeNote}>
              {!fmt?"":srv?"Server mode · Pillow + FFmpeg":files.every(f=>canClient(f,fmt))
                ?"Browser mode · files never leave your device"
                :"Some files need the server · run python app.py"}
            </p>
          </div>
        )}

        {/* ─── Results ─── */}
        {results.length>0 && (
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={S.secRow}>
              <span style={{...S.secLabel,display:"flex",alignItems:"center",gap:8}}>
                <span style={{animation:"bounceIn .5s ease"}}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#22c55e"/>
                    <path d="M6 10.5L8.5 13L14 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                {ok} converted{fail>0?<span style={{color:"#ef4444"}}>, {fail} failed</span>:""}
              </span>
              <button style={S.link} onClick={reset}>Convert more</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {results.map((r,i) => (
                <div key={i} className="glass" style={{...S.rCard,animation:`slideIn .3s ease ${i*.05}s both`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={S.fName}>{r.name}</p>
                    <p style={S.fMeta}>
                      {r.blob && <>
                        <span>{fmtSize(r.blob.size)}</span>
                        <span style={{
                          ...S.sizeDelta,
                          color: r.blob.size <= r.origSize ? "#4ade80" : "#fbbf24",
                          background: r.blob.size <= r.origSize ? "rgba(74,222,128,.08)" : "rgba(251,191,36,.08)",
                        }}>
                          {r.blob.size<=r.origSize?"\u2193":"\u2191"}{Math.abs(Math.round((1-r.blob.size/r.origSize)*100))}%
                        </span>
                      </>}
                      {r.error && <span style={{color:"#f87171"}}>{r.error}</span>}
                    </p>
                  </div>
                  {r.blob && <button className="dl-btn" style={S.dlBtn} onClick={()=>dl(r)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M7 2v8m0 0L4 7m3 3l3-3M2 12h10"/>
                    </svg>
                    Download
                  </button>}
                </div>
              ))}
            </div>

            {ok>1 && (
              <button className="main-btn" style={S.mainBtn} onClick={dlAll}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M7 2v8m0 0L4 7m3 3l3-3M2 12h10"/>
                </svg>
                Download All ({ok} files)
              </button>
            )}
          </div>
        )}

        {/* ─── Footer ─── */}
        <footer style={{...S.footer,animation:"fadeIn .6s ease .4s both"}}>
          <div style={S.footerLine}/>
          <p>Your files never leave your machine · {ALL_FORMATS.length} output formats · zero tracking</p>
          {!srv && checked && (
            <p style={{marginTop:5}}>
              <code style={S.code}>python app.py</code> or <code style={S.code}>docker compose up</code> for full power
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

const S = {
  root: { fontFamily:"'Sora',sans-serif", background:"#060606", minHeight:"100vh", color:"#e5e5e5", padding:"24px 16px", position:"relative" },
  wrap: { maxWidth:580, margin:"0 auto", position:"relative", zIndex:1 },

  hdr: { marginBottom:28 },
  hdrRow: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  logoWrap: { padding:3 },
  logoText: { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-.04em", lineHeight:1.1 },
  logoSub: { fontSize:11.5, color:"#777", fontWeight:400, letterSpacing:".03em", marginTop:1 },
  statusPill: { display:"flex", alignItems:"center", gap:6, borderRadius:20, padding:"5px 12px" },

  dz: { borderRadius:16, padding:"48px 24px", cursor:"pointer", background:"rgba(255,255,255,.01)",
    border:"2px dashed #191919", position:"relative", overflow:"hidden" },
  dzDrag: { borderColor:"#f97316", background:"rgba(249,115,22,.03)", animation:"dropPulse 1s ease infinite" },
  dzMini: { padding:"14px 20px", marginBottom:6 },
  dzIconWrap: { width:60, height:60, borderRadius:16, background:"rgba(255,255,255,.02)",
    border:"1px solid rgba(255,255,255,.04)", display:"flex", alignItems:"center", justifyContent:"center" },
  dzFormats: { display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", marginTop:4 },
  dzTag: { fontSize:10, fontWeight:600, color:"#888", background:"rgba(255,255,255,.04)",
    border:"1px solid #252525", borderRadius:5, padding:"3px 8px",
    fontFamily:"'JetBrains Mono'", animation:"fadeUp .4s ease both" },

  toast: { background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.15)",
    borderRadius:10, padding:"9px 14px", fontSize:13, color:"#fca5a5",
    marginTop:10, display:"flex", alignItems:"center", gap:8 },

  secRow: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  secLabel: { fontSize:11, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:".08em" },
  fileCount: { display:"inline-flex", alignItems:"center", justifyContent:"center",
    width:20, height:20, borderRadius:6, background:"rgba(249,115,22,.1)", color:"#f97316",
    fontSize:11, fontWeight:700, marginRight:6, fontFamily:"'JetBrains Mono'" },
  link: { background:"none", border:"none", color:"#f97316", fontSize:12, cursor:"pointer",
    fontFamily:"'Sora'", fontWeight:600, padding:0, letterSpacing:".01em" },

  fCard: { display:"flex", alignItems:"center", gap:11, borderRadius:11, padding:"9px 12px" },
  thumb: { width:42, height:42, borderRadius:8, backgroundSize:"cover", backgroundPosition:"center", flexShrink:0,
    border:"1px solid rgba(255,255,255,.06)" },
  fName: { fontSize:13, fontWeight:500, color:"#e5e5e5", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  fMeta: { fontSize:11, color:"#777", marginTop:2, display:"flex", alignItems:"center", gap:8 },
  fTypePill: { fontSize:9, fontWeight:700, border:"1px solid", borderRadius:4, padding:"1px 5px",
    fontFamily:"'JetBrains Mono'", letterSpacing:".03em" },
  rmBtn: { background:"none", border:"none", color:"#666", cursor:"pointer", padding:4,
    opacity:0, transition:"opacity .15s" },

  searchInput: { width:"100%", padding:"10px 14px 10px 34px", borderRadius:10,
    border:"1px solid #161616", background:"rgba(255,255,255,.015)", color:"#ccc",
    fontSize:13, fontFamily:"'Sora'", transition:"all .2s" },

  gTab: { padding:"5px 12px", borderRadius:8, border:"1px solid #222", background:"transparent",
    color:"#888", fontSize:12, fontWeight:500, fontFamily:"'Sora'",
    display:"flex", alignItems:"center", gap:5 },
  gTabActive: { borderColor:"#f97316"+"33", color:"#f97316", background:"rgba(249,115,22,.04)" },

  groupName: { fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em" },

  chip: { padding:"6px 14px", borderRadius:8, border:"1px solid #2a2a2a", background:"rgba(255,255,255,.025)",
    color:"#999", fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono'",
    cursor:"pointer", letterSpacing:".02em" },
  chipActive: { fontWeight:700 },

  qVal: { fontSize:14, fontWeight:700, color:"#f97316", fontFamily:"'JetBrains Mono'" },

  mainBtn: { width:"100%", padding:"14px 24px", borderRadius:12, border:"none",
    background:"linear-gradient(135deg,#f97316,#ea580c)", color:"#fff", fontSize:14.5,
    fontWeight:700, fontFamily:"'Sora'", cursor:"pointer", marginTop:22,
    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
    boxShadow:"0 4px 20px rgba(249,115,22,.2)" },

  progressTrack: { width:"100%", height:4, borderRadius:2, background:"rgba(255,255,255,.1)", overflow:"hidden" },
  progressBar: { height:"100%", borderRadius:2, background:"rgba(255,255,255,.6)", transition:"width .3s ease",
    backgroundImage:"linear-gradient(90deg,rgba(255,255,255,.3) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.3) 75%,transparent 75%)",
    backgroundSize:"40px 4px", animation:"progressStripe .5s linear infinite" },

  modeNote: { textAlign:"center", fontSize:11, color:"#777", marginTop:10, letterSpacing:".02em" },

  rCard: { display:"flex", alignItems:"center", gap:12, borderRadius:11, padding:"12px 14px" },
  sizeDelta: { fontSize:10, fontWeight:700, fontFamily:"'JetBrains Mono'", borderRadius:4, padding:"1px 6px" },
  dlBtn: { padding:"6px 14px", borderRadius:8, border:"1px solid rgba(249,115,22,.3)", background:"transparent",
    color:"#f97316", fontSize:12, fontWeight:600, fontFamily:"'Sora'",
    cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", gap:6 },

  footer: { textAlign:"center", marginTop:36, fontSize:11.5, color:"#777", letterSpacing:".02em" },

  warnBanner: { display:"flex", gap:12, padding:"14px 16px", borderRadius:12,
    background:"rgba(245,158,11,.06)", border:"1px solid rgba(245,158,11,.15)",
    marginTop:20, animation:"fadeUp .35s ease" },
  warnIcon: { flexShrink:0, marginTop:1 },
  warnTitle: { fontSize:13, fontWeight:600, color:"#fbbf24", marginBottom:4 },
  warnText: { fontSize:12, color:"#b3a07a", lineHeight:1.5 },
  warnHint: { fontSize:11.5, color:"#8a7a5a", marginTop:6 },
  warnCode: { fontFamily:"'JetBrains Mono'", background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.15)",
    padding:"1px 6px", borderRadius:4, fontSize:10.5, color:"#fbbf24" },
  footerLine: { height:1, background:"linear-gradient(90deg,transparent,#2a2a2a,transparent)", marginBottom:16 },
  code: { fontFamily:"'JetBrains Mono'", background:"#151515", border:"1px solid #252525",
    padding:"2px 7px", borderRadius:5, fontSize:10.5, color:"#aaa" },
};
