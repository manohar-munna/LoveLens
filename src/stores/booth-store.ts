import { create } from "zustand";

export type FilterId =
    | "none"
    | "vintage"
    | "polaroid"
    | "bw"
    | "romantic"
    | "vhs"
    | "dreamy"
    | "disposable"
    | "old-digital";

export interface FilterDef {
    id: FilterId;
    name: string;
    emoji: string;
    cssFilter: string;
}

export const FILTERS: FilterDef[] = [
    { id: "none", name: "No Filter", emoji: "✨", cssFilter: "none" },
    {
        id: "vintage",
        name: "Vintage Film",
        emoji: "🎞️",
        cssFilter: "sepia(0.4) contrast(1.1) saturate(0.8)",
    },
    {
        id: "polaroid",
        name: "Polaroid",
        emoji: "📸",
        cssFilter: "contrast(1.1) brightness(1.05) saturate(1.1)",
    },
    {
        id: "bw",
        name: "B&W Film",
        emoji: "🖤",
        cssFilter: "grayscale(1) contrast(1.2)",
    },
    {
        id: "romantic",
        name: "Romantic",
        emoji: "💕",
        cssFilter: "brightness(1.08) contrast(0.95) saturate(1.3)",
    },
    {
        id: "vhs",
        name: "VHS",
        emoji: "📼",
        cssFilter: "saturate(0.7) contrast(1.2) brightness(0.95)",
    },
    {
        id: "dreamy",
        name: "Dreamy",
        emoji: "🌸",
        cssFilter: "brightness(1.1) saturate(0.6) hue-rotate(10deg)",
    },
    {
        id: "disposable",
        name: "Disposable",
        emoji: "📷",
        cssFilter: "contrast(1.15) saturate(0.85) brightness(1.05)",
    },
    {
        id: "old-digital",
        name: "Old Digital",
        emoji: "🤳",
        cssFilter: "saturate(0.6) contrast(0.9) brightness(1.1)",
    },
];

export type BoothPhase =
    | "waiting"
    | "preview"
    | "countdown"
    | "capturing"
    | "review"
    | "customizing"
    | "exporting";

export type TemplateId = "none" | "hearts" | "stars" | "crown";

export type FontId = "outfit" | "dancing" | "pacifico" | "caveat" | "vt323";

export interface FontDef {
    id: FontId;
    name: string;
    family: string;
}

export const FONTS: FontDef[] = [
    { id: "outfit", name: "Modern", family: "'Outfit', sans-serif" },
    { id: "dancing", name: "Dancing", family: "'Dancing Script', cursive" },
    { id: "pacifico", name: "Pacifico", family: "'Pacifico', cursive" },
    { id: "caveat", name: "Caveat", family: "'Caveat', cursive" },
    { id: "vt323", name: "Retro", family: "'VT323', monospace" }
];

export interface TemplateDef {
    id: TemplateId;
    name: string;
    emoji: string;
}

export const TEMPLATES: TemplateDef[] = [
    { id: "none", name: "No Sticker", emoji: "" },
    { id: "hearts", name: "Hearts Crown", emoji: "💖" },
    { id: "stars", name: "Star Magic", emoji: "✨" },
    { id: "crown", name: "Royal Crown", emoji: "👑" },
];

export interface CapturedFrame {
    localBlob: Blob;
    localUrl: string;
    remoteBlob?: Blob;
    remoteUrl?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected';

interface BoothStore {
    // Room
    roomId: string | null;
    isHost: boolean;
    partnerJoined: boolean;
    connectionStatus: ConnectionStatus;

    // Camera
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;

    // Booth state
    phase: BoothPhase;
    selectedFilter: FilterId;
    countdownValue: number;
    captureIndex: number;
    captures: CapturedFrame[];
    maxCaptures: number;

