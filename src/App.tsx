import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion'
import Lenis from 'lenis'
import * as THREE from 'three'

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface AudioEngineRef {
  ctx: AudioContext | null
  masterGain: GainNode | null
  engineOsc1: OscillatorNode | null
  engineOsc2: OscillatorNode | null
  noiseSource: AudioBufferSourceNode | null
  analyser: AnalyserNode | null
  isRunning: boolean
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RACING_RED = '#D5001C'

const GT3_MODELS = [
  { year: '2004', model: '996 GT3 RS', spec: '280 HP · 3.6L Flat-Six', desc: 'Where the legend was born.' },
  { year: '2007', model: '997 GT3 RS', spec: '415 HP · 3.6L Flat-Six', desc: 'The circuit becomes a stage.' },
  { year: '2010', model: '997.2 GT3 RS', spec: '450 HP · 3.8L Flat-Six', desc: 'Evolution in every corner.' },
  { year: '2016', model: '991 GT3 RS', spec: '500 HP · 4.0L Flat-Six', desc: 'Natural aspiration perfected.' },
  { year: '2019', model: '991.2 GT3 RS', spec: '520 HP · 4.0L Flat-Six', desc: 'Manthey heritage on the road.' },
  { year: '2023', model: '992 GT3 RS', spec: '518 HP · 4.0L Flat-Six', desc: 'The pinnacle. The obsession.' },
]

const PORSCHE_COLORS = [
  { name: 'Python Green', hex: '#4A5C3A', sub: '#3D4E2F', fact: 'Exclusive to the 991.2 GT3 RS. Only 200 units worldwide.' },
  { name: 'Shark Blue', hex: '#1B3A5C', sub: '#162E4A', fact: "A tribute to Porsche's racing heritage at Le Mans." },
  { name: 'Nardo Grey', hex: '#8C8C8C', sub: '#707070', fact: 'Born on the oval. Made for the streets. Timeless.' },
  { name: 'Guards Red', hex: '#D5001C', sub: '#A80016', fact: 'The original. The icon. Porsche red since 1963.' },
  { name: 'GT Silver', hex: '#B0B3B5', sub: '#9A9DA0', fact: 'Aluminum meets adrenaline. Pure and relentless.' },
  { name: 'Weissach', hex: '#F0F0F0', sub: '#1A1A1A', fact: 'White over black. The lightest, fastest GT3 RS ever.' },
]

const SPECS = [
  { value: 518, unit: 'HP', label: 'Power Output', decimals: 0 },
  { value: 465, unit: 'Nm', label: 'Peak Torque', decimals: 0 },
  { value: 1450, unit: 'kg', label: 'Kerb Weight', decimals: 0 },
  { value: 3.2, unit: 's', label: '0–100 km/h', decimals: 1 },
  { value: 296, unit: 'km/h', label: 'Top Speed', decimals: 0 },
  { value: 9000, unit: 'RPM', label: 'Redline', decimals: 0 },
]

// ─── AUDIO ENGINE ─────────────────────────────────────────────────────────────
function makeAudio(): AudioEngineRef {
  return { ctx: null, masterGain: null, engineOsc1: null, engineOsc2: null, noiseSource: null, analyser: null, isRunning: false }
}

function startAudio(ref: AudioEngineRef) {
  if (ref.isRunning) return
  try {
    ref.ctx = new AudioContext()
    ref.masterGain = ref.ctx.createGain()
    ref.masterGain.gain.setValueAtTime(0.1, ref.ctx.currentTime)
    ref.analyser = ref.ctx.createAnalyser()
    ref.analyser.fftSize = 2048

    ref.engineOsc1 = ref.ctx.createOscillator()
    ref.engineOsc1.type = 'sine'
    ref.engineOsc1.frequency.setValueAtTime(45, ref.ctx.currentTime)
    const g1 = ref.ctx.createGain(); g1.gain.setValueAtTime(0.5, ref.ctx.currentTime)
    ref.engineOsc1.connect(g1); g1.connect(ref.masterGain)

    ref.engineOsc2 = ref.ctx.createOscillator()
    ref.engineOsc2.type = 'sawtooth'
    ref.engineOsc2.frequency.setValueAtTime(90, ref.ctx.currentTime)
    const g2 = ref.ctx.createGain(); g2.gain.setValueAtTime(0.06, ref.ctx.currentTime)
    ref.engineOsc2.connect(g2); g2.connect(ref.masterGain)

    const bufLen = ref.ctx.sampleRate * 2
    const buf = ref.ctx.createBuffer(1, bufLen, ref.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1
    ref.noiseSource = ref.ctx.createBufferSource()
    ref.noiseSource.buffer = buf
    ref.noiseSource.loop = true
    const ng = ref.ctx.createGain(); ng.gain.setValueAtTime(0.006, ref.ctx.currentTime)
    const nf = ref.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.setValueAtTime(180, ref.ctx.currentTime)
    ref.noiseSource.connect(nf); nf.connect(ng); ng.connect(ref.masterGain)

    ref.masterGain.connect(ref.analyser)
    ref.analyser.connect(ref.ctx.destination)
    ref.engineOsc1.start(); ref.engineOsc2.start(); ref.noiseSource.start()
    ref.isRunning = true
  } catch { /* blocked */ }
}

function setRpm(ref: AudioEngineRef, rpm: number) {
  if (!ref.ctx || !ref.engineOsc1 || !ref.engineOsc2 || !ref.masterGain) return
  const t = ref.ctx.currentTime
  ref.engineOsc1.frequency.setTargetAtTime(30 + (rpm / 9000) * 130, t, 0.1)
  ref.engineOsc2.frequency.setTargetAtTime(60 + (rpm / 9000) * 260, t, 0.1)
  ref.masterGain.gain.setTargetAtTime(0.05 + (rpm / 9000) * 0.28, t, 0.1)
}

function stopAudio(ref: AudioEngineRef) {
  try { ref.engineOsc1?.stop(); ref.engineOsc2?.stop(); ref.noiseSource?.stop(); ref.ctx?.close() } catch { /**/ }
  ref.isRunning = false; ref.ctx = null
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useCounter(target: number, decimals: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = 0
    const dur = 1800
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(parseFloat((target * e).toFixed(decimals)))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, active, decimals])
  return val
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el); return () => obs.disconnect()
  }, [threshold])
  return [ref, visible] as const
}

