/**
 * LoveLens — Standalone Signaling Server
 * Socket.IO for WebRTC signaling + HTTP API for room management.
 * Deploy separately (e.g., Render.com) for production.
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server, Socket } from "socket.io";

const PORT = parseInt(process.env.PORT || "3001", 10);
const PRUNE_DELAY_MS = 5 * 60 * 1000; // 5 minutes grace period after both users leave

interface Participant {
    clientId: string;
    socketId: string;
    isHost: boolean;
    connected: boolean;
    joinedAt: number;
    lastSeen: number;
    deviceStatus?: {
        cameraStatus: "ready" | "permission_denied" | "not_found" | "in_use" | "error" | "loading" | "reconnecting";
        message?: string;
    };
}

interface Room {
    roomId: string;
    createdAt: number;
    participants: Map<string, Participant>; // clientId -> Participant
    pruneTimer: NodeJS.Timeout | null;
}

// Room state
const rooms = new Map<string, Room>();
const createdRooms = new Set<string>();
const socketToRoom = new Map<string, { roomId: string; clientId: string }>();

function getOrCreateRoom(roomId: string): Room {
    let room = rooms.get(roomId);
    if (!room) {
        room = {
            roomId,
            createdAt: Date.now(),
            participants: new Map(),
            pruneTimer: null,
        };
        rooms.set(roomId, room);
    }
    return room;
}

function pruneRoom(roomId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    const activeMembers = Array.from(room.participants.values()).filter((p) => p.connected).length;
    if (activeMembers === 0) {
        rooms.delete(roomId);
        createdRooms.delete(roomId);
        console.log(`[ws] Pruned booth ${roomId} after 5 minutes of both users leaving.`);
    }
}

// ─── HTTP API ─────────────────────────────────────────────────────
function handleRequest(req: IncomingMessage, res: ServerResponse) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url || "";

    // Health check
    if (url === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "LoveLens Signaling" }));
        return;
    }

    // Create room
    if (url === "/api/rooms" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk));
        req.on("end", () => {
            try {
                const { roomId } = JSON.parse(body);
                if (!roomId || typeof roomId !== "string") {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "roomId is required" }));
                    return;
                }
                const cleanRoomId = roomId.toUpperCase();
                createdRooms.add(cleanRoomId);
                getOrCreateRoom(cleanRoomId);
                console.log(`[api] Room created: ${cleanRoomId}`);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ roomId: cleanRoomId, created: true }));
            } catch {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        });
        return;
    }

    // Check room
    const checkMatch = url.match(/^\/api\/rooms\/([A-Za-z0-9]+)$/);
    if (checkMatch && req.method === "GET") {
        const roomId = checkMatch[1].toUpperCase();
        const exists = createdRooms.has(roomId) || rooms.has(roomId);
        const room = rooms.get(roomId);
        const activeMembers = room
            ? Array.from(room.participants.values()).filter((p) => p.connected).length
            : 0;
        const isFull = activeMembers >= 2;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ roomId, exists, memberCount: activeMembers, isFull }));
        return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
}

// ─── Server Setup ─────────────────────────────────────────────────
const httpServer = createServer(handleRequest);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 5e7, // 50MB for base64 images
});

// ─── Socket.IO Signaling ──────────────────────────────────────────
io.on("connection", (socket: Socket) => {
    console.log(`[ws] Connected: ${socket.id}`);

    socket.on("join-room", (payload: string | { roomId: string; clientId?: string }) => {
        const roomId = (typeof payload === "string" ? payload : payload?.roomId || "").toUpperCase();
        const rawClientId = typeof payload === "object" ? payload.clientId : undefined;
        const clientId = rawClientId || socket.id;

        if (!roomId) return;

        if (!createdRooms.has(roomId) && !rooms.has(roomId)) {
            socket.emit("room-not-found", { roomId });
            console.log(`[ws] Room not found: ${roomId} (${socket.id})`);
            return;
        }

        // Leave existing room if any
        if (socketToRoom.has(socket.id)) {
            leaveRoom(socket);
        }

        createdRooms.add(roomId);
        const room = getOrCreateRoom(roomId);

        // Cancel any pending prune timer since someone is joining/active
        if (room.pruneTimer) {
            clearTimeout(room.pruneTimer);
            room.pruneTimer = null;
            console.log(`[ws] User joined ${roomId}. Cancelled 5-minute prune timer.`);
        }

        let participant = room.participants.get(clientId);

        if (participant) {
            // Existing participant returning (e.g. reload, back navigation, or reconnect)
            participant.socketId = socket.id;
            participant.connected = true;
            participant.lastSeen = Date.now();
            console.log(`[ws] Existing client reconnected: ${clientId} (${socket.id}) to ${roomId}`);
        } else {
            // New participant
            const activeParticipants = Array.from(room.participants.values()).filter((p) => p.connected);

            if (activeParticipants.length >= 2) {
                socket.emit("room-full");
                console.log(`[ws] Room full: ${socket.id} → ${roomId} (${activeParticipants.length} active)`);
                return;
            }

            // If we have inactive participants and room reached 2 total, free up slot for the new participant
            if (room.participants.size >= 2) {
                for (const [id, p] of room.participants.entries()) {
                    if (!p.connected) {
                        room.participants.delete(id);
                        break;
                    }
                }
            }

            const isHost = activeParticipants.length === 0;
            participant = {
                clientId,
                socketId: socket.id,
                isHost,
                connected: true,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
            };
            room.participants.set(clientId, participant);
        }

        socket.join(roomId);
        socketToRoom.set(socket.id, { roomId, clientId });

        const activeParticipants = Array.from(room.participants.values()).filter((p) => p.connected);
        const memberCount = activeParticipants.length;

        socket.emit("room-joined", {
            roomId,
            isHost: participant.isHost,
            memberCount,
            clientId,
        });
        console.log(`[ws] ${socket.id} (client ${clientId}) joined ${roomId} (${memberCount}/2, host=${participant.isHost})`);

        // If partner is already present, sync status and trigger WebRTC handshake
        if (memberCount === 2) {
            io.to(roomId).emit("partner-joined");
            io.to(roomId).emit("reset-peer-connection");

            // Find host
            const host = activeParticipants.find((p) => p.isHost) || activeParticipants[0];
            setTimeout(() => {
                io.to(host.socketId).emit("create-offer", { iceRestart: false });
                console.log(`[ws] Room ${roomId} matched — host ${host.socketId} creating offer`);
            }, 60);

            // If partner has known device status, send it to the newly joined peer
            const partner = activeParticipants.find((p) => p.clientId !== clientId);
            if (partner?.deviceStatus) {
                socket.emit("partner-status", partner.deviceStatus);
            }
            if (participant.deviceStatus && partner) {
                io.to(partner.socketId).emit("partner-status", participant.deviceStatus);
            }
        }
    });

    socket.on("device-status", (status: { cameraStatus: string; message?: string }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;
        const participant = room.participants.get(info.clientId);
        if (participant) {
            participant.deviceStatus = status as any;
        }
        socket.to(info.roomId).emit("partner-status", status);
        console.log(`[ws] Device status from ${socket.id} in ${info.roomId}:`, status);
    });

    socket.on("request-reconnect", () => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;

        console.log(`[ws] Reconnect requested by ${socket.id} in ${info.roomId}`);
        socket.to(info.roomId).emit("partner-reconnecting");
        io.to(info.roomId).emit("reset-peer-connection");

        const activeParticipants = Array.from(room.participants.values()).filter((p) => p.connected);
        const host = activeParticipants.find((p) => p.isHost) || activeParticipants[0];
        if (host) {
            setTimeout(() => {
                io.to(host.socketId).emit("create-offer", { iceRestart: false });
                console.log(`[ws] Dispatched create-offer to host ${host.socketId} after peer connection reset`);
            }, 60);
        }
    });

    socket.on("offer", (data: { sdp: RTCSessionDescriptionInit }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        socket.to(info.roomId).emit("offer", data);
    });

    socket.on("answer", (data: { sdp: RTCSessionDescriptionInit }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        socket.to(info.roomId).emit("answer", data);
    });

    socket.on("ice-candidate", (data: { candidate: RTCIceCandidateInit }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        socket.to(info.roomId).emit("ice-candidate", data);
    });

    socket.on("sync-event", (data: any) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        socket.to(info.roomId).emit("sync-event", data);
    });

    socket.on("disconnect", () => {
        console.log(`[ws] Disconnected: ${socket.id}`);
        leaveRoom(socket);
    });

    function leaveRoom(sock: Socket) {
        const info = socketToRoom.get(sock.id);
        if (!info) return;
        socketToRoom.delete(sock.id);

        const room = rooms.get(info.roomId);
        if (!room) return;

        const participant = room.participants.get(info.clientId);
        if (participant && participant.socketId === sock.id) {
            participant.connected = false;
            participant.lastSeen = Date.now();
        }

        sock.to(info.roomId).emit("partner-left");
        sock.leave(info.roomId);

        const activeMembers = Array.from(room.participants.values()).filter((p) => p.connected).length;
        console.log(`[ws] ${sock.id} (client ${info.clientId}) left ${info.roomId} (${activeMembers} active remaining)`);

        // Requirement: "dont prune the connection until both users leave the booth, prune the booth only after 5 min of them leaving the booth."
        if (activeMembers === 0) {
            if (room.pruneTimer) clearTimeout(room.pruneTimer);
            console.log(`[ws] Both users left ${info.roomId}. Scheduling booth prune in 5 minutes.`);
            room.pruneTimer = setTimeout(() => {
                pruneRoom(info.roomId);
            }, PRUNE_DELAY_MS);
        } else {
            console.log(`[ws] 1 user still in ${info.roomId}. Keeping booth active.`);
        }
    }
});

// ─── Start ────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`\n🩷 LoveLens Signaling Server`);
    console.log(`   Listening on port ${PORT}`);
    console.log(`   HTTP API + Socket.IO active`);
    console.log(`   5-minute empty booth pruning enabled\n`);
});
