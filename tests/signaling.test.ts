/**
 * LoveLens — Automated Signaling & Connection Test Suite
 * Tests:
 * 1. Health check & room creation
 * 2. Room capacity and membership queries
 * 3. Client reconnection with persistent client ID
 * 4. Partner joined & WebRTC offer triggers
 * 5. Device status syncing across peers
 * 6. Stream refresh and ICE restart signaling
 * 7. Room full prevention on back navigation
 * 8. 5-minute empty booth pruning grace period
 */

import { io as Client } from "socket.io-client";
import { spawn } from "child_process";
import path from "path";

const SERVER_PORT = 4199;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

const serverProcess = spawn("npx", ["tsx", "server/index.ts"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: SERVER_PORT.toString() },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
});

serverProcess.stdout.on("data", (data) => {
    // console.log("[server stdout]", data.toString().trim());
});
serverProcess.stderr.on("data", (data) => {
    console.error("[server stderr]", data.toString().trim());
});

function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

async function runTests() {
    try {
        console.log("Waiting for test server to start on port", SERVER_PORT, "...");
        await sleep(2500);

        // Test 1: Health check
        console.log("\n[Test 1] Health Check GET /");
        const healthRes = await fetch(`${SERVER_URL}/`);
        const healthData = await healthRes.json();
        console.log("Health check result:", healthData);
        if (healthData.status !== "ok") throw new Error("Health check failed");

        // Test 2: Room Creation POST /api/rooms
        console.log("\n[Test 2] Create Room POST /api/rooms");
        const testRoomId = "TEST99";
        const createRes = await fetch(`${SERVER_URL}/api/rooms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: testRoomId }),
        });
        const createData = await createRes.json();
        console.log("Create room response:", createData);
        if (!createData.created) throw new Error("Room creation failed");

        // Test 3: Check Room status GET /api/rooms/TEST99
        console.log("\n[Test 3] Check Room GET /api/rooms/TEST99");
        const checkRes = await fetch(`${SERVER_URL}/api/rooms/${testRoomId}`);
        const checkData = await checkRes.json();
        console.log("Check room response:", checkData);
        if (!checkData.exists || checkData.memberCount !== 0 || checkData.isFull) {
            throw new Error("Check room returned unexpected initial state");
        }

        // Test 4: Connect User 1
        console.log("\n[Test 4] Connect Client 1 to room");
        const client1Id = "user_alpha_1";
        const socket1 = Client(SERVER_URL, { transports: ["websocket"] });

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Socket 1 connect timeout")), 5000);
            socket1.on("connect", () => {
                socket1.emit("join-room", { roomId: testRoomId, clientId: client1Id });
            });
            socket1.on("room-joined", (data) => {
                console.log("Socket 1 joined:", data);
                if (data.isHost !== true || data.memberCount !== 1) {
                    reject(new Error("Socket 1 room-joined data incorrect"));
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        // Test 5: Connect User 2 (Should trigger partner-joined and create-offer for host)
        console.log("\n[Test 5] Connect Client 2 to room");
        const client2Id = "user_beta_2";
        const socket2 = Client(SERVER_URL, { transports: ["websocket"] });

        let socket1ReceivedPartnerJoined = false;
        let socket1ReceivedCreateOffer = false;

        socket1.on("partner-joined", () => {
            console.log("Socket 1 received partner-joined!");
            socket1ReceivedPartnerJoined = true;
        });
        socket1.on("create-offer", (options) => {
            console.log("Socket 1 (host) received create-offer:", options);
            socket1ReceivedCreateOffer = true;
        });

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Socket 2 connect timeout")), 5000);
            socket2.on("connect", () => {
                socket2.emit("join-room", { roomId: testRoomId, clientId: client2Id });
            });
            socket2.on("room-joined", (data) => {
                console.log("Socket 2 joined:", data);
                if (data.isHost !== false || data.memberCount !== 2) {
                    reject(new Error("Socket 2 room-joined data incorrect"));
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        await sleep(1000);
        if (!socket1ReceivedPartnerJoined || !socket1ReceivedCreateOffer) {
            throw new Error("Partner joined or create-offer signal was not received by host");
        }

        // Test 6: Check room is full via HTTP API
        console.log("\n[Test 6] Verify HTTP API reports room full when 2 users connected");
        const fullRes = await fetch(`${SERVER_URL}/api/rooms/${testRoomId}`);
        const fullData = await fullRes.json();
        console.log("Room full check:", fullData);
        if (!fullData.isFull || fullData.memberCount !== 2) {
            throw new Error("HTTP API should report isFull=true with 2 members");
        }

        // Test 7: Device status syncing (e.g. camera permission denied notification)
        console.log("\n[Test 7] Sync device status: Client 2 reports camera permission denied");
        let socket1ReceivedPartnerStatus = false;
        socket1.on("partner-status", (status) => {
            console.log("Socket 1 received partner-status:", status);
            if (status.cameraStatus === "permission_denied") {
                socket1ReceivedPartnerStatus = true;
            }
        });

        socket2.emit("device-status", {
            cameraStatus: "permission_denied",
            message: "Camera permission denied by user",
        });

        await sleep(1000);
        if (!socket1ReceivedPartnerStatus) {
            throw new Error("Partner status was not relayed to peer");
        }

        // Test 8: Reconnection request
        console.log("\n[Test 8] Request reconnect from Client 2");
        let socket1ReceivedPartnerReconnecting = false;
        let socket1ReceivedIceRestartOffer = false;

        socket1.on("partner-reconnecting", () => {
            console.log("Socket 1 received partner-reconnecting!");
            socket1ReceivedPartnerReconnecting = true;
        });
        socket1.on("create-offer", (options) => {
            if (options?.iceRestart) {
                console.log("Socket 1 received create-offer with iceRestart=true!");
                socket1ReceivedIceRestartOffer = true;
            }
        });

        socket2.emit("request-reconnect");
        await sleep(1000);
        if (!socket1ReceivedPartnerReconnecting || !socket1ReceivedIceRestartOffer) {
            throw new Error("request-reconnect did not trigger iceRestart offer to host");
        }

        // Test 9: User 2 navigates back / disconnects. Verify room capacity updates
        console.log("\n[Test 9] User 2 navigates back (disconnects). Verify room capacity updates");
        let socket1ReceivedPartnerLeft = false;
        socket1.on("partner-left", () => {
            console.log("Socket 1 received partner-left");
            socket1ReceivedPartnerLeft = true;
        });

        socket2.disconnect();
        await sleep(1000);
        if (!socket1ReceivedPartnerLeft) {
            throw new Error("Socket 1 did not receive partner-left event");
        }

        // Check HTTP API: memberCount should be 1 and isFull should be false
        const afterLeaveRes = await fetch(`${SERVER_URL}/api/rooms/${testRoomId}`);
        const afterLeaveData = await afterLeaveRes.json();
        console.log("API status after User 2 left:", afterLeaveData);
        if (afterLeaveData.isFull || afterLeaveData.memberCount !== 1) {
            throw new Error("Room should NOT be full after one user leaves");
        }

        // Test 10: User 2 returns / rejoins with the same clientId
        console.log("\n[Test 10] User 2 returns to booth and rejoins with same clientId");
        const socket2Return = Client(SERVER_URL, { transports: ["websocket"] });
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Socket 2 return timeout")), 5000);
            socket2Return.on("connect", () => {
                socket2Return.emit("join-room", { roomId: testRoomId, clientId: client2Id });
            });
            socket2Return.on("room-joined", (data) => {
                console.log("Socket 2 successfully rejoined:", data);
                if (data.memberCount !== 2) {
                    reject(new Error("Expected member count 2 upon rejoin"));
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            socket2Return.on("room-full", () => {
                reject(new Error("Room erroneously said 'room-full' for returning user!"));
            });
        });

        // Test 11: Disconnect both users. Room should NOT be pruned immediately (5-minute timer)
        console.log("\n[Test 11] Both users disconnect. Verify room is preserved (not pruned immediately)");
        socket1.disconnect();
        socket2Return.disconnect();
        await sleep(1000);

        const emptyRes = await fetch(`${SERVER_URL}/api/rooms/${testRoomId}`);
        const emptyData = await emptyRes.json();
        console.log("API status when both users left:", emptyData);
        if (!emptyData.exists) {
            throw new Error("Room was prematurely pruned! It must persist for 5 minutes.");
        }
        if (emptyData.memberCount !== 0 || emptyData.isFull) {
            throw new Error("Room should have 0 active members and isFull=false");
        }

        console.log("\n🎉 ALL 11 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n");
    } finally {
        serverProcess.kill();
    }
}

runTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ TEST SUITE FAILED:", err);
        process.exit(1);
    });
