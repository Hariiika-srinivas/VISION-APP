import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  Scan,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Send,
  Upload,
  Sparkles,
  Play,
  Square,
  Globe2,
  ChevronDown,
} from 'lucide-react';
import { Language, DetectedObstacle, VisionAnalysis, ChatMessage } from '../types';
import { CameraObstacleOverlay } from './CameraObstacleOverlay';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';
import {
  playAudioCue,
  playBase64Audio,
  stopSpeaking,
  speakWithBrowserTts,
  VoiceRecognitionController,
} from '../utils/audio';

interface UnifiedDashboardProps {
  currentLanguage: Language;
  onOpenLanguageSelector: () => void;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  onChangeVoiceName: (voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr') => void;
}

export const UnifiedVoiceVisionDashboard: React.FC<UnifiedDashboardProps> = ({
  currentLanguage,
  onOpenLanguageSelector,
  voiceName,
  onChangeVoiceName,
}) => {
  // Vision & Camera state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedObstacles, setDetectedObstacles] = useState<DetectedObstacle[]>([]);
  const [visionAnalysis, setVisionAnalysis] = useState<VisionAnalysis | null>(null);
  const [autoContinuousScan, setAutoContinuousScan] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Voice AI state
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceMessages, setVoiceMessages] = useState<ChatMessage[]>([]);
  const [latestSpokenAnnouncement, setLatestSpokenAnnouncement] = useState<string>(
    'Drishti Voice AI active. Point your camera to detect obstacles or tap the microphone to ask questions.'
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<VoiceRecognitionController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Demo environments for instant testing when physical camera is unavailable
  const DEMO_SCENARIOS = [
    {
      title: 'Hallway with Steps & Box',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="%230f172a"/><polygon points="120,480 240,180 400,180 520,480" fill="%231e293b"/><rect x="220" y="320" width="200" height="30" fill="%2394a3b8"/><rect x="250" y="350" width="140" height="30" fill="%2364748b"/><rect x="150" y="380" width="80" height="70" rx="8" fill="%23ef4444"/><text x="190" y="420" font-family="sans-serif" font-size="14" fill="%23ffffff" text-anchor="middle">BOX</text><rect x="420" y="280" width="90" height="150" rx="6" fill="%23f59e0b"/><text x="465" y="360" font-family="sans-serif" font-size="14" fill="%23ffffff" text-anchor="middle">CHAIR</text><text x="320" y="140" font-family="sans-serif" font-weight="bold" font-size="22" fill="%23f8fafc" text-anchor="middle">STAIRS &amp; CORRIDOR</text></svg>',
    },
    {
      title: 'Sidewalk with Traffic Cone',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="%231e293b"/><rect x="100" y="100" width="440" height="380" fill="%23334155"/><polygon points="320,180 270,360 370,360" fill="%23f97316"/><rect x="250" y="360" width="140" height="20" fill="%23ea580c"/><text x="320" y="330" font-family="sans-serif" font-weight="bold" font-size="14" fill="%23ffffff" text-anchor="middle">CONE</text><rect x="140" y="220" width="70" height="180" rx="6" fill="%23e11d48"/><text x="175" y="320" font-family="sans-serif" font-size="12" fill="%23ffffff" text-anchor="middle">BICYCLE</text></svg>',
    },
  ];

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Camera unavailable or permission not granted. Use a demo scene or upload a photo.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    recognitionRef.current = new VoiceRecognitionController();

    // Initial greeting
    const initialMsg: ChatMessage = {
      id: 'init',
      role: 'assistant',
      text: `Hello! I am Drishti Voice AI. Show me your camera view and I will detect obstacles with rectangle bounding boxes and guide your path out loud in ${currentLanguage.name}.`,
      spokenSummary: `Hello! Point your camera to detect obstacles or speak to me in ${currentLanguage.name}.`,
      timestamp: new Date(),
      suggestedReplies: [
        'Is the path clear?',
        'Describe all obstacles',
        'Read any signs',
        'Guide me forward',
      ],
    };
    setVoiceMessages([initialMsg]);

    return () => {
      stopCamera();
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, []);

  // Continuous auto-scan loop
  useEffect(() => {
    let timer: any;
    if (autoContinuousScan && !isScanning) {
      timer = setTimeout(() => {
        scanCameraObstacles();
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [autoContinuousScan, isScanning]);

  // Scan current frame for obstacles and draw bounding rectangle boxes
  const scanCameraObstacles = async (overrideImage?: string) => {
    let base64 = overrideImage || capturedImage;

    if (!base64 && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        base64 = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(base64);
      }
    }

    if (!base64) return;

    setIsScanning(true);
    playAudioCue('click');

    try {
      const response = await fetch('/api/vision-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          language: currentLanguage.code,
          task: 'obstacle_safety',
        }),
      });

      const json = await response.json();
      setIsScanning(false);

      if (json.success && json.data) {
        const data: VisionAnalysis = json.data;
        setVisionAnalysis(data);

        // Normalize obstacles and boxes
        const parsedObstacles: DetectedObstacle[] = (data.obstacles || []).map((obs: any, idx: number) => ({
          id: obs.id || `obs_${idx + 1}`,
          label: obs.label || 'Obstacle',
          isHazard: Boolean(obs.isHazard || obs.severity === 'high'),
          severity: obs.severity || 'medium',
          distance: obs.distance || '',
          location: obs.location || 'center',
          box2d: Array.isArray(obs.box2d) && obs.box2d.length === 4 ? obs.box2d : [300, 250, 700, 750],
        }));

        setDetectedObstacles(parsedObstacles);

        // Verbal announcement
        const announcement = data.audioAlert || data.navigationAdvice || data.summary;
        setLatestSpokenAnnouncement(announcement);

        // Audio cue
        if (data.urgentHazards && data.urgentHazards.length > 0) {
          playAudioCue('hazard');
        } else {
          playAudioCue('success');
        }

        // Add to voice messages
        const assistantMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          text: announcement,
          spokenSummary: announcement,
          timestamp: new Date(),
          hazardWarning: data.urgentHazards?.length ? data.urgentHazards.join(', ') : null,
          obstacles: parsedObstacles,
        };
        setVoiceMessages((prev) => [...prev, assistantMsg]);

        // Speak aloud
        if (autoSpeak && announcement) {
          speakVoiceResponse(announcement);
        }
      }
    } catch (err) {
      console.error('Vision scan error:', err);
      setIsScanning(false);
    }
  };

