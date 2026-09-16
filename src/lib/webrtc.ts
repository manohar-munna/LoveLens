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

export interface WebRTCCallbacks {
    onRemoteStream: (stream: MediaStream) => void;
    onIceCandidate: (candidate: RTCIceCandidate) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export function createPeerConnection(
    localStream: MediaStream,
    callbacks: WebRTCCallbacks
): RTCPeerConnection {
    // Close existing connection if any
    closePeerConnection();

    peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 2,
    });

    // Add local tracks to the connection
    localStream.getTracks().forEach((track) => {
        peerConnection!.addTrack(track, localStream);
    });

    // Handle incoming remote tracks
    peerConnection.ontrack = (event) => {
        console.log("[webrtc] Remote track received:", event.track.kind);
        if (event.streams && event.streams[0]) {
            callbacks.onRemoteStream(event.streams[0]);
        }
    };

    // Handle ICE candidates
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
        console.log("[webrtc] ICE state:", iceState);
        if (iceState === "failed" || iceState === "disconnected") {
            console.warn("[webrtc] ICE connection degraded/failed:", iceState);
        }
    };

    return peerConnection;
}

export async function createOffer(options?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit> {
    if (!peerConnection) throw new Error("No peer connection");

    const offer = await peerConnection.createOffer({
        iceRestart: options?.iceRestart ?? false,
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
    });
    await peerConnection.setLocalDescription(offer);
    return offer;
}

export async function handleOffer(
    sdp: RTCSessionDescriptionInit
): Promise<void> {
    if (!peerConnection) throw new Error("No peer connection");

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
}

export async function createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!peerConnection) throw new Error("No peer connection");

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
}

export async function handleAnswer(
    sdp: RTCSessionDescriptionInit
): Promise<void> {
    if (!peerConnection) throw new Error("No peer connection");

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
}

export async function addIceCandidate(
    candidate: RTCIceCandidateInit
): Promise<void> {
    if (!peerConnection) return;

    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
        console.warn("[webrtc] Failed to add ICE candidate:", err);
    }
}

export function closePeerConnection() {
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
