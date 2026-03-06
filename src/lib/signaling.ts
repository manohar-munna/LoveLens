/**
 * LoveLens — Signaling client (Socket.IO)
 * Connects to the signaling server and relays WebRTC signals.
 */

import { io, Socket } from "socket.io-client";

const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:3001";

export interface SignalingCallbacks {
    onRoomJoined?: (data: { roomId: string; isHost: boolean; memberCount: number }) => void;
    onRoomFull?: () => void;
    onPartnerJoined?: () => void;
    onPartnerLeft?: () => void;
    onCreateOffer?: () => void;
    onOffer?: (data: { sdp: RTCSessionDescriptionInit }) => void;
    onAnswer?: (data: { sdp: RTCSessionDescriptionInit }) => void;
    onIceCandidate?: (data: { candidate: RTCIceCandidateInit }) => void;
}

let socket: Socket | null = null;

export function connectToSignalingServer(
    roomId: string,
    callbacks: SignalingCallbacks
): Socket {
    // Disconnect existing connection if any
    if (socket) {
        socket.disconnect();
    }

    socket = io(SIGNALING_URL, {
        transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
        console.log("[signaling] Connected:", socket?.id);
        socket?.emit("join-room", roomId);
    });

    socket.on("room-joined", (data) => {
        callbacks.onRoomJoined?.(data);
    });

    socket.on("room-full", () => {
        callbacks.onRoomFull?.();
    });

    socket.on("partner-joined", () => {
        callbacks.onPartnerJoined?.();
    });

    socket.on("partner-left", () => {
        callbacks.onPartnerLeft?.();
    });

    socket.on("create-offer", () => {
        callbacks.onCreateOffer?.();
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

    socket.on("disconnect", () => {
        console.log("[signaling] Disconnected");
    });

    socket.on("connect_error", (err) => {
        console.error("[signaling] Connection error:", err.message);
    });

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

export function disconnectSignaling() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