// ─── GT3 SILHOUETTE ───────────────────────────────────────────────────────────
function GT3({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 820 320" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M75 235 L98 190 L158 140 L255 105 L355 95 L480 93 L570 103 L635 124 L695 165 L735 235 Z" fill="#111" stroke="white" strokeWidth="1.5" />
      <path d="M255 105 L295 76 L415 72 L478 93" fill="#0A0A0A" stroke="#555" strokeWidth="1" />
      <path d="M295 76 L415 72" stroke="white" strokeWidth="1.5" />
      <path d="M608 100 L568 83 L698 83 L698 100" fill={RACING_RED} stroke={RACING_RED} strokeWidth="1.5" />
      <line x1="608" y1="83" x2="608" y2="104" stroke={RACING_RED} strokeWidth="2.2" />
      <line x1="678" y1="83" x2="678" y2="104" stroke={RACING_RED} strokeWidth="2.2" />
      <path d="M75 235 L52 235 L62 248 L88 248" fill={RACING_RED} />
      <circle cx="205" cy="243" r="40" fill="#111" stroke="white" strokeWidth="2" />
      <circle cx="205" cy="243" r="23" fill="#0A0A0A" stroke="#555" strokeWidth="1.5" />
      <circle cx="205" cy="243" r="9" fill={RACING_RED} />
      <circle cx="615" cy="243" r="40" fill="#111" stroke="white" strokeWidth="2" />
      <circle cx="615" cy="243" r="23" fill="#0A0A0A" stroke="#555" strokeWidth="1.5" />
      <circle cx="615" cy="243" r="9" fill={RACING_RED} />
      <path d="M145 228 L695 228" stroke="#333" strokeWidth="0.5" strokeDasharray="8 4" />
      <line x1="325" y1="118" x2="485" y2="112" stroke="#333" strokeWidth="0.8" />
    </svg>
  )
}

// ─── TACHOMETER ───────────────────────────────────────────────────────────────
function Tacho({ rpm }: { rpm: number }) {
  const max = 9000
  const angle = -135 + (rpm / max) * 270
  const cx = 150, cy = 150, r = 118

  const arc = (a1: number, a2: number, ri: number, color: string, sw: number) => {
    const s = (a1 - 90) * Math.PI / 180, e = (a2 - 90) * Math.PI / 180
    const x1 = cx + ri * Math.cos(s), y1 = cy + ri * Math.sin(s)
    const x2 = cx + ri * Math.cos(e), y2 = cy + ri * Math.sin(e)
    const lg = a2 - a1 > 180 ? 1 : 0
    return <path key={`${a1}-${a2}`} d={`M${x1},${y1} A${ri},${ri},0,${lg},1,${x2},${y2}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
  }

  const ticks = Array.from({ length: 10 }, (_, i) => {
    const deg = -135 + i * 30
    const rad = (deg - 90) * Math.PI / 180
    return <line key={i} x1={cx + (r - 14) * Math.cos(rad)} y1={cy + (r - 14) * Math.sin(rad)} x2={cx + (r - 1) * Math.cos(rad)} y2={cy + (r - 1) * Math.sin(rad)} stroke={i >= 8 ? RACING_RED : '#444'} strokeWidth={i % 2 === 0 ? 2.5 : 1.5} strokeLinecap="round" />
  })

  return (
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      {arc(-135, 135, r, '#1A1A1A', 10)}
      {arc(-135, -135 + (8000 / max) * 270, r, '#2A2A2A', 7)}
      {arc(-135 + (8000 / max) * 270, 135, r, RACING_RED, 7)}
      {rpm > 0 && arc(-135, -135 + (rpm / max) * 270, r, 'white', 3)}
      {ticks}
      {[1, 3, 5, 7, 9].map((v) => {
        const deg = -135 + (v / 10) * 270
        const rad = (deg - 90) * Math.PI / 180
        const d = r - 30
        return (
          <text key={v} x={cx + d * Math.cos(rad)} y={cy + d * Math.sin(rad)} textAnchor="middle" dominantBaseline="middle"
            fill={v >= 8 ? RACING_RED : '#666'} fontSize="13" fontFamily="DM Mono,monospace" fontWeight="500">
            {v >= 9 ? '9k' : `${v}k`}
          </text>
        )
      })}
      <g transform={`rotate(${angle},${cx},${cy})`}>
        <line x1={cx} y1={cy + 18} x2={cx} y2={cy - r + 18} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="9" fill={RACING_RED} />
        <circle cx={cx} cy={cy} r="3.5" fill="white" />
      </g>
      <text x={cx} y={cy + 44} textAnchor="middle" fill="white" fontSize="26" fontFamily="Oswald,sans-serif" fontWeight="700" letterSpacing="2">{rpm.toLocaleString()}</text>
      <text x={cx} y={cy + 63} textAnchor="middle" fill="#555" fontSize="10" fontFamily="DM Mono,monospace" letterSpacing="4">RPM</text>
    </svg>
  )
}

// ─── PORSCHE SHIELD ───────────────────────────────────────────────────────────
function Shield() {
  return (
    <svg width="56" height="64" viewBox="0 0 56 64" fill="none">
      <path d="M28 3L53 15V34C53 47 41 59 28 61C15 59 3 47 3 34V15L28 3Z" fill="none" stroke={RACING_RED} strokeWidth="1.5" />
      <path d="M28 3L53 15V34C53 47 41 59 28 61C15 59 3 47 3 34V15L28 3Z" fill="url(#sg)" opacity="0.1" />
      <line x1="28" y1="3" x2="28" y2="61" stroke={RACING_RED} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
      <line x1="3" y1="33" x2="53" y2="33" stroke={RACING_RED} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
      <text x="28" y="22" textAnchor="middle" fill={RACING_RED} fontSize="7" fontFamily="Oswald" fontWeight="700" letterSpacing="1.5">PORSCHE</text>
      <text x="28" y="50" textAnchor="middle" fill="white" fontSize="5.5" fontFamily="DM Mono" letterSpacing="2.5">GT3 RS</text>
      <defs>
        <linearGradient id="sg" x1="28" y1="3" x2="28" y2="61">
          <stop offset="0%" stopColor={RACING_RED} /><stop offset="100%" stopColor="#000" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── GALLERY IMAGE ────────────────────────────────────────────────────────────
function GalleryImg({ gradient, location, label, className = '', ratio = '16/9', src }: {
  gradient: string; location: string; label: string; className?: string; ratio?: string; src?: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden group cursor-pointer ${className}`}
      style={{ aspectRatio: ratio }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {src ? (
        <img src={src} alt={label} loading="lazy" decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${hov ? 'scale-105' : 'scale-100'}`} />
      ) : (
        <div className={`absolute inset-0 transition-transform duration-700 ${hov ? 'scale-105' : 'scale-100'}`}
          style={{ background: `linear-gradient(135deg, ${gradient})` }} />
      )}
      {!src && (
        <div className="absolute inset-0 flex items-end justify-center pb-8 opacity-25">
          <GT3 className="w-3/4" />
        </div>
      )}
      <div className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${hov ? 'opacity-100' : 'opacity-0'}`} />
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
        <div className="border-l-2 border-racing pl-3">
          <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.25em] uppercase">{location}</p>
          <p className="font-condensed text-white text-lg tracking-wide mt-0.5">{label}</p>
        </div>
      </div>
      <div className={`absolute top-0 right-0 w-0 h-0 border-t-[28px] border-r-[28px] border-t-racing border-r-transparent transition-opacity duration-300 ${hov ? 'opacity-100' : 'opacity-0'}`} />
    </motion.div>
  )
}

// ─── SPEC CARD ────────────────────────────────────────────────────────────────
function SpecCard({ spec, i, active }: { spec: typeof SPECS[0]; i: number; active: boolean }) {
  const count = useCounter(spec.value, spec.decimals, active)
  const [hov, setHov] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
      className="bg-[#060606] p-6 md:p-8 relative overflow-hidden group cursor-pointer"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        transform: hov ? 'perspective(700px) rotateX(-2deg) rotateY(1.5deg) scale(1.015)' : 'perspective(700px) rotateX(0) rotateY(0) scale(1)',
        transition: 'transform 0.35s ease'
      }}
    >
      <div className="absolute top-0 left-0 h-[2px] w-0 bg-racing group-hover:w-full transition-all duration-500" />
      <div className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(38px, 5.5vw, 76px)', textShadow: '0 0 40px rgba(213,0,28,0.3)' }}>
        {count.toLocaleString()}
        <span className="text-racing ml-1 font-light" style={{ fontSize: '45%' }}>{spec.unit}</span>
      </div>
      <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.35em] uppercase mt-3">{spec.label}</p>
      <div className="absolute bottom-0 left-0 w-10 h-[1px] bg-racing" />
    </motion.div>
  )
}

