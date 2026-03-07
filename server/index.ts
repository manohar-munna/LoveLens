/**
 * LoveLens — Standalone Signaling Server
 * Socket.IO for WebRTC signaling + HTTP API for room management.
 * Deploy separately (e.g., Render.com) for production.
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server, Socket } from "socket.io";

const PORT = parseInt(process.env.PORT || "3001", 10);

// Room state
const rooms = new Map<string, Set<string>>();
const createdRooms = new Set<string>();

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
                createdRooms.add(roomId);
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }
                console.log(`[api] Room created: ${roomId}`);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ roomId, created: true }));
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
        const exists = createdRooms.has(roomId);
        const members = rooms.get(roomId);
        const memberCount = members ? members.size : 0;
        const isFull = memberCount >= 2;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ roomId, exists, memberCount, isFull }));
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
});

// ─── Socket.IO Signaling ──────────────────────────────────────────
io.on("connection", (socket: Socket) => {
    console.log(`[ws] Connected: ${socket.id}`);
    let currentRoom: string | null = null;

    socket.on("join-room", (roomId: string) => {
        if (!roomId || typeof roomId !== "string") return;

        if (!createdRooms.has(roomId)) {
            socket.emit("room-not-found", { roomId });
            console.log(`[ws] Room not found: ${roomId} (${socket.id})`);
            return;
        }

        if (currentRoom) leaveRoom(socket, currentRoom);

        const members = rooms.get(roomId)!;

        if (members.size >= 2) {
            socket.emit("room-full");
            console.log(`[ws] Room full: ${socket.id} → ${roomId}`);
            return;
        }

        socket.join(roomId);
        members.add(socket.id);
        currentRoom = roomId;

        const isHost = members.size === 1;
        socket.emit("room-joined", { roomId, isHost, memberCount: members.size });
        console.log(`[ws] ${socket.id} → ${roomId} (${members.size}/2, host=${isHost})`);

        if (members.size === 2) {
            io.to(roomId).emit("partner-joined");
            const hostId = Array.from(members)[0];
            io.to(hostId).emit("create-offer");
            console.log(`[ws] Room ${roomId} matched — host ${hostId} creating offer`);
        }
    });

    socket.on("offer", (data: { sdp: RTCSessionDescriptionInit }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit("offer", data);
    });

    socket.on("answer", (data: { sdp: RTCSessionDescriptionInit }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit("answer", data);
    });

    socket.on("ice-candidate", (data: { candidate: RTCIceCandidateInit }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit("ice-candidate", data);
    });

    socket.on("disconnect", () => {
        console.log(`[ws] Disconnected: ${socket.id}`);
        if (currentRoom) leaveRoom(socket, currentRoom);
    });

    function leaveRoom(sock: Socket, roomId: string) {
        const members = rooms.get(roomId);
        if (members) {
            members.delete(sock.id);
            sock.to(roomId).emit("partner-left");
            console.log(`[ws] ${sock.id} left ${roomId} (${members.size} remaining)`);
            if (members.size === 0) {
                rooms.delete(roomId);
                createdRooms.delete(roomId);
                console.log(`[ws] Room ${roomId} destroyed`);
            }
        }
        sock.leave(roomId);
    }
});

// ─── Start ────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`\n🩷 LoveLens Signaling Server`);
    console.log(`   Listening on port ${PORT}`);
    console.log(`   HTTP API + Socket.IO active\n`);
});
