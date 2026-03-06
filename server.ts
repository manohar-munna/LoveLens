/**
 * LoveLens — Socket.IO Signaling Server
 * Matches two users by room ID and relays WebRTC signals between them.
 * Run: npx tsx server.ts
 */

import { createServer } from "http";
import { Server, Socket } from "socket.io";

const PORT = 3001;

// Room state: roomId → Set of socket IDs
const rooms = new Map<string, Set<string>>();

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket: Socket) => {
    console.log(`[connect] ${socket.id}`);
    let currentRoom: string | null = null;

    socket.on("join-room", (roomId: string) => {
        if (!roomId || typeof roomId !== "string") return;

        // If already in a room, leave it first
        if (currentRoom) {
            leaveRoom(socket, currentRoom);
        }

        // Create room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }

        const members = rooms.get(roomId)!;

        // Limit to 2 users per room
        if (members.size >= 2) {
            socket.emit("room-full");
            console.log(`[room-full] ${socket.id} tried to join ${roomId}`);
            return;
        }

        // Join the Socket.IO room and track membership
        socket.join(roomId);
        members.add(socket.id);
        currentRoom = roomId;

        const isHost = members.size === 1;
        socket.emit("room-joined", { roomId, isHost, memberCount: members.size });
        console.log(`[join-room] ${socket.id} → ${roomId} (${members.size}/2, host=${isHost})`);

        // If second user joins, notify both that partner has joined
        if (members.size === 2) {
            io.to(roomId).emit("partner-joined");
            // Tell the second joiner to wait for an offer from the host
            // Tell the host (first joiner) to create the offer
            const memberIds = Array.from(members);
            const hostId = memberIds[0];
            io.to(hostId).emit("create-offer");
            console.log(`[matched] Room ${roomId} is full — signaling host ${hostId} to create offer`);
        }
    });

    // Relay WebRTC offer from host to joiner
    socket.on("offer", (data: { sdp: RTCSessionDescriptionInit }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit("offer", data);
        console.log(`[offer] ${socket.id} → room ${currentRoom}`);
    });

    // Relay WebRTC answer from joiner to host
    socket.on("answer", (data: { sdp: RTCSessionDescriptionInit }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit("answer", data);
        console.log(`[answer] ${socket.id} → room ${currentRoom}`);
    });

    // Relay ICE candidates
    socket.on("ice-candidate", (data: { candidate: RTCIceCandidateInit }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit("ice-candidate", data);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`[disconnect] ${socket.id}`);
        if (currentRoom) {
            leaveRoom(socket, currentRoom);
        }
    });

    function leaveRoom(sock: Socket, roomId: string) {
        const members = rooms.get(roomId);
        if (members) {
            members.delete(sock.id);
            sock.to(roomId).emit("partner-left");
            console.log(`[leave] ${sock.id} left ${roomId} (${members.size} remaining)`);

            if (members.size === 0) {
                rooms.delete(roomId);
            }
        }
        sock.leave(roomId);
    }
});

httpServer.listen(PORT, () => {
    console.log(`\n🩷 LoveLens Signaling Server running on http://localhost:${PORT}\n`);
});