// ─── COLOR FLIP CARD ──────────────────────────────────────────────────────────
function ColorCard({ color, i }: { color: typeof PORSCHE_COLORS[0]; i: number }) {
  const [flip, setFlip] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: i * 0.07 }}
      className="cursor-pointer"
      style={{ aspectRatio: '3/4', perspective: '1000px' }}
      onMouseEnter={() => setFlip(true)}
      onMouseLeave={() => setFlip(false)}
      onClick={() => setFlip(f => !f)}
    >
      <div className="flip-card-inner w-full h-full" style={{ transform: flip ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d', transition: 'transform 0.7s cubic-bezier(0.23,1,0.32,1)', position: 'relative', width: '100%', height: '100%' }}>
        <div className="flip-card-front absolute inset-0" style={{ background: `linear-gradient(135deg, ${color.hex} 0%, ${color.sub} 100%)`, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)' }} />
          <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
            <p className="font-condensed text-white/90 text-xl font-medium tracking-wide">{color.name}</p>
            <div className="mt-2 h-px w-8" style={{ background: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
        <div className="flip-card-back absolute inset-0 bg-[#0A0A0A] border border-[#1A1A1A] flex flex-col justify-between p-4 md:p-5"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <div className="w-5 h-5 rounded-full border-2 border-racing" style={{ background: color.hex }} />
          <div>
            <p className="font-condensed text-white text-xl md:text-2xl font-bold tracking-wide mb-3">{color.name}</p>
            <p className="font-sans text-[#8C8C8C] text-xs md:text-sm leading-relaxed">{color.fact}</p>
          </div>
          <div className="h-px bg-[#1A1A1A]" />
        </div>
      </div>
    </motion.div>
  )
}

// ─── 3D SCENE ─────────────────────────────────────────────────────────────────
const CAR_COLORS_3D = [
  { name: 'Polar White',  hex: '#F0F0F0' },
  { name: 'Guards Red',   hex: '#D5001C' },
  { name: 'Python Green', hex: '#4A5C3A' },
  { name: 'Shark Blue',   hex: '#1B3A5C' },
]

function GT3DScene() {
  const mountRef   = useRef<HTMLDivElement>(null)
  const threeState = useRef<{ targetColor: THREE.Color; bodyMat: THREE.MeshStandardMaterial } | null>(null)
  const [activeColor, setActiveColor] = useState(0)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    // ── Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    scene.fog = new THREE.FogExp2(0x000000, 0.04)

    // ── Camera
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.set(0, 2.0, 8.0)
    camera.lookAt(0, 0.7, 0)

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type   = THREE.PCFSoftShadowMap
    renderer.toneMapping      = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)

    // ── Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.28))

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0)
    keyLight.position.set(6, 9, 4)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width  = 2048
    keyLight.shadow.mapSize.height = 2048
    keyLight.shadow.camera.near   = 0.5
    keyLight.shadow.camera.far    = 25
    keyLight.shadow.camera.left   = -6
    keyLight.shadow.camera.right  = 6
    keyLight.shadow.camera.top    = 6
    keyLight.shadow.camera.bottom = -6
    scene.add(keyLight)

    const redLight = new THREE.PointLight(0xd5001c, 3.0, 14)
    redLight.position.set(-5.5, 1.8, 0)
    scene.add(redLight)

    const fillLight = new THREE.PointLight(0x2244aa, 0.5, 12)
    fillLight.position.set(4, 0.5, -4)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.6)
    rimLight.position.set(-3, 3, -6)
    scene.add(rimLight)

    // ── Ground
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.82, metalness: 0.3 })
    )
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    const grid = new THREE.GridHelper(24, 24, 0x1a1a1a, 0x0d0d0d)
    grid.position.y = 0.003
    scene.add(grid)

    // ── Materials
    const targetColor = new THREE.Color(CAR_COLORS_3D[0].hex)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CAR_COLORS_3D[0].hex),
      metalness: 0.62, roughness: 0.22,
    })
    const glassMat  = new THREE.MeshStandardMaterial({ color: 0x0c1820, metalness: 0.05, roughness: 0.0, transparent: true, opacity: 0.70 })
    const tireMat   = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.93, metalness: 0.04 })
    const rimMat    = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.95, roughness: 0.08 })
    const brakeMat  = new THREE.MeshStandardMaterial({ color: 0xd4a800, metalness: 0.50, roughness: 0.22 })
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd5001c, metalness: 0.52, roughness: 0.28 })
    const darkMat   = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85, metalness: 0.1 })

    threeState.current = { targetColor, bodyMat }

    // ── Car group
    const carGroup = new THREE.Group()

    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.rotation.set(rx, ry, rz)
      m.castShadow = true; m.receiveShadow = true
      carGroup.add(m); return m
    }

    // ── Body panels
    box(4.05, 0.44, 1.88, bodyMat,  0,     0.22,  0)           // lower body slab
    box(1.50, 0.30, 1.82, bodyMat, -1.28,  0.57,  0, 0, 0, -0.07)  // front hood
    box(0.20, 0.42, 1.82, bodyMat, -2.10,  0.30,  0)           // front fascia
    box(1.38, 0.66, 1.68, bodyMat,  0.30,  0.92,  0)           // cabin box
    box(0.88, 0.20, 1.84, bodyMat,  1.66,  0.54,  0)           // rear deck
    box(0.20, 0.44, 1.82, bodyMat,  2.10,  0.28,  0)           // rear fascia

    // ── Glass & roof
    box(0.07, 0.58, 1.65, glassMat, -0.38, 0.95, 0, 0, 0,  0.34)  // windshield
    box(0.07, 0.40, 1.65, glassMat,  0.91, 1.01, 0, 0, 0, -0.38)  // rear glass
    box(1.30, 0.06, 1.66, glassMat,  0.27, 1.26, 0)               // roof panel

    // ── Aero
    box(0.68, 0.04, 2.10, accentMat, -2.42, 0.04, 0)           // front splitter
    box(0.55, 0.30, 1.82, accentMat,  2.14, 0.18, 0, 0, 0, 0.42) // rear diffuser
    box(0.16, 0.07, 2.30, accentMat,  1.90, 1.58, 0)           // wing main plane
    box(0.06, 0.10, 2.30, accentMat,  2.02, 1.64, 0)           // wing gurney
    box(0.04, 0.54, 0.04, accentMat,  1.93, 1.28,  0.74)       // wing support L
    box(0.04, 0.54, 0.04, accentMat,  1.93, 1.28, -0.74)       // wing support R

    // ── Side skirts & mirrors
    box(2.85, 0.08, 0.04, darkMat,  0, 0.19,  0.94)
    box(2.85, 0.08, 0.04, darkMat,  0, 0.19, -0.94)
    box(0.16, 0.08, 0.05, bodyMat, -0.58, 1.10,  0.96)
    box(0.16, 0.08, 0.05, bodyMat, -0.58, 1.10, -0.96)

    // ── Wheels (front smaller, rear wider)
    const wheelDefs: [number, number, number, number, number][] = [
      [-1.50, 0.31,  0.98, 0.31, 0.22],
      [-1.50, 0.31, -0.98, 0.31, 0.22],
      [ 1.44, 0.32,  1.02, 0.33, 0.26],
      [ 1.44, 0.32, -1.02, 0.33, 0.26],
    ]
    wheelDefs.forEach(([wx, wy, wz, r, w]) => {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), tireMat)
      tire.rotation.z = Math.PI / 2; tire.position.set(wx, wy, wz)
      tire.castShadow = true; carGroup.add(tire)

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.68, w + 0.02, 10), rimMat)
      rim.rotation.z = Math.PI / 2; rim.position.set(wx, wy, wz); carGroup.add(rim)

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.57, r * 0.57, 0.055, 12), brakeMat)
      disc.rotation.z = Math.PI / 2
      disc.position.set(wx, wy, wz > 0 ? wz - w * 0.3 : wz + w * 0.3)
      carGroup.add(disc)
    })

    carGroup.position.y = 0.01
    scene.add(carGroup)

    // ── Particles
    const pCount = 300
    const pPos = new Float32Array(pCount * 3)
    for (let i = 0; i < pCount; i++) {
      const r = 3.2 + Math.random() * 2.0
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      pPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.55 + 0.15
      pPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    const pMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.32 })
    const particles = new THREE.Points(pGeo, pMat)
    scene.add(particles)

    // ── Interaction (drag + auto-rotate)
    let isDragging = false, prevX = 0, prevY = 0
    let targetRotY = 0, currentRotY = 0
    let targetRotX = 0, currentRotX = 0

    const onDown  = (e: MouseEvent) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; setHint(false) }
    const onMove  = (e: MouseEvent) => {
      if (!isDragging) return
      targetRotY += (e.clientX - prevX) * 0.012
      targetRotX += (e.clientY - prevY) * 0.006
      targetRotX  = Math.max(-0.35, Math.min(0.35, targetRotX))
      prevX = e.clientX; prevY = e.clientY
    }
    const onUp    = () => { isDragging = false }
    const onTStart = (e: TouchEvent) => { isDragging = true; prevX = e.touches[0].clientX; setHint(false) }
    const onTMove  = (e: TouchEvent) => {
      if (!isDragging) return
      targetRotY += (e.touches[0].clientX - prevX) * 0.014
      prevX = e.touches[0].clientX
    }
    const onTEnd   = () => { isDragging = false }

    renderer.domElement.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    renderer.domElement.addEventListener('touchstart', onTStart, { passive: true })
    renderer.domElement.addEventListener('touchmove', onTMove,  { passive: true })
    renderer.domElement.addEventListener('touchend',  onTEnd)

    // ── Animation loop
    const clock = new THREE.Clock()
    let rafId = 0
    let isVisible = false

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      if (!isVisible) return
      const t = clock.getElapsedTime()

      if (!isDragging) targetRotY += 0.0035
      currentRotY += (targetRotY - currentRotY) * 0.055
      currentRotX += (targetRotX - currentRotX) * 0.055
      carGroup.rotation.y = currentRotY
      carGroup.rotation.x = currentRotX

      bodyMat.color.lerp(targetColor, 0.055)

      particles.rotation.y = t * 0.025
      redLight.intensity = 2.8 + Math.sin(t * 1.6) * 0.4

      renderer.render(scene, camera)
    }
    animate()

    // Pause rendering when off-screen
    const visObs = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting }, { threshold: 0.05 })
    visObs.observe(el)

    // ── Resize
    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      visObs.disconnect()
      renderer.domElement.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      renderer.domElement.removeEventListener('touchstart', onTStart)
      renderer.domElement.removeEventListener('touchmove', onTMove)
      renderer.domElement.removeEventListener('touchend', onTEnd)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  const handleColor = (idx: number) => {
    setActiveColor(idx)
    if (threeState.current) threeState.current.targetColor.setStyle(CAR_COLORS_3D[idx].hex)
  }

  return (
    <section className="bg-black py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6 md:px-16">
        {/* Header */}
        <div className="mb-10">
          <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-3">Chapter 03.5</p>
          <div className="overflow-hidden">
            <motion.h2
              initial={{ y: 90 }} whileInView={{ y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-condensed font-bold text-white leading-none tracking-tighter"
              style={{ fontSize: 'clamp(50px, 10vw, 130px)' }}
            >
              EXPLORE <span style={{ color: RACING_RED }}>IN 3D</span>
            </motion.h2>
          </div>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            className="font-sans text-[#8C8C8C] text-sm mt-3 max-w-md"
          >
            Drag to orbit · Scroll to explore · Change color below
          </motion.p>
        </div>

        {/* Canvas container */}
        <div className="relative">
          <div
            ref={mountRef}
            className="w-full border border-[#111] overflow-hidden"
            style={{ height: '70vh', cursor: 'grab' }}
            data-lenis-prevent
          />

          {/* Drag hint */}
          <AnimatePresence>
            {hint && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    animate={{ x: [-10, 10, -10] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    className="w-6 h-6 border border-[#8C8C8C] rounded-full opacity-60"
                  />
                  <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.35em] uppercase opacity-60">
                    DRAG TO ROTATE
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Corner labels */}
          <div className="absolute top-3 left-4 font-mono-custom text-[8px] text-[#333] tracking-[0.3em] uppercase pointer-events-none">
            GT3 RS · 4.0 FLAT-SIX
          </div>
          <div className="absolute top-3 right-4 font-mono-custom text-[8px] text-[#333] tracking-[0.3em] uppercase pointer-events-none">
            THREE.JS · LOW POLY
          </div>
        </div>

        {/* Color picker */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="font-mono-custom text-[9px] text-[#555] tracking-[0.35em] uppercase">Color ·</span>
          {CAR_COLORS_3D.map((c, i) => (
            <button
              key={c.name}
              onClick={() => handleColor(i)}
              className="flex items-center gap-2.5 px-4 py-2 border transition-all duration-300"
              style={{
                borderColor: activeColor === i ? RACING_RED : '#222',
                background: activeColor === i ? 'rgba(213,0,28,0.08)' : 'transparent',
              }}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                style={{ background: c.hex }} />
              <span className="font-mono-custom text-[9px] tracking-[0.2em] uppercase"
                style={{ color: activeColor === i ? '#fff' : '#555' }}>
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [loadPct, setLoadPct] = useState(0)
  const [loadRpm, setLoadRpm] = useState(0)
  const [flash, setFlash] = useState(false)
  const [muted, setMuted] = useState(() => localStorage.getItem('gt3_muted') !== 'false')

  const audioRef = useRef<AudioEngineRef>(makeAudio())
  const progressRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const waveRaf = useRef(0)

  // Hero pinning
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: hp } = useScroll({ target: heroRef, offset: ['start start', 'end end'] })
  const s1op = useTransform(hp, [0, 0.18, 0.25], [1, 1, 0])
  const s2op = useTransform(hp, [0.22, 0.32, 0.47, 0.52], [0, 1, 1, 0])
  const s2sc = useTransform(hp, [0.22, 0.45], [0.5, 1])
  const s3op = useTransform(hp, [0.48, 0.58, 0.72, 0.77], [0, 1, 1, 0])
  const s3x  = useTransform(hp, [0.48, 0.68], ['0%', '-22%'])
  const s4op = useTransform(hp, [0.73, 0.83, 1], [0, 1, 1])

  // Heritage horizontal
  const heritageRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: hep } = useScroll({ target: heritageRef, offset: ['start end', 'end start'] })
  const heX = useTransform(hep, [0.08, 0.92], ['0%', '-64%'])
  const heXs = useSpring(heX, { stiffness: 75, damping: 18 })

  // Engine section
  const engineRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: engP } = useScroll({ target: engineRef, offset: ['start end', 'end start'] })
  const engRaw = useTransform(engP, [0.18, 0.82], [0, 9000])
  const [engRpm, setEngRpm] = useState(0)
  const [engShake, setEngShake] = useState(false)

  // Specs inview
  const [specsRef, specsVis] = useInView(0.25)

  // Aero
  const aeroRef = useRef<HTMLDivElement>(null)
  const [aeroPos, setAeroPos] = useState({ x: 50, y: 50 })
  const [aeroTags, setAeroTags] = useState<string[]>([])

  // Hero background image opacity
  const heroBgOpacity = useTransform(hp, [0.18, 0.45, 0.7, 0.78], [0, 0.45, 0.45, 0])

  // ── Loading sequence
  useEffect(() => {
    let p = 0
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 3.5 + 1.2, 100)
      setLoadPct(p)
      setLoadRpm(Math.round((p / 100) * 9000))
      if (p >= 100) {
        clearInterval(iv)
        setTimeout(() => { setFlash(true); setTimeout(() => setLoaded(true), 380) }, 280)
      }
    }, 38)
    return () => clearInterval(iv)
  }, [])

  // ── Lenis smooth scroll
  useEffect(() => {
    if (!loaded) return
    const lenis = new Lenis({ lerp: 0.075, smoothWheel: true })
    const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    lenis.on('scroll', ({ progress }: { progress: number }) => {
      if (progressRef.current) progressRef.current.style.width = `${progress * 100}%`
    })
    return () => lenis.destroy()
  }, [loaded])

  // ── Custom cursor
  useEffect(() => {
    if (window.innerWidth < 768) return
    const move = (e: MouseEvent) => {
      if (!cursorRef.current) return
      cursorRef.current.style.left = `${e.clientX}px`
      cursorRef.current.style.top = `${e.clientY}px`
    }
    document.addEventListener('mousemove', move)
    return () => document.removeEventListener('mousemove', move)
  }, [])

  // ── Engine scroll → RPM + audio
  useEffect(() => {
    return engRaw.on('change', (v) => {
      const r = Math.round(v)
      setEngRpm(r)
      setEngShake(r > 7200)
      if (!muted && audioRef.current.isRunning) setRpm(audioRef.current, r)
    })
  }, [engRaw, muted])

  // ── Waveform canvas
  useEffect(() => {
    const canvas = waveRef.current; if (!canvas) return
    const c = canvas.getContext('2d'); if (!c) return
    let waveVisible = false
    const waveVisObs = new IntersectionObserver(([e]) => { waveVisible = e.isIntersecting }, { threshold: 0.05 })
    waveVisObs.observe(canvas)
    const draw = () => {
      waveRaf.current = requestAnimationFrame(draw)
      if (!waveVisible) return
      const w = canvas.width, h = canvas.height
      c.clearRect(0, 0, w, h)
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h)
      const audio = audioRef.current
      if (audio.analyser && audio.isRunning) {
        const buf = new Uint8Array(audio.analyser.frequencyBinCount)
        audio.analyser.getByteTimeDomainData(buf)
        c.beginPath(); c.strokeStyle = RACING_RED; c.lineWidth = 2
        const sw = w / buf.length
        buf.forEach((v, i) => {
          const y = (v / 128) * h / 2
          i === 0 ? c.moveTo(0, y) : c.lineTo(i * sw, y)
        })
        c.stroke()
      } else {
        c.beginPath(); c.strokeStyle = '#222'; c.lineWidth = 1.5
        const mid = h / 2; c.moveTo(0, mid)
        for (let x = 0; x < w; x += 3) c.lineTo(x, mid + (Math.random() * 2 - 1) * 1.2)
        c.stroke()
      }
    }
    draw()
    return () => { cancelAnimationFrame(waveRaf.current); waveVisObs.disconnect() }
  }, [])

  const toggleMute = useCallback(() => {
    const next = !muted
    setMuted(next)
    localStorage.setItem('gt3_muted', String(!next))
    if (!next) startAudio(audioRef.current)
    else stopAudio(audioRef.current)
  }, [muted])

  const handleAero = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    setAeroPos({ x, y })
    const tags: string[] = []
    if (x > 62 && y < 46) tags.push('Swan Neck Wing')
    if (x > 58 && y > 58) tags.push('Rear Diffuser')
    if (x < 22 && y > 52) tags.push('Front Splitter')
    if (x > 32 && x < 54 && y > 62) tags.push('Side Blades')
    setAeroTags(tags)
  }, [])

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden z-50"
        style={{ background: flash ? '#fff' : '#000', transition: 'background 0.35s ease' }}>
        <div style={{ opacity: flash ? 0 : 1, transition: 'opacity 0.35s', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.p initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="font-condensed text-[10px] tracking-[0.5em] text-[#8C8C8C] uppercase mb-8">
            Porsche AG — GT3 RS
          </motion.p>
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="w-44 md:w-60">
            <Tacho rpm={loadRpm} />
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.35em] uppercase mt-7">
            Initializing · {Math.round(loadPct)}%
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-5 w-44 md:w-60 h-px bg-[#1A1A1A]">
            <div className="h-full transition-all duration-75" style={{ width: `${loadPct}%`, background: 'linear-gradient(90deg, #D5001C, #ff3352, #D5001C)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite' }} />
          </motion.div>
          {loadPct > 88 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-condensed text-racing text-xs tracking-[0.4em] uppercase mt-4">
              REDLINE
            </motion.p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Scroll progress bar */}
      <div id="scroll-progress" ref={progressRef} />

      {/* Custom cursor */}
      <div id="custom-cursor" ref={cursorRef} />

      {/* Mute button */}
      <button onClick={toggleMute}
        className="fixed bottom-5 right-5 z-[9998] flex items-center gap-2 px-3 py-2 border border-[#2A2A2A] bg-black/80 backdrop-blur font-mono-custom text-[9px] tracking-[0.25em] text-[#8C8C8C] uppercase hover:border-racing hover:text-white transition-all duration-300"
        aria-label="Toggle engine sound">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: muted ? '#333' : RACING_RED, boxShadow: muted ? 'none' : `0 0 6px ${RACING_RED}` }} />
        {muted ? 'UNMUTE' : 'MUTE'}
      </button>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ height: '500vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden bg-black flex items-center justify-center">

          {/* Hero background image — fades in at stage 2 */}
          <motion.div style={{ opacity: heroBgOpacity }}
            className="absolute inset-0 pointer-events-none">
            <img src="/images/hero.jpg" alt="" aria-hidden="true" loading="eager"
              className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-black/55" />
          </motion.div>

          {/* Stage 1 — GT3 RS title */}
          <motion.div style={{ opacity: s1op }} className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div className="overflow-hidden">
              <motion.h1 initial={{ y: 130 }} animate={{ y: 0 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                className="font-condensed font-bold text-white leading-none tracking-tighter text-center"
                style={{ fontSize: 'clamp(72px, 17vw, 240px)' }}>
                GT3<span className="text-racing"> RS</span>
              </motion.h1>
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
              className="flex flex-wrap justify-center gap-4 md:gap-8 mt-6">
              {['4.0L Flat-Six', '518 HP', '0–100 in 3.2s'].map((s, i) => (
                <motion.span key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + i * 0.12 }}
                  className="font-mono-custom text-[10px] md:text-xs text-[#8C8C8C] tracking-[0.3em] uppercase">{s}
                </motion.span>
              ))}
            </motion.div>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 h-px bg-racing" style={{ width: 'clamp(80px, 18vw, 280px)', transformOrigin: 'left' }} />
          </motion.div>

          {/* Stage 2 — Giant 911 + silhouette */}
          <motion.div style={{ opacity: s2op }} className="absolute inset-0 flex items-center justify-center">
            <motion.span style={{ scale: s2sc, fontSize: 'clamp(100px, 38vw, 560px)', opacity: 0.055, color: 'white', letterSpacing: '-0.04em' }}
              className="absolute font-condensed font-bold select-none leading-none">
              911
            </motion.span>
            <motion.div style={{ scale: s2sc }} className="relative w-full max-w-4xl px-8">
              <GT3 className="w-full drop-shadow-2xl" />
            </motion.div>
          </motion.div>

          {/* Stage 3 — Specs */}
          <motion.div style={{ opacity: s3op }} className="absolute inset-0 flex items-center justify-center px-6 md:px-16">
            <div className="w-full max-w-6xl flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <motion.div style={{ x: s3x }} className="flex-1 min-w-0">
                <GT3 className="w-full" />
              </motion.div>
              <div className="flex-shrink-0 space-y-5">
                {[['ENGINE', '4.0L Flat-Six'], ['POWER', '518 HP / 383 kW'], ['TORQUE', '465 Nm @ 6,750 rpm'], ['WEIGHT', '1,450 kg'], ['0–100', '3.2 seconds'], ['VMAX', '296 km/h']].map(([k, v]) => (
                  <div key={k} className="group">
                    <div className="font-mono-custom text-[8px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-1">{k}</div>
                    <div className="font-condensed text-white text-xl md:text-2xl tracking-widest">{v}</div>
                    <div className="mt-1.5 h-px bg-[#1A1A1A] group-hover:bg-racing transition-colors duration-500" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Stage 4 — Scroll invite */}
          <motion.div style={{ opacity: s4op }} className="absolute inset-0 flex items-center justify-center">
            <motion.p animate={{ opacity: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 2.6 }}
              className="font-mono-custom text-[10px] tracking-[0.55em] text-[#8C8C8C] uppercase">
              SCROLL TO EXPLORE ↓
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────── */}
      <section className="py-4 bg-black border-y border-[#151515] overflow-hidden">
        <div className="flex">
          <div className="marquee-track">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="font-condensed text-sm md:text-base tracking-[0.3em] text-racing shrink-0 mr-6">
                WEISSACH PACKAGE · 518 HP · NATURALLY ASPIRATED · 9,000 RPM · REAR ENGINE · PDK · CARBON FIBER · NÜRBURGRING TESTED ·&nbsp;
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HERITAGE ─────────────────────────────────────────────────────── */}
      <section ref={heritageRef} className="bg-black" style={{ height: '400vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
          <div className="px-6 md:px-16 mb-8 flex items-end justify-between">
            <div>
              <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-2">Chapter 01</p>
              <h2 className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(38px, 7.5vw, 96px)' }}>HERITAGE</h2>
            </div>
            <span className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.2em] uppercase hidden md:block">2004 — 2023</span>
          </div>

          <div className="overflow-hidden px-6 md:px-16">
            <motion.div style={{ x: heXs, display: 'flex', gap: '2.5rem' }}>
              {GT3_MODELS.map((m, i) => (
                <div key={m.year} className="flex-shrink-0 w-[78vw] md:w-[38vw]">
                  <div className="relative overflow-hidden" style={{ aspectRatio: '16/10', background: '#0A0A0A' }}>
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, #${(i + 1).toString(16).padStart(2, '0')}0A0A 0%, #1A1A1A 55%, #0A0A0A 100%)` }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <GT3 className="w-4/5 opacity-55" />
                    </div>
                    <span className="absolute bottom-2 left-4 font-condensed font-bold text-white/8 leading-none select-none"
                      style={{ fontSize: 'clamp(55px, 9vw, 110px)', opacity: 0.07 }}>{m.year}</span>
                    <div className="absolute top-0 left-0 w-1 h-full bg-racing opacity-50" />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="font-mono-custom text-[9px] text-racing tracking-[0.35em]">{m.year}</span>
                      <span className="font-condensed text-white text-xl tracking-wider">{m.model}</span>
                    </div>
                    <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.2em] mb-2">{m.spec}</p>
                    <p className="font-sans text-sm text-[#444] italic">{m.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── THE ENGINE ───────────────────────────────────────────────────── */}
      <section ref={engineRef} className="bg-black" style={{ height: '280vh' }}>
        <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">
          {/* Engine photo background */}
          <div className="absolute inset-0 pointer-events-none">
            <img src="/images/engine.jpg" alt="" aria-hidden="true" loading="lazy"
              className="w-full h-full object-cover object-center opacity-20" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #000 0%, transparent 30%, transparent 70%, #000 100%)' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-px" style={{ background: RACING_RED, opacity: 0.04, boxShadow: '0 0 80px 30px #D5001C' }} />
          </div>

          <div className={`text-center px-4 relative z-10 ${engShake ? 'screen-shake' : ''}`}>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.5em] uppercase mb-5">Chapter 02</motion.p>

            <div className="overflow-hidden mb-1">
              <motion.h2 initial={{ y: 90 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                className="font-condensed font-bold text-white leading-none tracking-tighter"
                style={{ fontSize: 'clamp(44px, 9vw, 118px)' }}>THE HEART</motion.h2>
            </div>
            <div className="overflow-hidden mb-1">
              <motion.h3 initial={{ y: 80 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                className="font-condensed font-light leading-none tracking-tighter"
                style={{ fontSize: 'clamp(32px, 7vw, 90px)', color: RACING_RED }}>4.0 LITRE FLAT-SIX</motion.h3>
            </div>
            <div className="overflow-hidden mb-1">
              <motion.p initial={{ y: 60 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.18 }}
                className="font-condensed text-white font-light tracking-[0.12em]"
                style={{ fontSize: 'clamp(18px, 3.5vw, 44px)' }}>NATURALLY ASPIRATED</motion.p>
            </div>
            <div className="overflow-hidden">
              <motion.p initial={{ y: 60 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.26 }}
                className="font-condensed font-bold tracking-[0.08em]"
                style={{ fontSize: 'clamp(16px, 3vw, 40px)', color: RACING_RED }}>9,000 RPM REDLINE</motion.p>
            </div>

            <div className="mt-10 md:mt-14 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14">
              <div className="w-36 md:w-52">
                <Tacho rpm={engRpm} />
              </div>
              <div className="space-y-2">
                <canvas ref={waveRef} width={380} height={76} className="w-64 md:w-96 border border-[#1A1A1A]" />
                <p className="font-mono-custom text-[8px] text-[#444] tracking-[0.3em] uppercase text-center">WAVEFORM · LIVE</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SPECS GRID ───────────────────────────────────────────────────── */}
      <section className="py-24 md:py-40 relative overflow-hidden">
        {/* Image background */}
        <img src="/images/porsche-numbers-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" style={{ zIndex: 1 }} />
        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 md:px-16 relative" style={{ zIndex: 2 }}>
          <div className="mb-14">
            <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-3">Chapter 03</p>
            <h2 className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(38px, 7vw, 88px)' }}>BY THE NUMBERS</h2>
          </div>
          <div ref={specsRef} className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#111]/60">
            {SPECS.map((s, i) => <SpecCard key={s.label} spec={s} i={i} active={specsVis} />)}
          </div>
        </div>
      </section>

      {/* ── 3D MODEL ─────────────────────────────────────────────────────── */}
      <GT3DScene />

      {/* ── GALLERY ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="mb-14">
            <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-3">Chapter 04</p>
            <h2 className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(38px, 7vw, 88px)' }}>THE GALLERY</h2>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <GalleryImg src="/images/track.jpg" gradient="#1a0505, #2a0808 40%, #0a0000" location="Nürburgring, 2024" label="Full Attack" className="md:col-span-2" ratio="16/9" />
              <GalleryImg src="/images/wheel.jpg" gradient="#0a0a18, #080820 40%, #000012" location="Spa-Francorchamps, 2024" label="Eau Rouge" ratio="3/4" />
            </div>

            <div className="py-12 md:py-20 text-center px-4">
              <motion.blockquote initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="font-condensed italic font-light text-white/75 max-w-4xl mx-auto"
                style={{ fontSize: 'clamp(20px, 3.8vw, 52px)', lineHeight: 1.2 }}>
                "It doesn't just go fast.<br />
                <span style={{ color: RACING_RED }}>It communicates.</span>"
              </motion.blockquote>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <GalleryImg src="/images/interior.jpg" gradient="#0f0f0f, #1a1a0a 40%, #0a0a00" location="Porsche Experience, Hockenheim" label="Driver Training" />
              <GalleryImg src="/images/aerial.jpg" gradient="#0a0018, #140020 40%, #0a000e" location="Monaco, Night Run" label="Urban Predator" />
              <GalleryImg src="/images/garage.jpg" gradient="#0a1400, #0a1c00 40%, #001000" location="Weissach, 2023" label="Born Here" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
              <GalleryImg src="/images/track.jpg" gradient="#1a0a00, #201000 40%, #100800" location="Laguna Seca, USA" label="Corkscrew" className="md:col-span-3" />
              <GalleryImg src="/images/hero.jpg" gradient="#000a1a, #000e22 40%, #000812" location="Kyalami, South Africa" label="Africa Run" className="md:col-span-2" />
            </div>
          </div>
        </div>
      </section>

      {/* ── AERO ─────────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-40 bg-[#030303]">
        <div className="max-w-6xl mx-auto px-6 md:px-16">
          <div className="mb-12">
            <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-3">Chapter 05</p>
            <h2 className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(38px, 7vw, 88px)' }}>AERODYNAMICS</h2>
            <p className="font-sans text-[#8C8C8C] text-sm mt-3 max-w-md">Move your cursor to reveal aero components.</p>
          </div>

          <div ref={aeroRef} className="relative cursor-crosshair" style={{ aspectRatio: '16/7' }}
            onMouseMove={handleAero} onMouseLeave={() => setAeroTags([])}>
            {/* Dim base — aero photo dark */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <img src="/images/aero.jpg" alt="GT3 RS rear aero" loading="lazy"
                className="w-full h-full object-cover object-center opacity-15" />
            </div>
            {/* Revealed via CSS mask — bright photo */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ WebkitMaskImage: `radial-gradient(circle 120px at ${aeroPos.x}% ${aeroPos.y}%, black 55%, transparent 100%)`, maskImage: `radial-gradient(circle 120px at ${aeroPos.x}% ${aeroPos.y}%, black 55%, transparent 100%)` }}>
              <img src="/images/aero.jpg" alt="" aria-hidden="true" loading="lazy"
                className="w-full h-full object-cover object-center" />
            </div>
            {/* Aero SVG labels layer */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0">
              <GT3 className="w-full" />
            </div>

            {/* Labels */}
            <AnimatePresence>
              {[
                { tag: 'Swan Neck Wing', lx: '63%', ly: '12%' },
                { tag: 'Rear Diffuser', lx: '71%', ly: '70%' },
                { tag: 'Front Splitter', lx: '5%', ly: '70%' },
                { tag: 'Side Blades', lx: '42%', ly: '80%' },
              ].filter(({ tag }) => aeroTags.includes(tag)).map(({ tag, lx, ly }) => (
                <motion.div key={tag} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                  className="absolute pointer-events-none" style={{ left: lx, top: ly }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-racing flex-shrink-0" />
                    <span className="font-mono-custom text-[8px] text-racing tracking-[0.2em] uppercase bg-black/85 px-1.5 py-0.5 whitespace-nowrap">{tag}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <p className="absolute bottom-1 right-0 font-mono-custom text-[8px] text-[#333] tracking-[0.2em] uppercase">Hover to reveal</p>
          </div>

          {/* Aero stats */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['409', 'kg', 'Downforce at 200 km/h'], ['4', 'pts', 'Aero attachment points'], ['−10°', '', 'Wing incidence range'], ['DRS', '', 'Drag Reduction System']].map(([v, u, l]) => (
              <div key={l} className="border border-[#1A1A1A] p-4">
                <div className="font-condensed font-bold text-white leading-none mb-1" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
                  {v}<span className="text-racing text-base ml-1">{u}</span>
                </div>
                <p className="font-mono-custom text-[8px] text-[#8C8C8C] tracking-[0.18em] uppercase">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COLORS ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-40 bg-black">
        <div className="max-w-6xl mx-auto px-6 md:px-16">
          <div className="mb-14">
            <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-3">Chapter 06</p>
            <h2 className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(38px, 7vw, 88px)' }}>CHOOSE YOUR WEAPON</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {PORSCHE_COLORS.map((c, i) => <ColorCard key={c.name} color={c} i={i} />)}
          </div>
        </div>
      </section>

      {/* ── SOUND ────────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-40 bg-[#040404]">
        <div className="max-w-4xl mx-auto px-6 md:px-16 text-center">
          <p className="font-mono-custom text-[9px] text-[#8C8C8C] tracking-[0.45em] uppercase mb-5">Chapter 07</p>
          <motion.h2 initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            className="font-condensed font-bold text-white leading-none mb-4"
            style={{ fontSize: 'clamp(38px, 8vw, 96px)' }}>THE SOUND</motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="font-sans text-[#8C8C8C] text-sm md:text-base max-w-md mx-auto mb-10">
            The naturally aspirated flat-six is an instrument. Press play and feel it.
          </motion.p>

          <motion.button initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            onClick={toggleMute} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-8 py-4 border border-racing text-racing font-condensed font-medium tracking-[0.2em] uppercase text-sm hover:bg-racing hover:text-white transition-colors duration-300">
            <span className="w-2.5 h-2.5 rounded-full border border-current flex-shrink-0">
              {!muted && <span className="block w-full h-full rounded-full bg-current" style={{ animation: 'pulse 1s ease infinite' }} />}
            </span>
            {muted ? 'UNMUTE THE EXPERIENCE' : 'ENGINE IS LIVE'}
          </motion.button>

          <div className="mt-10 relative">
            <canvas ref={waveRef} width={760} height={110} className="w-full border border-[#151515]" />
            <span className="absolute top-2 left-3 font-mono-custom text-[7px] text-[#333] tracking-[0.3em] uppercase">WAVEFORM · LIVE</span>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="relative py-32 md:py-52 bg-black overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-condensed font-bold text-white leading-none" style={{ fontSize: 'clamp(140px, 38vw, 580px)', opacity: 0.025 }}>911</span>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-16 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            className="flex justify-center mb-10">
            <Shield />
          </motion.div>

          <div className="overflow-hidden mb-3">
            <motion.h2 initial={{ y: 105 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
              className="font-condensed font-bold text-white leading-none tracking-tighter"
              style={{ fontSize: 'clamp(46px, 11vw, 150px)' }}>BUILT TO BE</motion.h2>
          </div>
          <div className="overflow-hidden mb-8">
            <motion.h2 initial={{ y: 105 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
              className="font-condensed font-bold leading-none tracking-tighter"
              style={{ fontSize: 'clamp(46px, 11vw, 150px)', color: RACING_RED }}>DRIVEN.</motion.h2>
          </div>
          <motion.p initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            className="font-condensed italic text-[#8C8C8C] font-light text-2xl md:text-3xl mb-12">
            Not just admired.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }}>
            <a href="https://configurator.porsche.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-4 px-10 py-5 bg-racing text-white font-condensed font-medium tracking-[0.2em] uppercase text-sm hover:bg-white hover:text-black transition-colors duration-300">
              Configure Yours
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M0 6H14M9 1L14 6L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#0A0A0A] border-t border-[#151515] py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-6 md:px-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p className="font-condensed text-white text-sm tracking-[0.3em] uppercase mb-1">GT3 RS — Born to Race</p>
              <p className="font-mono-custom text-[9px] text-[#555] tracking-[0.2em]">A tribute to engineering.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              {[['Porsche.com', 'https://porsche.com'], ['Instagram', '#'], ['Credits', '#']].map(([l, h]) => (
                <a key={l} href={h} target="_blank" rel="noopener noreferrer"
                  className="font-mono-custom text-[9px] text-[#555] tracking-[0.25em] uppercase hover:text-white transition-colors duration-300 relative group">
                  {l}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-racing group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-[#151515] flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="font-mono-custom text-[8px] text-[#333] tracking-[0.2em]">
              © 2024 — Built by <a href="#" className="text-[#555] hover:text-racing transition-colors">Anderson Lara — Nuvro Engineer</a>
            </p>
            <p className="font-mono-custom text-[8px] text-[#2A2A2A] tracking-[0.15em]">Fan tribute · Not affiliated with Porsche AG</p>
          </div>
        </div>
      </footer>
    </>
  )
}
