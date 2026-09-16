/**
 * LoveLens — Signaling client (Socket.IO)
 * Connects to the signaling server and relays WebRTC signals and device statuses.
 */

import { io, Socket } from "socket.io-client";

/**
 * Dynamically resolves the signaling server URL.
 * Handles desktop localhost, mobile on LAN (e.g. 192.168.x.x), and production deployments.
 */
export function getSignalingUrl(): string {
    if (typeof window === "undefined") {
        return process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:3001";
    }

    const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL;
    if (envUrl) {
        try {
            const parsed = new URL(envUrl);
            // If configured as localhost or 127.0.0.1, but browser is accessing via a LAN IP / custom host (e.g. mobile testing)
            if (
                (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
                window.location.hostname !== "localhost" &&
                window.location.hostname !== "127.0.0.1"
            ) {
                parsed.hostname = window.location.hostname;
                return parsed.toString().replace(/\/$/, "");
            }
            return envUrl;
        } catch {
            return envUrl;
        }
    }

    // Default: use the client's current hostname with signaling server port 3001
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:3001`;
}

export const SIGNALING_URL = typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:3001")
    : getSignalingUrl();

export interface DeviceStatusPayload {
    cameraStatus: "ready" | "permission_denied" | "not_found" | "in_use" | "error" | "loading" | "reconnecting";
    message?: string;
}

export type SyncEventData = Record<string, unknown>;

export interface SignalingCallbacks {
    onRoomJoined?: (data: { roomId: string; isHost: boolean; memberCount: number; clientId?: string }) => void;
    onRoomFull?: () => void;
    onRoomNotFound?: (data: { roomId: string }) => void;
    onPartnerJoined?: () => void;
    onPartnerLeft?: () => void;
    onCreateOffer?: (options?: { iceRestart?: boolean }) => void;
    onOffer?: (data: { sdp: RTCSessionDescriptionInit }) => void;
    onAnswer?: (data: { sdp: RTCSessionDescriptionInit }) => void;
    onIceCandidate?: (data: { candidate: RTCIceCandidateInit }) => void;
    onSyncEvent?: (data: SyncEventData) => void;
    onPartnerStatus?: (status: DeviceStatusPayload) => void;
    onPartnerReconnecting?: () => void;
    onResetPeerConnection?: () => void;
}

let socket: Socket | null = null;
let currentClientId: string | null = null;
let lastRoomId: string | null = null;
let lastCallbacks: SignalingCallbacks | null = null;

export function getClientId(): string {
    if (currentClientId) return currentClientId;
    if (typeof window !== "undefined") {
        let stored = sessionStorage.getItem("lovelens_client_id");
        if (!stored) {
            stored = "user_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
            sessionStorage.setItem("lovelens_client_id", stored);
        }
        currentClientId = stored;
        return stored;
    }
    return "user_" + Math.random().toString(36).substring(2, 11);
}

export function isSignalingConnected(): boolean {
    return !!socket && socket.connected;
}

export function getSignalingSocket(): Socket | null {
    return socket;
}

export function connectToSignalingServer(
    roomId: string,
    callbacks: SignalingCallbacks
): Socket {
    lastRoomId = roomId;
    lastCallbacks = callbacks;

    // Disconnect existing connection if any
    if (socket) {
        socket.disconnect();
    }

    const clientId = getClientId();
    const serverUrl = getSignalingUrl();
    console.log("[signaling] Connecting to signaling server at:", serverUrl);

    socket = io(serverUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
    });

    socket.on("connect", () => {
        console.log("[signaling] Connected:", socket?.id, "as client:", clientId, "to room:", roomId);
        socket?.emit("join-room", { roomId, clientId });
    });

    socket.io.on("reconnect", () => {
        console.log("[signaling] Socket reconnected, re-joining room:", roomId);
        socket?.emit("join-room", { roomId, clientId });
    });

    socket.on("room-joined", (data) => {
        callbacks.onRoomJoined?.(data);
    });

    socket.on("room-full", () => {
        callbacks.onRoomFull?.();
    });

    socket.on("room-not-found", (data) => {
        callbacks.onRoomNotFound?.(data);
    });

    socket.on("partner-joined", () => {
        callbacks.onPartnerJoined?.();
    });

    socket.on("partner-left", () => {
        callbacks.onPartnerLeft?.();
    });

    socket.on("reset-peer-connection", () => {
        callbacks.onResetPeerConnection?.();
    });

    socket.on("create-offer", (options?: { iceRestart?: boolean }) => {
        callbacks.onCreateOffer?.(options);
    });

    socket.on("offer", (data) => {
        callbacks.onOffer?.(data);
    });

    socket.on("answer", (data) => {
        callbacks.onAnswer?.(data);
    });

    socket.on("ice-candidate", (data) => {
        callbacks.onIceCandidate?.(data);
    });

    socket.on("sync-event", (data) => {
        callbacks.onSyncEvent?.(data);
    });

    socket.on("partner-status", (status: DeviceStatusPayload) => {
        callbacks.onPartnerStatus?.(status);
    });

    socket.on("partner-reconnecting", () => {
        callbacks.onPartnerReconnecting?.();
    });

    socket.on("disconnect", (reason) => {
        console.log("[signaling] Disconnected, reason:", reason);
    });

    socket.on("connect_error", (err) => {
        console.error("[signaling] Connection error:", err.message, "target:", serverUrl);
    });

    return socket;
}

export function reconnectSignaling(roomId?: string, callbacks?: SignalingCallbacks): Socket {
    const targetRoomId = roomId || lastRoomId || "";
    const targetCallbacks = callbacks || lastCallbacks || {};

    if (!socket || socket.disconnected) {
        return connectToSignalingServer(targetRoomId, targetCallbacks);
    }

    const clientId = getClientId();
    socket.emit("join-room", { roomId: targetRoomId, clientId });
    return socket;
}

export function sendOffer(sdp: RTCSessionDescriptionInit) {
    socket?.emit("offer", { sdp });
}

export function sendAnswer(sdp: RTCSessionDescriptionInit) {
    socket?.emit("answer", { sdp });
}

export function sendIceCandidate(candidate: RTCIceCandidateInit) {
    socket?.emit("ice-candidate", { candidate });
}

export function sendSyncEvent(data: SyncEventData) {
    socket?.emit("sync-event", data);
}

export function sendDeviceStatus(status: DeviceStatusPayload) {
    socket?.emit("device-status", status);
}

export function requestReconnect() {
    socket?.emit("request-reconnect");
}

export function disconnectSignaling() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
