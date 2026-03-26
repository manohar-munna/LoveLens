"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Heart,
    Camera,
    Download,
    Share2,
    RotateCcw,
    Copy,
    Check,
    Loader2,
    Type,
    Calendar,
    Palette,
    X,
    Image as ImageIcon,
    Wifi,
    WifiOff,
    ArrowLeft,
    ArrowLeftRight,
    RefreshCw,
    ZoomIn,
    Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    useBoothStore,
    FILTERS,
    TEMPLATES,
    FONTS,
    type FilterId,
    type CapturedFrame,
} from "@/stores/booth-store";
// ... (I will use more targeted replacements for safety)
import { initCamera, captureFrame, stopStream } from "@/lib/camera";
import {
    composePhotostrip,
    canvasToBlob,
    downloadBlob,
    sharePhotostrip,
} from "@/lib/canvas";
import { getRoomUrl, copyToClipboard } from "@/lib/room";
import {
    connectToSignalingServer,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendSyncEvent,
    disconnectSignaling,
} from "@/lib/signaling";
import {
    createPeerConnection,
    createOffer as rtcCreateOffer,
    createAnswer as rtcCreateAnswer,
    handleOffer as rtcHandleOffer,
    handleAnswer as rtcHandleAnswer,
    addIceCandidate as rtcAddIceCandidate,
    closePeerConnection,
    replaceLocalStream,
} from "@/lib/webrtc";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Countdown Overlay ─────────────────────────────────────────
// ... rest of code (I will use surgical replacement for specific parts)
function CountdownOverlay({ value }: { value: number }) {
    return (
        <motion.div
            key={value}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 flex items-center justify-center z-30 bg-black/40 backdrop-blur-sm"
        >
            <span className="text-8xl md:text-9xl font-bold font-[family-name:var(--font-outfit)] gradient-text drop-shadow-2xl">
                {value}
            </span>
        </motion.div>
    );
}

// ─── Flash Overlay ──────────────────────────────────────────────
function FlashOverlay() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-white z-30 pointer-events-none"
        />
    );
}

// ─── Camera Feed Component ──────────────────────────────────────
function CameraFeed({
    stream,
    filter,
    label,
    mirrored = true,
    templateEmoji,
    videoRef,
    onFlipCamera,
    showFlipButton = false,
    zoom = 1,
    onZoomChange,
}: {
    stream: MediaStream | null;
    filter: string;
    label: string;
    mirrored?: boolean;
    templateEmoji?: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onFlipCamera?: () => void;
    showFlipButton?: boolean;
    zoom?: number;
    onZoomChange?: (zoom: number) => void;
}) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const ref = videoRef || internalRef;
    const [showZoomSlider, setShowZoomSlider] = useState(false);

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream, ref]);

    // Handle clicks outside the slider to close it
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.zoom-control')) {
                setShowZoomSlider(false);
            }
        };

        if (showZoomSlider) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showZoomSlider]);

    return (
        <div className="camera-feed relative rounded-xl overflow-hidden aspect-[4/5] sm:aspect-video w-full">
            <video
                ref={ref}
                autoPlay
                playsInline
                muted
                style={{
                    filter: filter !== "none" ? filter : undefined,
                    transform: `scale(${mirrored ? -zoom : zoom}, ${zoom})`,
                    transformOrigin: 'center center',
                }}
                className="w-full h-full object-cover transition-transform duration-75"
            />
            
            {/* Top controls (Zoom) */}
            {onZoomChange && (
                <div className="absolute top-2 right-2 zoom-control flex flex-col items-end gap-2 z-20">
                    <button
                        onClick={() => setShowZoomSlider(!showZoomSlider)}
                        className="bg-black/50 backdrop-blur-md text-white/90 text-xs px-2 py-1.5 rounded-lg border border-white/10 hover:bg-black/70 transition-colors"
                    >
                        {zoom.toFixed(1)}x Zoom
                    </button>
                    
                    <AnimatePresence>
                        {showZoomSlider && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                                className="bg-charcoal/90 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl flex flex-col items-center gap-2"
                            >
                                <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Zoom Level</span>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="3" 
                                    step="0.1" 
                                    value={zoom} 
                                    onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                                    className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-primary"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-white/80 flex items-center gap-2">
                    <span>{label}</span>
                </div>
                {showFlipButton && onFlipCamera && (
                    <button
                        onClick={onFlipCamera}
                        className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:text-pink-light transition-colors flex items-center justify-center border border-white/10"
                        title="Flip Camera"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>
            {!stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal/80 z-0">
                    <div className="text-center">
                        <Camera size={32} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Waiting for camera...</p>
                    </div>
                </div>
            )}
            {templateEmoji && (
                <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none z-10 w-full">
                    <span className="text-6xl md:text-8xl drop-shadow-xl select-none" style={{
                        WebkitTextStroke: "1px rgba(255,255,255,0.3)"
                    }}>{templateEmoji}</span>
                </div>
            )}
        </div>
    );
}

// ─── Filter Carousel ────────────────────────────────────────────
function FilterCarousel({
    selected,
    onSelect,
}: {
    selected: FilterId;
    onSelect: (id: FilterId) => void;
}) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar">
            {FILTERS.map((f) => (
                <button
                    key={f.id}
                    onClick={() => onSelect(f.id)}
                    className={`flex flex-col items-center gap-1 shrink-0 transition-all duration-200 ${selected === f.id ? "scale-110" : "opacity-60 hover:opacity-80"
                        }`}
                >
                    <div
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${selected === f.id
                            ? "border-pink-primary shadow-lg shadow-pink-primary/30"
                            : "border-white/10 hover:border-white/20"
                            }`}
                    >
                        <div
                            className="w-full h-full bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 flex items-center justify-center"
                            style={{
                                filter: f.cssFilter !== "none" ? f.cssFilter : undefined,
                            }}
                        >
                            <span className="text-lg">{f.emoji}</span>
                        </div>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {f.name}
                    </span>
                </button>
            ))}
        </div>
    );
}

// ─── Template Carousel ──────────────────────────────────────────
function TemplateCarousel({
    selected,
    onSelect,
}: {
    selected: string;
    onSelect: (id: any) => void;
}) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar mt-4 sm:mt-0 xl:mt-0">
            {TEMPLATES.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={`flex flex-col items-center gap-1 shrink-0 transition-all duration-200 ${selected === t.id ? "scale-110" : "opacity-60 hover:opacity-80"
                        }`}
                >
                    <div
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center bg-charcoal ${selected === t.id
                            ? "border-pink-primary shadow-lg shadow-pink-primary/30"
                            : "border-white/10 hover:border-white/20"
                            }`}
                    >
                        <span className="text-2xl">{t.emoji || "🚫"}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {t.name}
                    </span>
                </button>
            ))}
        </div>
    );
}

