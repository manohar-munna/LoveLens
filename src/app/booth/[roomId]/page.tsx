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
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    useBoothStore,
    FILTERS,
    type FilterId,
    type CapturedFrame,
} from "@/stores/booth-store";
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
} from "@/lib/webrtc";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Countdown Overlay ─────────────────────────────────────────
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
    videoRef,
}: {
    stream: MediaStream | null;
    filter: string;
    label: string;
    mirrored?: boolean;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const ref = videoRef || internalRef;

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream, ref]);

    return (
        <div className="camera-feed relative">
            <video
                ref={ref}
                autoPlay
                playsInline
                muted
                style={{
                    filter: filter !== "none" ? filter : undefined,
                    transform: mirrored ? "scaleX(-1)" : undefined,
                }}
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-white/80">
                {label}
            </div>
            {!stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal/80">
                    <div className="text-center">
                        <Camera size={32} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Waiting for camera...</p>
                    </div>
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
        countdownValue,
        captures,
        captureIndex,
        caption,
        showDateStamp,
        borderStyle,
        localStream,
        remoteStream,
        connectionStatus,
        setLocalStream,
        setRemoteStream,
        setIsHost,
        setPartnerJoined,
        setConnectionStatus,
        setPhase,
        setSelectedFilter,
        setCountdownValue,
        addCapture,
        setCaptureIndex,
        setCaption,
        setShowDateStamp,
        setBorderStyle,
        resetBooth,
        setCaptures,
    } = useBoothStore();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [showFlash, setShowFlash] = useState(false);
    const [copied, setCopied] = useState(false);
    const [stripCanvas, setStripCanvas] = useState<HTMLCanvasElement | null>(null);
    const [stripUrl, setStripUrl] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState(0);
    const [soloMode, setSoloMode] = useState(false);
    const [roomFull, setRoomFull] = useState(false);
    const [roomNotFound, setRoomNotFound] = useState(false);

    // Queue for photo taken events that arrive before local addCapture()
    const remotePhotoQueue = useRef<Record<number, string>>({});

    const filter = FILTERS.find((f) => f.id === selectedFilter)!;
    const partnerConnected = connectionStatus === "connected";

    // Initialize camera on mount
    useEffect(() => {
        let mounted = true;

        async function start() {
            try {
                const stream = await initCamera();
                if (mounted) {
                    setLocalStream(stream);
                    setPhase("preview");
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

    // WebRTC + Signaling: connect to partner when local stream is ready
    useEffect(() => {
        if (!localStream || !roomId) return;

        setConnectionStatus("connecting");

        // Setup WebRTC peer connection
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
                }
            },
        });

        // Connect to signaling server
        const socket = connectToSignalingServer(roomId, {
            onRoomJoined: (data) => {
                console.log("[booth] Room joined:", data);
                setIsHost(data.isHost);
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
            },
            onSyncEvent: (data) => {
                console.log("[booth] Received sync event:", data);
                if (data.type === "START_CAPTURE") {
                    setPhase("countdown");
                    setCaptureIndex(0);
                    runCountdown(0);
                } else if (data.type === "PHOTO_TAKEN") {
                    const store = useBoothStore.getState();
                    const existingCapture = store.captures[data.captureIndex];
                    if (existingCapture) {
                        setCaptures(store.captures.map((c, i) => {
                            if (i === data.captureIndex) {
                                return { ...c, remoteUrl: data.url };
                            }
                            return c;
                        }));
                    } else {
                        // We received photo before local capture finished! Queue it.
                        remotePhotoQueue.current[data.captureIndex] = data.url;
                    }
                } else if (data.type === "FILTER_CHANGE") {
                    setSelectedFilter(data.filterId);
                } else if (data.type === "RESET") {
                    handleRetake(false);
                }
            }
        });

        return () => {
            closePeerConnection();
            disconnectSignaling();
            setConnectionStatus("disconnected");
            setPartnerJoined(false);
            setRemoteStream(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localStream, roomId]);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            stopStream(localStream);
        };
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

        // ALWAYS capture only local video for maximum quality
        const localResult = localVideoRef.current
            ? captureFrame(localVideoRef.current, filter.cssFilter)
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
                remoteUrl: soloMode ? localResult.url : (queuedRemoteUrl || ""), // fallback if missing
            };

            addCapture(newCapture);

            if (partnerConnected) {
                // Instantly send our high quality local capture to partner
                sendSyncEvent({ type: "PHOTO_TAKEN", captureIndex: captureIdx, url: localResult.url });
            }
        }

        const nextIdx = captureIdx + 1;
        setCaptureIndex(nextIdx);

        if (nextIdx < 4) {
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

        const stripCaptures = currentCaptures.map((c) => ({
            localUrl: c.localUrl,
            remoteUrl: c.remoteUrl || c.localUrl,
        }));

        try {
            const canvas = await composePhotostrip({
                captures: stripCaptures,
                filterId: selectedFilter,
                caption,
                showDateStamp,
                borderStyle,
            });

            setStripCanvas(canvas);
            setStripUrl(canvas.toDataURL("image/png"));
        } catch (err) {
            console.error("Strip generation failed:", err);
        }
    }

    // Re-generate when customization changes
    useEffect(() => {
        if (phase === "customizing" && captures.length === 4) {
            generateStrip();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caption, showDateStamp, borderStyle, selectedFilter]);

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
    function handleRetake(isInitiator = true) {
        if (isInitiator && partnerConnected) {
            sendSyncEvent({ type: "RESET" });
        }
        resetBooth();
        setStripCanvas(null);
        setStripUrl(null);
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

    return (
        <div className="gradient-hero min-h-screen flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-white/5">
                <Link href="/booth" className="flex items-center gap-2">
                    <Heart size={20} className="text-pink-primary" fill="currentColor" />
                    <span className="text-sm font-bold font-[family-name:var(--font-outfit)] gradient-text">
                        LoveLens
                    </span>
                </Link>

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
                                        {[0, 1, 2, 3].map((i) => (
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

                                {/* Camera feeds */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                                    <div className="relative">
                                        <CameraFeed
                                            stream={localStream}
                                            filter={filter.cssFilter}
                                            label="You 💕"
                                            videoRef={localVideoRef}
                                        />
                                        {phase === "countdown" && (
                                            <CountdownOverlay value={countdownValue} />
                                        )}
                                        {showFlash && <FlashOverlay />}
                                    </div>

                                    <div className="relative">
                                        <CameraFeed
                                            stream={partnerConnected ? remoteStream : (soloMode ? localStream : null)}
                                            filter={filter.cssFilter}
                                            label={partnerConnected ? "Partner 💝" : (soloMode ? "You (mirrored)" : "Partner 💝")}
                                            videoRef={remoteVideoRef}
                                            mirrored={!partnerConnected && !soloMode}
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
                                                            : connectionStatus === "waiting"
                                                                ? "Waiting for your partner..."
                                                                : "Connecting to room..."}
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
                                </div>

                                {/* Filter carousel */}
                                <div className="mt-5">
                                    <FilterCarousel
                                        selected={selectedFilter}
                                        onSelect={handleFilterSelect}
                                    />
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
                                            Take Photos (4 shots)
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
                                            className="glass-card p-3 rounded-2xl"
                                        >
                                            <img
                                                src={stripUrl}
                                                alt="Your LoveLens photostrip"
                                                className="w-full rounded-xl"
                                            />
                                        </motion.div>
                                    ) : (
                                        <div className="glass-card p-3 rounded-2xl">
                                            {/* Preview grid of captures */}
                                            <div className="bg-white rounded-xl p-3 space-y-2">
                                                {captures.map((c, i) => (
                                                    <div key={i} className="flex gap-2">
                                                        <img
                                                            src={c.localUrl}
                                                            alt={`Capture ${i + 1} - You`}
                                                            className="w-1/2 aspect-[4/3] rounded-l-lg object-cover"
                                                            style={{
                                                                filter:
                                                                    filter.cssFilter !== "none"
                                                                        ? filter.cssFilter
                                                                        : undefined,
                                                            }}
                                                        />
                                                        <img
                                                            src={c.remoteUrl || c.localUrl}
                                                            alt={`Capture ${i + 1} - Partner`}
                                                            className="w-1/2 aspect-[4/3] rounded-r-lg object-cover"
                                                            style={{
                                                                filter:
                                                                    filter.cssFilter !== "none"
                                                                        ? filter.cssFilter
                                                                        : undefined,
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

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
                                            onClick={() => handleRetake(true)}
                                            className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 py-2"
                                        >
                                            <RotateCcw size={14} />
                                            Take New Photos
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
