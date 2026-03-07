"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Camera, Link2, Copy, Check, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateRoomId, getRoomUrl, copyToClipboard } from "@/lib/room";
import { SIGNALING_URL } from "@/lib/signaling";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";

export default function BoothEntryPage() {
    const router = useRouter();
    const [roomCode, setRoomCode] = useState("");
    const [generatedRoomId, setGeneratedRoomId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [joinError, setJoinError] = useState("");

    async function handleCreateRoom() {
        const id = generateRoomId();
        try {
            const res = await fetch(`${SIGNALING_URL}/api/rooms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomId: id }),
            });
            if (res.ok) {
                setGeneratedRoomId(id);
            }
        } catch {
            setGeneratedRoomId(id);
        }
    }

    function handleStartBooth() {
        if (generatedRoomId) {
            router.push(`/booth/${generatedRoomId}`);
        }
    }

    async function handleCopyLink() {
        if (!generatedRoomId) return;
        const url = getRoomUrl(generatedRoomId);
        const success = await copyToClipboard(url);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    async function handleJoinRoom() {
        const code = roomCode.trim().toUpperCase();
        if (code.length < 4) {
            setJoinError("Enter a valid room code");
            return;
        }
        setJoinError("");

        try {
            const res = await fetch(`${SIGNALING_URL}/api/rooms/${code}`);
            const data = await res.json();

            if (!data.exists) {
                setJoinError("Room not found! Check the code and try again.");
                return;
            }
            if (data.isFull) {
                setJoinError("Room is full (2/2). Only 2 people allowed per room.");
                return;
            }

            router.push(`/booth/${code}`);
        } catch {
            // If API check fails, try joining anyway
            router.push(`/booth/${code}`);
        }
    }

    return (
        <div className="gradient-hero min-h-screen">
            {/* Nav */}
            <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-5">
                <Link href="/" className="flex items-center gap-2">
                    <Heart size={24} className="text-pink-primary" fill="currentColor" />
                    <span className="text-lg font-bold font-[family-name:var(--font-outfit)] gradient-text">
                        LoveLens
                    </span>
                </Link>
                <ThemeToggle />
            </nav>

            <div className="max-w-xl mx-auto px-6 pt-10 md:pt-20 pb-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-12"
                >
                    <Camera size={40} className="text-pink-primary mx-auto mb-3" />
                    <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-outfit)] mb-2">
                        Your Photobooth
                    </h1>
                    <p className="text-gray-400">
                        Create a new booth or join your partner&apos;s
                    </p>
                </motion.div>

                {/* Create Room */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="glass-card p-6 md:p-8 mb-6"
                >
                    <h2 className="text-lg font-semibold font-[family-name:var(--font-outfit)] mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-pink flex items-center justify-center">
                            <Camera size={16} className="text-white" />
                        </div>
                        Create a New Booth
                    </h2>

                    {!generatedRoomId ? (
                        <button onClick={handleCreateRoom} className="btn-primary w-full">
                            Create Booth Room 💕
                        </button>
                    ) : (
                        <div className="space-y-4">
                            {/* Room code display */}
                            <div className="bg-black/30 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 mb-1">Your Room Code</p>
                                <p className="text-3xl font-bold font-[family-name:var(--font-outfit)] tracking-widest gradient-text">
                                    {generatedRoomId}
                                </p>
                            </div>

                            {/* Copy link */}
                            <button
                                onClick={handleCopyLink}
                                className="btn-secondary w-full flex items-center justify-center gap-2"
                            >
                                {copied ? (
                                    <>
                                        <Check size={16} className="text-mint" />
                                        Link Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} />
                                        Copy Invite Link
                                    </>
                                )}
                            </button>

                            {/* Enter booth */}
                            <button
                                onClick={handleStartBooth}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                Enter Booth
                                <ArrowRight size={16} />
                            </button>

                            <p className="text-xs text-gray-500 text-center">
                                Share the link or code with your partner to join 💌
                            </p>
                        </div>
                    )}
                </motion.div>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-sm text-gray-500">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Join Room */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="glass-card p-6 md:p-8"
                >
                    <h2 className="text-lg font-semibold font-[family-name:var(--font-outfit)] mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-pink flex items-center justify-center">
                            <Link2 size={16} className="text-white" />
                        </div>
                        Join a Booth
                    </h2>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Enter room code"
                            value={roomCode}
                            onChange={(e) => {
                                setRoomCode(e.target.value.toUpperCase());
                                setJoinError("");
                            }}
                            maxLength={8}
                            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-primary/50 tracking-widest text-center font-bold text-lg font-[family-name:var(--font-outfit)]"
                        />
                        <button
                            onClick={handleJoinRoom}
                            className="btn-primary px-6 flex items-center gap-1"
                        >
                            Join
                            <ArrowRight size={16} />
                        </button>
                    </div>
                    {joinError && (
                        <p className="text-sm text-coral mt-2">{joinError}</p>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