// ─── Heart Formation Stencil ────────────────────────────────────
function HeartFormationStencil({ frameIndex, layout, side }: { frameIndex: number, layout: "4-frame" | "9-frame", side: "left" | "right" }) {
    if (layout === "4-frame") {
        const leftSvgs = [
            // Snap 1 (Top Row): Left user top-left curve, Right user top-right curve
            <svg key="4-0-left" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M25 80 C 25 20, 95 35, 95 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 2 (Bottom Row): Left user left stroke, Right user right stroke
            <svg key="4-1-left" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M95 20 L25 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>
        ];

        const rightSvgs = [
            <svg key="4-0-right" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M75 80 C 75 20, 5 35, 5 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            <svg key="4-1-right" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M5 20 L75 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>
        ];
        return side === "left" ? leftSvgs[Math.min(frameIndex, 1)] || null : rightSvgs[Math.min(frameIndex, 1)] || null;
    } else {
        // 9-frame layout
        // Snap 1: Pos 1 (Left) & Pos 3 (Right)
        // Snap 2: Pos 4 (Left) & Pos 5 (Right)
        // Snap 3: Pos 6 (Left) & Pos 8 (Right)
        // Snap 4: Pos 2 (Left) & Pos 7 (Right) -- Note: Pos 2 is top-center, Pos 7 is bottom-center
        // Snap 5: Pos 9 (Center, both users just take selfie)
        const leftSvgs = [
            // Snap 1: Pos 1 (Top Left)
            <svg key="9-0-left" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M20 90 C 20 10, 100 10, 100 60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 2: Pos 4 (Middle Left)
            <svg key="9-1-left" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M20 10 L100 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 3: Pos 6 (Bottom Left)
            <svg key="9-2-left" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M100 10 L100 90 M100 90 L20 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 4: Pos 2 (Top Center)
            <svg key="9-3-left" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M0 60 C 0 10, 50 30, 50 90 M50 90 C 50 30, 100 10, 100 60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 5: Pos 9 (Center - Selfie, no stencil)
            null
        ];

        const rightSvgs = [
            // Snap 1: Pos 3 (Top Right)
            <svg key="9-0-right" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M80 90 C 80 10, 0 10, 0 60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 2: Pos 5 (Middle Right)
            <svg key="9-1-right" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M80 10 L0 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 3: Pos 8 (Bottom Right)
            <svg key="9-2-right" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M0 10 L0 90 M0 90 L80 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 4: Pos 7 (Bottom Center)
            <svg key="9-3-right" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary opacity-50 absolute inset-0 pointer-events-none z-30 drop-shadow-xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,105,180,0.8))' }}>
                <path d="M0 10 L50 60 M50 60 L100 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            </svg>,
            // Snap 5: Pos 9 (Center - Selfie, no stencil)
            null
        ];

        return side === "left" ? leftSvgs[Math.min(frameIndex, 4)] : rightSvgs[Math.min(frameIndex, 4)];
    }
}

// ─── Capture Prompts ────────────────────────────────────────────
const CAPTURE_PROMPTS = [
    "Smile at each other! 😊",
    "Make a silly face! 🤪",
    "Blow a kiss! 😘",
    "Show your love! 💕",
];

