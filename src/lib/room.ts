/**
 * LoveLens — Room ID generator
 * Generates short, readable room codes
 */

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous: I, O, 0, 1

export function generateRoomId(length: number = 6): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return result;
}

export function getRoomUrl(roomId: string): string {
    if (typeof window !== "undefined") {
        return `${window.location.origin}/booth/${roomId}`;
    }
    return `/booth/${roomId}`;
}

export function copyToClipboard(text: string): Promise<boolean> {
    return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => false);
}
