/**
 * LoveLens — WebRTC Peer Connection Manager
 * Creates and manages RTCPeerConnection for video streaming between partners.
 */

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
];

let peerConnection: RTCPeerConnection | null = null;
let savedLocalStream: MediaStream | null = null;
let savedCallbacks: WebRTCCallbacks | null = null;
let iceCandidateQueue: RTCIceCandidateInit[] = [];

export interface WebRTCCallbacks {
    onRemoteStream: (stream: MediaStream) => void;
    onIceCandidate: (candidate: RTCIceCandidate) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export function createPeerConnection(
    localStream: MediaStream | null,
    callbacks: WebRTCCallbacks
): RTCPeerConnection {
    // Close existing connection cleanly
    closePeerConnection();

    savedLocalStream = localStream;
    savedCallbacks = callbacks;
    iceCandidateQueue = [];

    peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 2,
    });

    // Add local tracks to the connection if stream is available
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            peerConnection!.addTrack(track, localStream);
        });
    }

    // Handle incoming remote tracks
    peerConnection.ontrack = (event) => {
        console.log("[webrtc] Remote track received:", event.track.kind);
        if (event.streams && event.streams[0]) {
            callbacks.onRemoteStream(event.streams[0]);
        }
    };

    // Handle ICE candidates generated locally
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callbacks.onIceCandidate(event.candidate);
        }
    };

    // Monitor connection state
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection?.connectionState;
        console.log("[webrtc] Connection state:", state);
        if (state) {
            callbacks.onConnectionStateChange?.(state);
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection?.iceConnectionState;
        console.log("[webrtc] ICE connection state:", iceState);
        if (iceState === "failed" || iceState === "disconnected") {
            console.warn("[webrtc] ICE connection degraded/failed:", iceState);
        }
    };

    return peerConnection;
}

async function drainIceCandidates(): Promise<void> {
    if (!peerConnection || !peerConnection.remoteDescription) return;
    if (iceCandidateQueue.length === 0) return;

    console.log(`[webrtc] Draining ${iceCandidateQueue.length} queued ICE candidate(s)`);
    const candidates = [...iceCandidateQueue];
    iceCandidateQueue = [];

    for (const candidate of candidates) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.warn("[webrtc] Failed to add queued ICE candidate:", err);
        }
    }
}

export async function createOffer(options?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit> {
    if (!peerConnection) {
        if (savedCallbacks) {
            createPeerConnection(savedLocalStream, savedCallbacks);
        } else {
            throw new Error("No peer connection available to create offer");
        }
    }

    const offer = await peerConnection!.createOffer({
        iceRestart: options?.iceRestart ?? false,
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
    });
    await peerConnection!.setLocalDescription(offer);
    return offer;
}

export async function handleOffer(
    sdp: RTCSessionDescriptionInit
): Promise<void> {
    if (!peerConnection) {
        if (savedCallbacks) {
            createPeerConnection(savedLocalStream, savedCallbacks);
        } else {
            throw new Error("No peer connection available to handle offer");
        }
    }

    await peerConnection!.setRemoteDescription(new RTCSessionDescription(sdp));
    await drainIceCandidates();
}

export async function createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!peerConnection) throw new Error("No peer connection available to create answer");

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
}

export async function handleAnswer(
    sdp: RTCSessionDescriptionInit
): Promise<void> {
    if (!peerConnection) throw new Error("No peer connection available to handle answer");

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    await drainIceCandidates();
}

export async function addIceCandidate(
    candidate: RTCIceCandidateInit
): Promise<void> {
    // If peer connection or remote description is not set yet, buffer candidate
    if (!peerConnection || !peerConnection.remoteDescription || !peerConnection.remoteDescription.type) {
        iceCandidateQueue.push(candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
        console.warn("[webrtc] Failed to add ICE candidate:", err);
    }
}

export function closePeerConnection() {
    iceCandidateQueue = [];
    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        try {
            peerConnection.close();
        } catch (err) {
            console.warn("[webrtc] Error closing peer connection:", err);
        }
        peerConnection = null;
        console.log("[webrtc] Peer connection closed");
    }
}

export function getPeerConnection(): RTCPeerConnection | null {
    return peerConnection;
}

export async function replaceLocalStream(newStream: MediaStream) {
    savedLocalStream = newStream;
    if (!peerConnection) return;

    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const senders = peerConnection.getSenders();
    const sender = senders.find((s) => s.track?.kind === "video");

    if (sender) {
        try {
            await sender.replaceTrack(videoTrack);
            console.log("[webrtc] Replaced video track with new stream");
        } catch (err) {
            console.error("[webrtc] Failed to replace video track:", err);
        }
    } else {
        try {
            peerConnection.addTrack(videoTrack, newStream);
            console.log("[webrtc] Added new video track to peer connection");
        } catch (err) {
            console.error("[webrtc] Failed to add new video track:", err);
        }
    }
}

export function isPeerConnected(): boolean {
    return peerConnection?.connectionState === "connected";
}