// ─── Main Booth Room Page ───────────────────────────────────────
export default function BoothRoomPage() {
    const params = useParams();
    const roomId = params.roomId as string;

    const {
        phase,
        selectedFilter,
        selectedTemplate,
        heartFormationLayout,
        countdownValue,
        captures,
        captureIndex,
        caption,
        showDateStamp,
        textSize,
        borderStyle,
        localStream,
        remoteStream,
        connectionStatus,
        localSide,
        localZoom,
        setLocalStream,
        setRemoteStream,
        setIsHost,
        setPartnerJoined,
        setConnectionStatus,
        setPhase,
        setSelectedFilter,
        setSelectedTemplate,
        setHeartFormationLayout,
        setLocalSide,
        setLocalZoom,
        setCountdownValue,
        addCapture,
        setCaptureIndex,
        setCaption,
        setShowDateStamp,
        setTextSize,
        setBorderStyle,
        retakeRequest,
        setRetakeRequest,
        resetBooth,
        setCaptures,
    } = useBoothStore();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [showFlash, setShowFlash] = useState(false);
    const [copied, setCopied] = useState(false);
    const [stripCanvas, setStripCanvas] = useState<HTMLCanvasElement | null>(null);
    const [stripUrl, setStripUrl] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState(0);
    const [soloMode, setSoloMode] = useState(false);
    const soloModeRef = useRef(soloMode);
    useEffect(() => { soloModeRef.current = soloMode; }, [soloMode]);
    const [roomFull, setRoomFull] = useState(false);
    const [roomNotFound, setRoomNotFound] = useState(false);
    const [retakeSent, setRetakeSent] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [showCountMenu, setShowCountMenu] = useState(false);
    const [pcTrigger, setPcTrigger] = useState(0);
    const [deletedCaptures, setDeletedCaptures] = useState<{index: number, capture: CapturedFrame}[]>([]);

    const handleRestoreCapture = () => {
        if (deletedCaptures.length === 0) return;
        
        const lastDeleted = deletedCaptures[deletedCaptures.length - 1];
        const newDeletedCaptures = deletedCaptures.slice(0, -1);
        setDeletedCaptures(newDeletedCaptures);

        setCaptures((prev) => {
            const newCaptures = [...prev];
            // Insert it back roughly where it was
            newCaptures.splice(lastDeleted.index, 0, lastDeleted.capture);
            return newCaptures;
        });
    };
    const remotePhotoQueue = useRef<Record<number, string>>({});

    const filter = FILTERS.find((f) => f.id === selectedFilter)!;
    const template = TEMPLATES.find((t) => t.id === selectedTemplate)!;
    const partnerConnected = connectionStatus === "connected";

    const toggleCamera = async () => {
        const newMode = facingMode === "user" ? "environment" : "user";
        
        const oldStream = localStreamRef.current;
        
        // Mobile browsers (iOS) often block accessing a second camera while the first is still active.
        // We must stop the old stream BEFORE requesting the new one.
        if (oldStream) {
            stopStream(oldStream);
            localStreamRef.current = null;
        }
        
        try {
            const stream = await initCamera({ facingMode: newMode });
            setLocalStream(stream);
            localStreamRef.current = stream;
            setFacingMode(newMode);
            
            if (partnerConnected) {
                sendSyncEvent({ type: "FACING_MODE_CHANGE", mode: newMode });
                await replaceLocalStream(stream);
            }
        } catch (err) {
            console.error("Failed to flip camera:", err);
            // If flip fails, try to recover the original camera
            try {
                const fallbackStream = await initCamera({ facingMode });
                setLocalStream(fallbackStream);
                localStreamRef.current = fallbackStream;
                if (partnerConnected) await replaceLocalStream(fallbackStream);
            } catch (recoverErr) {
                console.error("Failed to recover camera:", recoverErr);
            }
        }
    };

    const toggleSide = () => {
        const newSide = localSide === "left" ? "right" : "left";
        setLocalSide(newSide);
        if (partnerConnected) {
            sendSyncEvent({ type: "SIDE_CHANGE", side: newSide === "left" ? "right" : "left" });
        }
    };

    // Initialize camera on mount
    useEffect(() => {
        let mounted = true;

        async function checkDevices() {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(device => device.kind === 'videoinput');
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (mounted) {
                    setHasMultipleCameras(videoInputs.length > 1 && isMobile);
                }
            } catch (err) {
                console.error("Failed to enumerate devices:", err);
            }
        }

        async function start() {
            try {
                await checkDevices();
                const stream = await initCamera({ facingMode: "user" });
                if (mounted) {
                    setLocalStream(stream);
                    localStreamRef.current = stream;
                    setPhase("preview");
                } else {
                    stopStream(stream);
                }
            } catch (err) {
                if (mounted) {
                    setCameraError(
                        err instanceof Error ? err.message : "Failed to access camera"
                    );
                }
            }
        }

        start();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Signaling: connect immediately so sync events are never lost
    useEffect(() => {
        if (!roomId) return;

        resetBooth();
        setConnectionStatus("connecting");

        const socket = connectToSignalingServer(roomId, {
            onRoomJoined: (data) => {
                console.log("[booth] Room joined:", data);
                setIsHost(data.isHost);
                // First user (host) is on the left, second user (guest) is on the right
                setLocalSide(data.isHost ? "left" : "right");
                setConnectionStatus(data.memberCount < 2 ? "waiting" : "connecting");
            },
            onRoomFull: () => {
                console.log("[booth] Room is full");
                setRoomFull(true);
            },
            onRoomNotFound: () => {
                console.log("[booth] Room not found");
                setRoomNotFound(true);
            },
            onPartnerJoined: () => {
                console.log("[booth] Partner joined");
                setPartnerJoined(true);
                // If we are the host, sync our current state to the new guest
                if (useBoothStore.getState().isHost) {
                    sendSyncEvent({
                        type: "SYNC_STATE",
                        side: useBoothStore.getState().localSide, // Host's side
                        filterId: useBoothStore.getState().selectedFilter,
                        templateId: useBoothStore.getState().selectedTemplate,
                        layout: useBoothStore.getState().heartFormationLayout,
                        zoom: useBoothStore.getState().localZoom,
                        facingMode: facingMode
                    });
                    sendSyncEvent({
                        type: "CAPTURE_COUNT_CHANGE",
                        count: useBoothStore.getState().maxCaptures
                    });
                }
            },
            onCreateOffer: async () => {
                try {
                    console.log("[booth] Creating WebRTC offer...");
                    const offer = await rtcCreateOffer();
                    sendOffer(offer);
                } catch (err) {
                    console.error("[booth] Failed to create offer:", err);
                }
            },
            onOffer: async (data) => {
                try {
                    console.log("[booth] Received offer, creating answer...");
                    await rtcHandleOffer(data.sdp);
                    const answer = await rtcCreateAnswer();
                    sendAnswer(answer);
                } catch (err) {
                    console.error("[booth] Failed to handle offer:", err);
                }
            },
            onAnswer: async (data) => {
                try {
                    console.log("[booth] Received answer");
                    await rtcHandleAnswer(data.sdp);
                } catch (err) {
                    console.error("[booth] Failed to handle answer:", err);
                }
            },
            onIceCandidate: async (data) => {
                try {
                    await rtcAddIceCandidate(data.candidate);
                } catch (err) {
                    console.error("[booth] Failed to add ICE candidate:", err);
                }
            },
            onPartnerLeft: () => {
                console.log("[booth] Partner left");
                setPartnerJoined(false);
                setRemoteStream(null);
                setConnectionStatus("waiting");
                closePeerConnection();
                setPcTrigger(prev => prev + 1);
            },
            onSyncEvent: (data) => {
                console.log("[booth] Received sync event:", data);
                if (data.type === "SYNC_STATE") {
                    // We are guest, host is sending their state. We set our side to the opposite.
                    setLocalSide(data.side === "left" ? "right" : "left");
                    setSelectedFilter(data.filterId);
                    setSelectedTemplate(data.templateId as any);
                    if (data.layout) {
                        setHeartFormationLayout(data.layout as "4-frame" | "9-frame");
                    }
                    useBoothStore.getState().setRemoteZoom(data.zoom);
                    useBoothStore.getState().setRemoteFacingMode(data.facingMode);
                } else if (data.type === "START_CAPTURE") {
                    setPhase("countdown");
                    setCaptureIndex(0);
                    runCountdown(0);
                } else if (data.type === "PHOTO_TAKEN") {
                    setCaptures((prevCaptures) => {
                        const newCaptures = [...prevCaptures];
                        const existing = newCaptures[data.captureIndex];
                        if (existing) {
                            // Update existing capture with remote URL
                            newCaptures[data.captureIndex] = { ...existing, remoteUrl: data.url };
                        } else {
                            // We received photo before local capture finished! Queue it.
                            remotePhotoQueue.current[data.captureIndex] = data.url;
                        }
                        return newCaptures;
                    });
                } else if (data.type === "FILTER_CHANGE") {
                    setSelectedFilter(data.filterId);
                } else if (data.type === "TEMPLATE_CHANGE") {
                    setSelectedTemplate(data.filterId as any);
                } else if (data.type === "LAYOUT_CHANGE") {
                    setHeartFormationLayout(data.layout as "4-frame" | "9-frame");
                } else if (data.type === "SIDE_CHANGE") {
                    setLocalSide(data.side);
                } else if (data.type === "ZOOM_CHANGE") {
                    useBoothStore.getState().setRemoteZoom(data.zoom);
                } else if (data.type === "FACING_MODE_CHANGE") {
                    useBoothStore.getState().setRemoteFacingMode(data.mode);
                } else if (data.type === "RESET") {
                    executeReset();
                } else if (data.type === "RETAKE_REQUEST") {
                    useBoothStore.getState().setRetakeRequest(true);
                } else if (data.type === "RETAKE_ACCEPT") {
                    executeReset();
                } else if (data.type === "CAPTURE_COUNT_CHANGE") {
                    useBoothStore.getState().setMaxCaptures(data.count);
                }
            }
        });

        return () => {
            disconnectSignaling();
            setConnectionStatus("disconnected");
            setPartnerJoined(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // WebRTC: create peer connection only when local stream is ready
    const hasInitialConnection = useRef(false);
    const isStreamReady = !!localStream;

    useEffect(() => {
        if (!isStreamReady) return;

        console.log("[booth] Creating initial WebRTC connection...");
        const pc = createPeerConnection(localStream, {
            onRemoteStream: (stream) => {
                console.log("[booth] Remote stream received");
                setRemoteStream(stream);
                setPartnerJoined(true);
                setConnectionStatus("connected");
                setSoloMode(false);
            },
            onIceCandidate: (candidate) => {
                sendIceCandidate(candidate.toJSON());
            },
            onConnectionStateChange: (state) => {
                if (state === "disconnected" || state === "failed" || state === "closed") {
                    setConnectionStatus("waiting");
                    setPartnerJoined(false);
                    setRemoteStream(null);
                    hasInitialConnection.current = false; // Allow reconnection
                }
            },
        });

        hasInitialConnection.current = true;

        return () => {
            closePeerConnection();
            setRemoteStream(null);
            hasInitialConnection.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreamReady, pcTrigger]);

    // Cleanup stream on unmount or when transitioning to review phase
    useEffect(() => {
        let mounted = true;

        async function handlePhaseChange() {
            if (phase === "review" || phase === "customizing" || phase === "exporting") {
                if (localStreamRef.current) {
                    stopStream(localStreamRef.current);
                    setLocalStream(null);
                    localStreamRef.current = null;
                }
            } else if (phase === "preview" && !localStreamRef.current) {
                // Restart camera if we go back to preview (e.g. Retake)
                try {
                    const stream = await initCamera({ facingMode });
                    if (mounted) {
                        setLocalStream(stream);
                        localStreamRef.current = stream;
                        
                        // Fix for: rejoining requires reload. We MUST give the new stream to WebRTC
                        if (useBoothStore.getState().connectionStatus === "connected") {
                            await replaceLocalStream(stream);
                        }
                    } else {
                        stopStream(stream);
                    }
                } catch (err) {
                    // Ignore on unmount
                }
            }
        }

        handlePhaseChange();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // Cleanup strictly on unmount
    useEffect(() => {
        return () => {
            if (localStreamRef.current) {
                stopStream(localStreamRef.current);
                localStreamRef.current = null;
            }
            // Ensure store state doesn't hold onto stale streams
            useBoothStore.getState().setLocalStream(null);
            useBoothStore.getState().setRemoteStream(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Copy invite link
    async function handleCopyLink() {
        const url = getRoomUrl(roomId);
        const success = await copyToClipboard(url);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    // Start capture sequence
    const startCapture = useCallback((isInitiator = true) => {
        if (isInitiator && partnerConnected) {
            sendSyncEvent({ type: "START_CAPTURE" });
        }
        setPhase("countdown");
        setCaptureIndex(0);
        runCountdown(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFilter, soloMode, partnerConnected]);

    const handleFilterSelect = (fid: FilterId) => {
        setSelectedFilter(fid);
        if (partnerConnected) {
            sendSyncEvent({ type: "FILTER_CHANGE", filterId: fid });
        }
    };

    const handleTemplateSelect = (tid: any) => {
        setSelectedTemplate(tid);

        let targetCaptures = useBoothStore.getState().maxCaptures;
        if (tid === "heart-formation") {
            const currentLayout = useBoothStore.getState().heartFormationLayout;
            targetCaptures = currentLayout === "4-frame" ? 2 : 5;
            useBoothStore.getState().setMaxCaptures(targetCaptures);
        }

        if (partnerConnected) {
            sendSyncEvent({ type: "TEMPLATE_CHANGE", filterId: tid });
            if (tid === "heart-formation") {
                sendSyncEvent({ type: "CAPTURE_COUNT_CHANGE", count: targetCaptures });
            }
        }
    };

    const handleHeartFormationLayoutSelect = (layout: "4-frame" | "9-frame") => {
        setHeartFormationLayout(layout);
        const targetCaptures = layout === "4-frame" ? 2 : 5;
        useBoothStore.getState().setMaxCaptures(targetCaptures);

        if (partnerConnected) {
            sendSyncEvent({ type: "LAYOUT_CHANGE", layout });
            sendSyncEvent({ type: "CAPTURE_COUNT_CHANGE", count: targetCaptures });
        }
    };

    // Countdown + capture loop
    function runCountdown(captureIdx: number) {
        let count = 3;
        setCountdownValue(count);
        setCurrentPrompt(captureIdx);

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdownValue(count);
            } else {
                clearInterval(interval);
                // Capture!
                doCapture(captureIdx);
            }
        }, 1000);
    }

    // Capture a single frame
    function doCapture(captureIdx: number) {
        setPhase("capturing");
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 300);

        // Fetch latest state to avoid stale closures
        const state = useBoothStore.getState();
        const currentFilter = FILTERS.find((f) => f.id === state.selectedFilter)!;
        const isPartnerConnected = state.connectionStatus === "connected";
        const isSoloMode = soloModeRef.current;

        // ONLY mirror for front camera
        const shouldMirror = facingMode === "user";

        // ALWAYS capture only local video for maximum quality
        const localResult = localVideoRef.current
            ? captureFrame(localVideoRef.current, currentFilter.cssFilter, shouldMirror, state.localZoom)
            : null;

        if (localResult) {
            // Check if partner already sent their photo
            const queuedRemoteUrl = remotePhotoQueue.current[captureIdx];
            if (queuedRemoteUrl) {
                delete remotePhotoQueue.current[captureIdx];
            }

            const newCapture: CapturedFrame = {
                localBlob: undefined as unknown as Blob,
                localUrl: localResult.url,
                remoteBlob: undefined as unknown as Blob,
                remoteUrl: isSoloMode ? "" : (queuedRemoteUrl || ""),
            };

            addCapture(newCapture);

            if (isPartnerConnected) {
                // Instantly send our high quality local capture to partner
                sendSyncEvent({ type: "PHOTO_TAKEN", captureIndex: captureIdx, url: localResult.url });
            }
        }

        const nextIdx = captureIdx + 1;
        setCaptureIndex(nextIdx);

        if (nextIdx < state.maxCaptures) {
            // Short pause then next countdown
            setTimeout(() => {
                setPhase("countdown");
                runCountdown(nextIdx);
            }, 1200);
        } else {
            // All 4 captured! Go to review
            setTimeout(() => {
                setPhase("review");
            }, 800);
        }
    }

    // Generate photostrip
    async function generateStrip() {
        setPhase("customizing");

        const currentCaptures = useBoothStore.getState().captures;

        // Wait if we have less than 4 valid remoteUrls (unless solo mode)
        const isSoloMode = soloModeRef.current;
        const missingRemote = currentCaptures.some(c => !c.remoteUrl);

        if (!isSoloMode && missingRemote) {
            console.log("Waiting for remote captures to sync...");
            // We return and let the useEffect retrigger when state naturally updates
            return;
        }

        const stripCaptures = currentCaptures.map((c) => ({
            localUrl: c.localUrl,
            remoteUrl: isSoloMode ? "" : (c.remoteUrl || ""),
        }));

        try {
            const canvas = await composePhotostrip({
                captures: stripCaptures,
                filterId: selectedFilter,
                caption,
                showDateStamp,
                textSize,
                fontFamily: useBoothStore.getState().fontFamily,
                borderStyle,
                selectedTemplate: useBoothStore.getState().selectedTemplate,
                localSide: useBoothStore.getState().localSide,
            });

            setStripCanvas(canvas);
            setStripUrl(canvas.toDataURL("image/png"));
        } catch (err) {
            console.error("Strip generation failed:", err);
        }
    }

    // Re-generate when customization changes
    useEffect(() => {
        if (phase === "customizing") {
            generateStrip();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caption, showDateStamp, borderStyle, selectedFilter, localSide, textSize, captures]);

    // Download strip
    async function handleDownload(format: "png" | "jpg" | "pdf") {
        if (!stripCanvas) return;
        setIsExporting(true);
        try {
            if (format === "pdf") {
                const { jsPDF } = await import("jspdf");
                const doc = new jsPDF({
                    orientation: "portrait",
                    unit: "px",
                    format: [stripCanvas.width, stripCanvas.height]
                });
                const imgData = stripCanvas.toDataURL("image/jpeg", 1.0);
                doc.addImage(imgData, "JPEG", 0, 0, stripCanvas.width, stripCanvas.height);
                doc.save(`lovelens-strip-${roomId}.pdf`);
            } else {
                const type = format === "jpg" ? "image/jpeg" : "image/png";
                const blob = await canvasToBlob(stripCanvas, type);
                downloadBlob(blob, `lovelens-strip-${roomId}.${format}`);
            }
        } catch (err) {
            console.error("Download failed:", err);
        }
        setIsExporting(false);
    }

    // Share strip
    async function handleShare() {
        if (!stripCanvas) return;
        setIsExporting(true);
        try {
            const blob = await canvasToBlob(stripCanvas, "image/png");
            const shared = await sharePhotostrip(blob, "png");
            if (!shared) {
                // Fallback: download
                downloadBlob(blob, `lovelens-strip-${roomId}.png`);
            }
        } catch (err) {
            console.error("Share failed:", err);
        }
        setIsExporting(false);
    }

    // Reset and retry
    function handleRetakeRequest() {
        if (partnerConnected) {
            sendSyncEvent({ type: "RETAKE_REQUEST" });
            setRetakeSent(true);
            setTimeout(() => setRetakeSent(false), 3000);
        } else {
            executeReset();
        }
    }

    function handleAcceptRetake() {
        sendSyncEvent({ type: "RETAKE_ACCEPT" });
        executeReset();
    }

    function executeReset() {
        resetBooth();
        setStripCanvas(null);
        setStripUrl(null);
        setRetakeRequest(false);
        setPhase("preview");
    }

    // ─── RENDER ─────────────────────────────────────────────────────

    // Room not found state
    if (roomNotFound) {
        return (
            <div className="gradient-hero min-h-screen flex items-center justify-center px-6">
                <div className="glass-card p-8 max-w-md text-center">
                    <Camera size={40} className="text-coral mx-auto mb-4" />
                    <h2 className="text-xl font-bold font-[family-name:var(--font-outfit)] mb-2">
                        Room Not Found
                    </h2>
                    <p className="text-gray-400 text-sm mb-2">
                        No booth exists with code <span className="font-bold text-pink-light">{roomId}</span>
                    </p>
                    <p className="text-gray-500 text-xs mb-6">
                        Make sure you have the correct room code from your partner.
                    </p>
                    <Link href="/booth" className="btn-primary inline-block">
                        Go Back
                    </Link>
                </div>
            </div>
        );
    }

    // Room full state
    if (roomFull) {
        return (
            <div className="gradient-hero min-h-screen flex items-center justify-center px-6">
                <div className="glass-card p-8 max-w-md text-center">
                    <Heart size={40} className="text-coral mx-auto mb-4" fill="currentColor" />
                    <h2 className="text-xl font-bold font-[family-name:var(--font-outfit)] mb-2">
                        Room is Full
                    </h2>
                    <p className="text-gray-400 text-sm mb-2">
                        Room <span className="font-bold text-pink-light">{roomId}</span> already has 2 people.
                    </p>
                    <p className="text-gray-500 text-xs mb-6">
                        Only 2 people are allowed per booth room.
                    </p>
                    <Link href="/booth" className="btn-primary inline-block">
                        Go Back
                    </Link>
                </div>
            </div>
        );
    }

    // Camera error state
    if (cameraError) {
        return (
            <div className="gradient-hero min-h-screen flex items-center justify-center px-6">
                <div className="glass-card p-8 max-w-md text-center">
                    <Camera size={40} className="text-coral mx-auto mb-4" />
                    <h2 className="text-xl font-bold font-[family-name:var(--font-outfit)] mb-2">
                        Camera Access Needed
                    </h2>
                    <p className="text-gray-400 text-sm mb-6">{cameraError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const handleZoomChange = (newZoom: number) => {
        setLocalZoom(newZoom);
        if (partnerConnected) {
            sendSyncEvent({ type: "ZOOM_CHANGE", zoom: newZoom });
        }
    };

    const handleResetZoom = () => {
        handleZoomChange(1);
    };

    const localFeed = (
        <div className="relative">
            <CameraFeed
                stream={localStream}
                filter={filter.cssFilter}
                label="You 💕"
                videoRef={localVideoRef}
                templateEmoji={template?.emoji}
                onFlipCamera={toggleCamera}
                showFlipButton={hasMultipleCameras}
                mirrored={facingMode === "user"}
                zoom={localZoom}
                onZoomChange={handleZoomChange}
            />
            {/* Reset Zoom Button */}
            {localZoom !== 1 && (
                <button 
                    onClick={handleResetZoom}
                    className="absolute top-12 right-2 bg-black/50 backdrop-blur-md text-white/90 text-xs px-2 py-1.5 rounded-lg border border-white/10 hover:bg-black/70 transition-colors z-20"
                >
                    Reset Zoom
                </button>
            )}
            {phase === "countdown" && (
                <CountdownOverlay value={countdownValue} />
            )}
            {showFlash && <FlashOverlay />}
        </div>
    );

    const remoteFeed = (
        <div className="relative">
            <CameraFeed
                stream={partnerConnected ? remoteStream : (soloMode ? localStream : null)}
                filter={filter.cssFilter}
                label={partnerConnected ? "Partner 💝" : (soloMode ? "You (mirrored)" : "Partner 💝")}
                videoRef={remoteVideoRef}
                mirrored={partnerConnected ? useBoothStore.getState().remoteFacingMode === "user" : (soloMode ? (facingMode === "user") : true)}
                templateEmoji={template?.emoji}
                zoom={partnerConnected ? useBoothStore.getState().remoteZoom : (soloMode ? localZoom : 1)}
            />
            {phase === "countdown" && (
                <CountdownOverlay value={countdownValue} />
            )}
            {showFlash && <FlashOverlay />}

            {/* Partner not connected and not in solo mode — show waiting overlay */}
            {!partnerConnected && !soloMode && (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal/80 rounded-xl">
                    <div className="text-center p-4">
                        <Heart
                            size={28}
                            className="text-pink-primary mx-auto mb-3 animate-pulse"
                            fill="currentColor"
                        />
                        <p className="text-sm text-gray-400 mb-2">
                            {roomFull
                                ? "Room is full (2/2)"
                                : connectionStatus === "connecting"
                                    ? "Partner is joining..."
                                    : "Waiting for your partner..."}
                        </p>
                        {!roomFull && (
                            <>
                                <p className="text-xs text-gray-500 mb-3">
                                    Share the room code: <span className="font-bold text-pink-light">{roomId}</span>
                                </p>
                                <button
                                    onClick={() => setSoloMode(true)}
                                    className="btn-secondary text-xs"
                                >
                                    Try Solo Mode
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="gradient-hero min-h-screen flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.location.href = '/booth'} className="text-gray-400 hover:text-white transition-colors" title="Leave Room">
                        <ArrowLeft size={18} />
                    </button>
                    <Link href="/booth" className="flex items-center gap-2">
                        <Heart size={20} className="text-pink-primary" fill="currentColor" />
                        <span className="text-sm font-bold font-[family-name:var(--font-outfit)] gradient-text hidden sm:inline">
                            LoveLens
                        </span>
                    </Link>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="glass rounded-lg px-2 sm:px-3 py-1.5 text-xs font-mono tracking-wider hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                        Room: {roomId}
                    </div>

                    <div className={`glass rounded-lg px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 ${partnerConnected ? 'text-mint' : connectionStatus === 'waiting' ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                        {partnerConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        <span className="hidden sm:inline">{partnerConnected ? 'Connected' : connectionStatus === 'waiting' ? 'Waiting...' : 'Connecting...'}</span>
                    </div>
                    <button
                        onClick={handleCopyLink}
                        className="glass rounded-lg px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1 hover:border-pink-primary/30 transition-colors"
                    >
                        {copied ? (
                            <Check size={12} className="text-mint" />
                        ) : (
                            <Copy size={12} />
                        )}
                        <span className="hidden sm:inline">{copied ? "Copied!" : "Invite"}</span>
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 md:py-6 relative">
                <AnimatePresence mode="wait">
                    {/* ─── PREVIEW & CAPTURE PHASE ──────────────────── */}
                    {(phase === "preview" ||
                        phase === "countdown" ||
                        phase === "capturing") && (
                            <motion.div
                                key="camera-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full max-w-4xl"
                            >
                                {/* Capture prompt */}
                                {phase === "countdown" && (
                                    <motion.p
                                        key={`prompt-${currentPrompt}`}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-center text-lg font-[family-name:var(--font-outfit)] mb-4 text-pink-light"
                                    >
                                        {CAPTURE_PROMPTS[currentPrompt]}
                                    </motion.p>
                                )}

                                {/* Progress dots */}
                                {(phase === "countdown" || phase === "capturing") && (
                                    <div className="flex justify-center gap-2 mb-4">
                                        {Array.from({ length: useBoothStore.getState().maxCaptures }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-3 h-3 rounded-full transition-all duration-300 ${i < captureIndex
                                                    ? "bg-pink-primary scale-100"
                                                    : i === captureIndex
                                                        ? "bg-pink-primary animate-pulse scale-125"
                                                        : "bg-white/20"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Camera feeds - Grid modified to stay grid-cols-2 even on mobile */}
                                <div className="grid grid-cols-2 gap-2 sm:gap-4 relative">
                                    {localSide === "left" ? (
                                        <>
                                            <div key="left-local">{localFeed}</div>
                                            <div key="right-remote">{remoteFeed}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div key="left-remote">{remoteFeed}</div>
                                            <div key="right-local">{localFeed}</div>
                                        </>
                                    )}

                                    {/* Swap Button - Hidden during countdown and capturing */}
                                    {phase === "preview" && (
                                        <button
                                            onClick={toggleSide}
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110 shadow-xl"
                                            title="Swap Positions"
                                        >
                                            <ArrowLeftRight size={18} />
                                        </button>
                                    )}

                                    {/* Heart Formation Stencil Overlay */}
                                    {selectedTemplate === "heart-formation" && (phase === "preview" || phase === "countdown" || phase === "capturing") && (
                                        <>
                                        <div className="absolute inset-0 pointer-events-none z-30 flex" style={{ width: '200%', left: localSide === "left" ? "0%" : "-100%" }}>
                                            <div className="w-1/2 relative h-full">
                                                <HeartFormationStencil frameIndex={captureIndex} layout={heartFormationLayout} side="left" />
                                            </div>
                                            <div className="w-1/2 relative h-full">
                                                <HeartFormationStencil frameIndex={captureIndex} layout={heartFormationLayout} side="right" />
                                            </div>
                                        </div>
                                        </>
                                    )}
                                </div>

                                {/* Carousels */}
                                <div className="mt-5 w-full flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                                        <div className="w-full sm:w-auto overflow-hidden">
                                            <FilterCarousel
                                                selected={selectedFilter}
                                                onSelect={handleFilterSelect}
                                            />
                                        </div>

                                        {/* Capture Count Selector (hide when Love Theme is selected, as counts are fixed) */}
                                        {selectedTemplate !== "heart-formation" && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowCountMenu(!showCountMenu)}
                                                    className="glass px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="text-xs text-gray-400 whitespace-nowrap">Photos:</span>
                                                    <span className="text-sm text-pink-light font-bold flex items-center gap-1">
                                                        {useBoothStore.getState().maxCaptures}
                                                        <span className="text-[10px]">▼</span>
                                                    </span>
                                                </button>

                                                <AnimatePresence>
                                                    {showCountMenu && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            className="absolute top-full right-0 mt-2 w-32 bg-charcoal border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 grid grid-cols-2 gap-1 p-2"
                                                        >
                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                                                <button
                                                                    key={num}
                                                                    onClick={() => {
                                                                        useBoothStore.getState().setMaxCaptures(num);
                                                                        if (partnerConnected) {
                                                                            sendSyncEvent({ type: "CAPTURE_COUNT_CHANGE", count: num });
                                                                        }
                                                                        setShowCountMenu(false);
                                                                    }}
                                                                    className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${useBoothStore.getState().maxCaptures === num ? "bg-pink-primary text-white" : "text-gray-300 hover:bg-white/10"}`}
                                                                >
                                                                    {num}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>

                                    {/* Template Carousel in Preview Phase */}
                                    <div className="w-full overflow-hidden">
                                        <label className="text-xs text-gray-400 mb-2 block px-1">Theme / Template</label>
                                        <TemplateCarousel
                                            selected={selectedTemplate}
                                            onSelect={handleTemplateSelect}
                                        />

                                        {selectedTemplate === "heart-formation" && (
                                            <div className="mt-4 flex gap-2 w-full max-w-sm mx-auto">
                                                <button
                                                    onClick={() => handleHeartFormationLayoutSelect("4-frame")}
                                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                                        heartFormationLayout === "4-frame"
                                                            ? "bg-pink-primary text-white shadow-lg shadow-pink-primary/30"
                                                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                                                    }`}
                                                >
                                                    4 Images (2 Snaps)
                                                </button>
                                                <button
                                                    onClick={() => handleHeartFormationLayoutSelect("9-frame")}
                                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                                        heartFormationLayout === "9-frame"
                                                            ? "bg-pink-primary text-white shadow-lg shadow-pink-primary/30"
                                                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                                                    }`}
                                                >
                                                    9 Images (5 Snaps)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Capture button */}
                                {phase === "preview" && (
                                    <div className="mt-6 text-center">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => startCapture(true)}
                                            className="btn-primary text-lg px-10 py-4 pulse-glow inline-flex items-center gap-2"
                                            disabled={!localStream}
                                        >
                                            <Camera size={20} />
                                            Take Photos ({useBoothStore.getState().maxCaptures} shots)
                                        </motion.button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                    {/* ─── REVIEW / CUSTOMIZE PHASE ────────────────── */}
                    {(phase === "review" || phase === "customizing") && (
                        <motion.div
                            key="review-view"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="w-full max-w-5xl"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Photostrip preview */}
                                <div>
                                    <h3 className="text-lg font-bold font-[family-name:var(--font-outfit)] mb-3 flex items-center gap-2">
                                        <ImageIcon size={18} className="text-pink-primary" />
                                        Your Photostrip
                                    </h3>

                                    {stripUrl ? (
                                        <motion.div
                                            initial={{ y: -40, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 80,
                                                damping: 10,
                                            }}
                                            className="glass-card p-3 rounded-2xl relative overflow-hidden"
                                        >
                                            <img
                                                src={stripUrl}
                                                alt="Your LoveLens photostrip"
                                                className="w-full rounded-xl"
                                            />
                                            {selectedTemplate === "heart-formation" && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: [0, 0.4, 0] }}
                                                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                                    className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
                                                >
                                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-pink-primary drop-shadow-[0_0_15px_rgba(255,105,180,1)] opacity-70">
                                                        <path d="M50 85 L25 45 C 25 15, 50 30, 50 45 C 50 30, 75 15, 75 45 Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                                                    </svg>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <div className="glass-card p-3 rounded-2xl">
                                            {/* Preview grid of captures */}
                                            <div className="bg-white rounded-xl p-3 space-y-2">
                                                {captures.map((c, i) => {
                                                    const leftImg = localSide === "left" ? c.localUrl : (c.remoteUrl || c.localUrl);
                                                    const rightImg = localSide === "left" ? (c.remoteUrl || c.localUrl) : c.localUrl;
                                                    
                                                    return (
                                                        <div key={i} className="flex relative group">
                                                            <img
                                                                src={leftImg}
                                                                alt={`Capture ${i + 1} - Left`}
                                                                className="w-1/2 aspect-[4/3] rounded-l-lg object-cover"
                                                                style={{
                                                                    filter:
                                                                        filter.cssFilter !== "none"
                                                                            ? filter.cssFilter
                                                                            : undefined,
                                                                }}
                                                            />
                                                            <img
                                                                src={rightImg}
                                                                alt={`Capture ${i + 1} - Right`}
                                                                className={`w-1/2 aspect-[4/3] rounded-r-lg object-cover ${(!c.remoteUrl && !soloMode) ? "bg-charcoal/50 animate-pulse" : ""}`}
                                                                style={{
                                                                    filter:
                                                                        filter.cssFilter !== "none"
                                                                            ? filter.cssFilter
                                                                            : undefined,
                                                                }}
                                                            />
                                                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                                                                <button
                                                                    onClick={() => {
                                                                        setDeletedCaptures([...deletedCaptures, { index: i, capture: c }]);
                                                                        const newCaptures = captures.filter((_, index) => index !== i);
                                                                        useBoothStore.getState().setCaptures(newCaptures);
                                                                    }}
                                                                    className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                                                                    title="Delete this capture"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {deletedCaptures.length > 0 && (
                                                <div className="mt-2 text-right">
                                                    <button
                                                        onClick={handleRestoreCapture}
                                                        className="text-xs text-gray-400 hover:text-white flex items-center justify-end gap-1 w-full"
                                                    >
                                                        <RotateCcw size={12} /> Undo Delete
                                                    </button>
                                                </div>
                                            )}

                                            <div className="mt-3 text-center">
                                                <button
                                                    onClick={generateStrip}
                                                    className="btn-primary text-sm"
                                                >
                                                    Generate Photostrip ✨
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Customization panel */}
                                <div>
                                    <h3 className="text-lg font-bold font-[family-name:var(--font-outfit)] mb-3 flex items-center gap-2">
                                        <Palette size={18} className="text-pink-primary" />
                                        Customize
                                    </h3>

                                    <div className="glass-card p-5 space-y-5">
                                        {/* Caption */}
                                        <div>
                                            <label className="text-sm text-gray-400 mb-1.5 flex items-center gap-1.5">
                                                <Type size={14} />
                                                Caption
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Add a cute caption..."
                                                value={caption}
                                                onChange={(e) => setCaption(e.target.value)}
                                                maxLength={60}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-pink-primary/50 text-sm"
                                            />
                                        </div>

                                        {/* Date stamp toggle */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400 flex items-center gap-1.5">
                                                <Calendar size={14} />
                                                Show Date
                                            </label>
                                            <button
                                                onClick={() => setShowDateStamp(!showDateStamp)}
                                                className={`w-12 h-6 rounded-full transition-all duration-200 ${showDateStamp
                                                    ? "bg-pink-primary"
                                                    : "bg-white/10"
                                                    }`}
                                            >
                                                <div
                                                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${showDateStamp
                                                        ? "translate-x-6"
                                                        : "translate-x-0.5"
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        {/* Text Size */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400 flex items-center gap-1.5">
                                                <Type size={14} />
                                                Text Size
                                            </label>
                                            <input 
                                                type="range" 
                                                min="0.8" 
                                                max="2.5" 
                                                step="0.1" 
                                                value={textSize}
                                                onChange={(e) => setTextSize(parseFloat(e.target.value))}
                                                className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-primary"
                                            />
                                        </div>

                                        {/* Font Family */}
                                        <div>
                                            <label className="text-sm text-gray-400 mb-2 flex items-center gap-1.5">
                                                <Type size={14} />
                                                Font Style
                                            </label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                {(
                                                    FONTS
                                                ).map((font) => (
                                                    <button
                                                        key={font.id}
                                                        onClick={() => useBoothStore.getState().setFontFamily(font.id as any)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${useBoothStore.getState().fontFamily === font.id
                                                            ? "bg-pink-primary text-white font-medium"
                                                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                                        }`}
                                                        style={{ fontFamily: font.family }}
                                                    >
                                                        {font.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Border style */}
                                        <div>
                                            <label className="text-sm text-gray-400 mb-2 flex items-center gap-1.5">
                                                <Palette size={14} />
                                                Border Style
                                            </label>
                                            <div className="flex gap-3">
                                                {(
                                                    ["white", "pink", "black", "polaroid"] as const
                                                ).map((style) => (
                                                    <button
                                                        key={style}
                                                        onClick={() => setBorderStyle(style)}
                                                        className={`w-10 h-10 rounded-lg border-2 transition-all ${borderStyle === style
                                                            ? "border-pink-primary scale-110 shadow-lg"
                                                            : "border-white/10 hover:border-white/30"
                                                            }`}
                                                        style={{
                                                            backgroundColor:
                                                                style === "white"
                                                                    ? "#fff"
                                                                    : style === "pink"
                                                                        ? "#FFD6E5"
                                                                        : style === "black"
                                                                            ? "#1A1A2E"
                                                                            : "#FAFAF5",
                                                        }}
                                                        title={style}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Filter (re-selectable) */}
                                        <div>
                                            <label className="text-sm text-gray-400 mb-2 block">
                                                Filter
                                            </label>
                                            <FilterCarousel
                                                selected={selectedFilter}
                                                onSelect={setSelectedFilter}
                                            />
                                        </div>
                                    </div>

                                    {/* Export buttons */}
                                    <div className="mt-5 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleDownload("png")}
                                                disabled={!stripCanvas || isExporting}
                                                className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                                            >
                                                {isExporting ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Download size={16} />
                                                )}
                                                PNG
                                            </button>
                                            <button
                                                onClick={() => handleDownload("jpg")}
                                                disabled={!stripCanvas || isExporting}
                                                className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                                            >
                                                {isExporting ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Download size={16} />
                                                )}
                                                JPG
                                            </button>
                                            <button
                                                onClick={() => handleDownload("pdf")}
                                                disabled={!stripCanvas || isExporting}
                                                className="btn-primary col-span-2 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                                            >
                                                {isExporting ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Download size={16} />
                                                )}
                                                Export as PDF
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleShare}
                                            disabled={!stripCanvas || isExporting}
                                            className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                                        >
                                            <Share2 size={16} />
                                            Share to Instagram, WhatsApp...
                                        </button>

                                        <button
                                            onClick={handleRetakeRequest}
                                            className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 py-2"
                                        >
                                            <RotateCcw size={14} />
                                            {retakeSent ? "Request Sent..." : "Take New Photos"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Retake Request Snackbar */}
            <AnimatePresence>
                {retakeRequest && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl z-50 flex items-center gap-4 max-w-sm w-full"
                    >
                        <div className="w-10 h-10 rounded-full gradient-pink flex items-center justify-center shrink-0">
                            <Heart size={18} className="text-white" fill="currentColor" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold font-[family-name:var(--font-outfit)] text-white">Partner wants to retake!</p>
                            <p className="text-xs text-gray-400">Take new photos together?</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRetakeRequest(false)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <X size={14} className="text-gray-300" />
                            </button>
                            <button
                                onClick={handleAcceptRetake}
                                className="h-8 px-3 rounded-full btn-primary text-xs flex items-center justify-center shrink-0"
                            >
                                Accept
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