  // Speak response out loud using Gemini TTS
  const speakVoiceResponse = async (text: string) => {
    try {
      stopSpeaking();
      setIsSpeaking(true);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName,
          language: currentLanguage.code,
          style: 'Direct, clear spatial guidance',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          await playBase64Audio(data.audioBase64, data.mimeType || 'audio/wav');
          setIsSpeaking(false);
          return;
        }
      }

      await speakWithBrowserTts(text, currentLanguage.code);
    } catch {
      await speakWithBrowserTts(text, currentLanguage.code);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Toggle Voice Recording
  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    stopSpeaking();
    setIsSpeaking(false);
    playAudioCue('listen-start');
    setIsListening(true);
    setInterimTranscript('');

    const langCode = currentLanguage.code === 'en' ? 'en-US' : currentLanguage.code;

    if (recognitionRef.current?.isSupported) {
      recognitionRef.current.start(
        langCode,
        (data) => {
          setInterimTranscript(data.transcript);
          if (data.isFinal && data.transcript.trim()) {
            handleSendUserVoiceQuery(data.transcript.trim());
            stopListening();
          }
        },
        (err) => {
          console.warn('Speech error:', err);
          stopListening();
        },
        () => setIsListening(false)
      );
    } else {
      const typed = prompt(`Speech recognition not supported in this browser. Type in ${currentLanguage.name}:`);
      if (typed) handleSendUserVoiceQuery(typed);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    playAudioCue('listen-stop');
    setIsListening(false);
    recognitionRef.current?.stop();
  };

  // Send voice query to Gemini Chat
  const handleSendUserVoiceQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setInputText('');
    setInterimTranscript('');
    stopListening();
    stopSpeaking();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: queryText,
      timestamp: new Date(),
    };
    setVoiceMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          language: currentLanguage.code,
          imageBase64: capturedImage,
          conversationHistory: voiceMessages.slice(-4).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const json = await res.json();
      setIsThinking(false);

      if (json.success && json.data) {
        const d = json.data;
        const reply = d.spokenSummary || d.replyText;
        setLatestSpokenAnnouncement(reply);

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: d.replyText,
          spokenSummary: reply,
          timestamp: new Date(),
          hazardWarning: d.hazardWarning,
          suggestedReplies: d.suggestedReplies,
        };
        setVoiceMessages((prev) => [...prev, assistantMsg]);

        if (autoSpeak && reply) {
          speakVoiceResponse(reply);
        }
      }
    } catch (err) {
      setIsThinking(false);
      console.error('Voice AI query error:', err);
    }
  };

  const handleSelectObstacleBox = (obs: DetectedObstacle) => {
    playAudioCue('click');
    const msg = `Obstacle: ${obs.label}, located ${obs.location || 'ahead'}, approximate distance ${obs.distance || 'nearby'}.`;
    setLatestSpokenAnnouncement(msg);
    speakVoiceResponse(msg);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setCapturedImage(b64);
      scanCameraObstacles(b64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-6xl mx-auto w-full px-2 sm:px-4 pb-2">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Single Header Bar: Language & Controls */}
      <div className="flex items-center justify-between gap-2 p-2.5 mb-2 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Active Language Selector */}
          <button
            onClick={onOpenLanguageSelector}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all"
          >
            <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-base">{currentLanguage.flag}</span>
            <span>{currentLanguage.name}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Voice Actor Selector */}
          <select
            value={voiceName}
            onChange={(e) => onChangeVoiceName(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2 py-1.5 focus:outline-none"
          >
            <option value="Kore">Voice: Kore</option>
            <option value="Puck">Voice: Puck</option>
            <option value="Zephyr">Voice: Zephyr</option>
            <option value="Fenrir">Voice: Fenrir</option>
            <option value="Charon">Voice: Charon</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Continuous Auto-scan toggle */}
          <button
            onClick={() => setAutoContinuousScan(!autoContinuousScan)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              autoContinuousScan
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Automatically scan camera for obstacles every 4 seconds"
          >
            <Scan className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto-Scan</span>
          </button>

          {/* Voice Audio Mute */}
          <button
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking();
                setIsSpeaking(false);
              }
              setAutoSpeak(!autoSpeak);
            }}
            className={`p-2 rounded-xl border text-xs transition-all ${
              autoSpeak
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            title={autoSpeak ? 'Voice response enabled' : 'Voice response muted'}
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Left is Camera with Rectangle Bounding Boxes, Right is Voice AI Assistant */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* CAMERA & OBSTACLE DETECTION RECTANGLES (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-950 rounded-3xl border border-slate-800/90 shadow-2xl overflow-hidden relative">
          {/* Viewport container */}
          <div className="relative flex-1 bg-black flex items-center justify-center min-h-[260px] overflow-hidden">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Camera Frame"
                className="w-full h-full object-cover max-h-[480px]"
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover max-h-[480px]"
              />
            )}

            {/* Bounding Rectangle Boxes Overlay */}
            <CameraObstacleOverlay
              obstacles={detectedObstacles}
              isScanning={isScanning}
              onSelectObstacle={handleSelectObstacleBox}
            />

            {/* Top HUD: Path status & Scan count badge */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div
                className={`px-3 py-1.5 rounded-full font-bold text-xs tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-lg pointer-events-auto ${
                  detectedObstacles.some((o) => o.isHazard)
                    ? 'bg-rose-600/90 text-white animate-bounce'
                    : detectedObstacles.length > 0
                    ? 'bg-amber-600/90 text-white'
                    : 'bg-emerald-600/90 text-white'
                }`}
              >
                {detectedObstacles.some((o) => o.isHazard) ? (
                  <>
                    <AlertTriangle className="w-4 h-4" /> OBSTACLE AHEAD
                  </>
                ) : detectedObstacles.length > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4" /> {detectedObstacles.length} OBJECTS DETECTED
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> PATH CLEAR
                  </>
                )}
              </div>

              <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[11px] font-mono text-indigo-300 border border-slate-700">
                {detectedObstacles.length} Rectangles
              </span>
            </div>

            {/* Camera error fallback / Demo scenario selector */}
            {cameraError && !capturedImage && (
              <div className="absolute inset-0 bg-slate-950/90 p-5 flex flex-col items-center justify-center text-center z-20">
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 max-w-sm mb-3">{cameraError}</p>
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  {DEMO_SCENARIOS.map((demo, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCapturedImage(demo.url);
                        scanCameraObstacles(demo.url);
                      }}
                      className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs rounded-xl font-medium"
                    >
                      Try: {demo.title}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-bold flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Upload Frame
                </button>
              </div>
            )}
          </div>

          {/* Bottom Camera Action Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                if (capturedImage) setCapturedImage(null);
                scanCameraObstacles();
              }}
              disabled={isScanning}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Scan className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Detecting Obstacles...' : 'Scan Obstacles Now'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload image to detect obstacles"
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Upload className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setCapturedImage(null);
                setDetectedObstacles([]);
                setVisionAnalysis(null);
                startCamera();
              }}
              title="Reset Camera"
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VOICE AI ASSISTANT & AUDIO GUIDANCE (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900/90 rounded-3xl border border-slate-800/90 shadow-2xl p-4 overflow-hidden justify-between">
          {/* Spoken Voice Guidance Callout */}
          <div className="mb-3 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <Volume2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-0.5">
                  Voice AI Guidance ({currentLanguage.name}):
                </span>
                <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                  {latestSpokenAnnouncement}
                </p>
              </div>
            </div>

            <button
              onClick={() => speakVoiceResponse(latestSpokenAnnouncement)}
              className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white shrink-0 text-xs"
              title="Replay Voice Guidance"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          {/* Conversation & Obstacles Scroll History */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3 max-h-[240px] lg:max-h-none text-xs"
          >
            {voiceMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-2xl border ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white ml-6 border-indigo-500'
                    : 'bg-slate-950/80 text-slate-200 mr-4 border-slate-800'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>

                {/* Obstacle tag pills inside message if any */}
                {msg.obstacles && msg.obstacles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.obstacles.map((obs) => (
                      <span
                        key={obs.id}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                          obs.isHazard ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {obs.label} ({obs.location})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {interimTranscript && (
              <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 italic animate-pulse">
                "{interimTranscript}"
              </div>
            )}

            {isThinking && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-indigo-400 bg-indigo-950/30 rounded-xl">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Drishti Voice AI processing in {currentLanguage.name}...</span>
              </div>
            )}
          </div>

          {/* Waveform & Listening State */}
          <div className="mb-2">
            <AudioWaveVisualizer
              isListening={isListening}
              isSpeaking={isSpeaking}
              isThinking={isThinking}
            />
            <p className="text-center text-[11px] text-indigo-400 font-medium">
              {isListening
                ? `Listening in ${currentLanguage.name}... Speak now`
                : isSpeaking
                ? `Speaking with Gemini ${voiceName} Voice`
                : `Tap microphone or ask about obstacles`}
            </p>
          </div>

          {/* Quick Voice Prompt Chips */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {[
              'Is path clear?',
              'Describe obstacles',
              'Read signs',
              'Guide forward',
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendUserVoiceQuery(chip)}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 border border-slate-800 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Main Voice Mic Orb & Text Input */}
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
            {/* Glowing Voice Mic Button */}
            <div className="relative">
              {isListening && (
                <div className="absolute inset-0 rounded-xl bg-rose-500/30 animate-pulse-ring" />
              )}
              <button
                type="button"
                onClick={handleToggleMic}
                className={`relative z-10 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/50'
                    : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:brightness-110 shadow-md shadow-indigo-500/30'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendUserVoiceQuery(inputText);
              }}
              placeholder={`Speak or type in ${currentLanguage.name}...`}
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none px-2"
            />

            <button
              onClick={() => handleSendUserVoiceQuery(inputText)}
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
