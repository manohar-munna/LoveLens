/**
 * LoveLens — Custom Next.js Server with Integrated Socket.IO Signaling
 * Runs both Next.js and the signaling server on the same port.
 * Also provides API routes for room creation/validation.
 * Run: npx tsx custom-server.ts
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import next from "next";
import { Server, Socket } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Room state: roomId → Set of socket IDs
// Only rooms explicitly created via the API will exist here
const rooms = new Map<string, Set<string>>();

// Track created rooms (rooms that were explicitly created, not auto-joined)
const createdRooms = new Set<string>();

app.prepare().then(() => {
    const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = req.url || "";

        // ─── API: Create Room ─────────────────────────────────────
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

                    // Register the room as created
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

        // ─── API: Check Room ──────────────────────────────────────
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

        // ─── All other requests → Next.js ─────────────────────────
        handle(req, res);
    });

    // ─── Socket.IO Signaling Server ───────────────────────────────
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket: Socket) => {
        console.log(`[signaling] Connected: ${socket.id}`);
        let currentRoom: string | null = null;

        socket.on("join-room", (roomId: string) => {
            if (!roomId || typeof roomId !== "string") return;

            // Check if room was explicitly created
            if (!createdRooms.has(roomId)) {
                socket.emit("room-not-found", { roomId });
                console.log(`[signaling] Room not found: ${roomId} (${socket.id})`);
                return;
            }

            // If already in a room, leave it first
            if (currentRoom) {
                leaveRoom(socket, currentRoom);
            }

            const members = rooms.get(roomId)!;

            // Limit to 2 users per room
            if (members.size >= 2) {
                socket.emit("room-full");
                console.log(`[signaling] Room full: ${socket.id} tried ${roomId}`);
                return;
            }

            // Join the Socket.IO room and track membership
            socket.join(roomId);
            members.add(socket.id);
            currentRoom = roomId;

            const isHost = members.size === 1;
            socket.emit("room-joined", {
                roomId,
                isHost,
                memberCount: members.size,
            });
            console.log(
                `[signaling] ${socket.id} → ${roomId} (${members.size}/2, host=${isHost})`
            );

            // If second user joins, notify both and start WebRTC handshake
            if (members.size === 2) {
                io.to(roomId).emit("partner-joined");

                // Tell the host (first joiner) to create the offer
                const memberIds = Array.from(members);
                const hostId = memberIds[0];
                io.to(hostId).emit("create-offer");
                console.log(
                    `[signaling] Room ${roomId} matched — host ${hostId} creating offer`
                );
            }
        });

        // Relay WebRTC offer
        socket.on("offer", (data: { sdp: RTCSessionDescriptionInit }) => {
            if (!currentRoom) return;
            socket.to(currentRoom).emit("offer", data);
            console.log(`[signaling] Offer: ${socket.id} → ${currentRoom}`);
        });

        // Relay WebRTC answer
        socket.on("answer", (data: { sdp: RTCSessionDescriptionInit }) => {
            if (!currentRoom) return;
            socket.to(currentRoom).emit("answer", data);
            console.log(`[signaling] Answer: ${socket.id} → ${currentRoom}`);
        });

        // Relay ICE candidates
        socket.on(
            "ice-candidate",
            (data: { candidate: RTCIceCandidateInit }) => {
                if (!currentRoom) return;
                socket.to(currentRoom).emit("ice-candidate", data);
            }
        );

        // Handle disconnection
        socket.on("disconnect", () => {
            console.log(`[signaling] Disconnected: ${socket.id}`);
            if (currentRoom) {
                leaveRoom(socket, currentRoom);
            }
        });

        function leaveRoom(sock: Socket, roomId: string) {
            const members = rooms.get(roomId);
            if (members) {
                members.delete(sock.id);
                sock.to(roomId).emit("partner-left");
                console.log(
                    `[signaling] ${sock.id} left ${roomId} (${members.size} remaining)`
                );
                if (members.size === 0) {
                    rooms.delete(roomId);
                    createdRooms.delete(roomId);
                    console.log(`[signaling] Room ${roomId} destroyed (empty)`);
                }
            }
            sock.leave(roomId);
        }
    });

    // ─── Start Server ─────────────────────────────────────────────
    httpServer.listen(port, () => {
        console.log(
            `\n🩷 LoveLens running on http://${hostname}:${port}` +
            `\n   ✅ Next.js ${dev ? "(dev)" : "(production)"}` +
            `\n   ✅ Socket.IO signaling active\n`
        );
    });
});