    // Customization
    caption: string;
    showDateStamp: boolean;
    textSize: number;
    fontFamily: FontId;
    borderStyle: "white" | "pink" | "black" | "polaroid";
    selectedTemplate: TemplateId;
    localSide: "left" | "right";
    localZoom: number;
    remoteZoom: number;
    remoteFacingMode: "user" | "environment";

    // Retake request
    retakeRequest: boolean;

    // Actions
    setRoomId: (id: string | null) => void;
    setIsHost: (isHost: boolean) => void;
    setPartnerJoined: (joined: boolean) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    setPhase: (phase: BoothPhase) => void;
    setSelectedFilter: (filter: FilterId) => void;
    setCountdownValue: (value: number) => void;
    addCapture: (capture: CapturedFrame) => void;
    setCaptureIndex: (index: number) => void;
    setCaptures: (captures: CapturedFrame[] | ((prev: CapturedFrame[]) => CapturedFrame[])) => void;
    setMaxCaptures: (count: number) => void;
    setCaption: (caption: string) => void;
    setShowDateStamp: (show: boolean) => void;
    setTextSize: (size: number) => void;
    setFontFamily: (font: FontId) => void;
    setBorderStyle: (style: "white" | "pink" | "black" | "polaroid") => void;
    setSelectedTemplate: (template: TemplateId) => void;
    setLocalSide: (side: "left" | "right") => void;
    setLocalZoom: (zoom: number) => void;
    setRemoteZoom: (zoom: number) => void;
    setRemoteFacingMode: (mode: "user" | "environment") => void;
    setRetakeRequest: (request: boolean) => void;
    resetBooth: () => void;
}

export const useBoothStore = create<BoothStore>((set) => ({
    roomId: null,
    isHost: false,
    partnerJoined: false,
    connectionStatus: 'disconnected',
    localStream: null,
    remoteStream: null,
    phase: "waiting",
    selectedFilter: "none",
    countdownValue: 3,
    captureIndex: 0,
    captures: [],
    maxCaptures: 3,
    caption: "",
    showDateStamp: true,
    textSize: 1,
    fontFamily: "outfit",
    borderStyle: "white",
    selectedTemplate: "none",
    localSide: "left",
    localZoom: 1,
    remoteZoom: 1,
    remoteFacingMode: "user",
    retakeRequest: false,

    setRoomId: (id) => set({ roomId: id }),
    setIsHost: (isHost) => set({ isHost }),
    setPartnerJoined: (joined) => set({ partnerJoined: joined }),
    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setPhase: (phase) => set({ phase }),
    setSelectedFilter: (filter) => set({ selectedFilter: filter }),
    setCountdownValue: (value) => set({ countdownValue: value }),
    addCapture: (capture) =>
        set((state) => ({ captures: [...state.captures, capture] })),
    setCaptureIndex: (index) => set({ captureIndex: index }),
    setCaptures: (updaterOrValue) =>
        set((state) => ({
            captures: typeof updaterOrValue === "function"
                ? updaterOrValue(state.captures)
                : updaterOrValue
        })),
    setMaxCaptures: (count) => set({ maxCaptures: count }),
    setCaption: (caption) => set({ caption }),
    setShowDateStamp: (show) => set({ showDateStamp: show }),
    setTextSize: (size) => set({ textSize: size }),
    setFontFamily: (font: FontId) => set({ fontFamily: font }),
    setBorderStyle: (style) => set({ borderStyle: style }),
    setSelectedTemplate: (template) => set({ selectedTemplate: template }),
    setLocalSide: (side) => set({ localSide: side }),
    setLocalZoom: (zoom) => set({ localZoom: zoom }),
    setRemoteZoom: (zoom) => set({ remoteZoom: zoom }),
    setRemoteFacingMode: (mode) => set({ remoteFacingMode: mode }),
    setRetakeRequest: (request) => set({ retakeRequest: request }),
    resetBooth: () =>
        set({
            phase: "waiting",
            captures: [],
            captureIndex: 0,
            caption: "",
            retakeRequest: false,
        }),
}));
