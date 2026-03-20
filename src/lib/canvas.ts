/**
 * LoveLens — Canvas-based photostrip compositor
 * Renders 4 side-by-side capture pairs into a photobooth strip
 */

import { FILTERS, type FilterId } from "@/stores/booth-store";

interface ComposeOptions {
    captures: { localUrl: string; remoteUrl: string }[];
    filterId: FilterId;
    caption: string;
    showDateStamp: boolean;
    borderStyle: "white" | "pink" | "black" | "polaroid";
    selectedTemplate: "none" | "hearts" | "stars" | "crown";
    localSide: "left" | "right";
}

const BORDER_COLORS: Record<string, string> = {
    white: "#FFFFFF",
    pink: "#FFD6E5",
    black: "#1A1A2E",
    polaroid: "#FAFAF5",
};

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (!src.startsWith("data:")) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

export async function composePhotostrip(
    options: ComposeOptions
): Promise<HTMLCanvasElement> {
    const { captures, filterId, caption, showDateStamp, borderStyle, selectedTemplate, localSide } = options;
    const filter = FILTERS.find((f) => f.id === filterId);

    const STRIP_WIDTH = 1200;
    const FRAME_HEIGHT = 440; // 4:3 ratio for each person (560x440)
    const BORDER = 40;
    const GAP = 16;
    const FOOTER_HEIGHT = 80;

    const totalHeight =
        BORDER * 2 +
        FRAME_HEIGHT * captures.length +
        GAP * (captures.length - 1) +
        FOOTER_HEIGHT;

    const canvas = document.createElement("canvas");
    canvas.width = STRIP_WIDTH;
    canvas.height = totalHeight;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = BORDER_COLORS[borderStyle] || "#FFFFFF";
    ctx.fillRect(0, 0, STRIP_WIDTH, totalHeight);

    // Optional: subtle pattern for polaroid
    if (borderStyle === "polaroid") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
        for (let y = 0; y < totalHeight; y += 4) {
            ctx.fillRect(0, y, STRIP_WIDTH, 1);
        }
    }

    // Apply filter to canvas context
    if (filter && filter.cssFilter !== "none") {
        ctx.filter = filter.cssFilter;
    }

    // Draw each frame pair
    for (let i = 0; i < captures.length; i++) {
        const yOffset = BORDER + i * (FRAME_HEIGHT + GAP);
        const innerWidth = STRIP_WIDTH - BORDER * 2;

        try {
            const localImg = await loadImage(captures[i].localUrl);
            const remoteImg = captures[i].remoteUrl ? await loadImage(captures[i].remoteUrl) : null;

            const halfWidth = innerWidth / 2;

            // Draw ONE combined rounded frame background to clip both images
            ctx.save();
            roundedRect(ctx, BORDER, yOffset, innerWidth, FRAME_HEIGHT, 16);
            ctx.clip();

            const leftImg = localSide === "left" ? localImg : remoteImg;
            const rightImg = localSide === "left" ? remoteImg : localImg;

            // Draw left image
            if (leftImg) {
                drawImageCenter(ctx, leftImg, BORDER, yOffset, halfWidth, FRAME_HEIGHT);
            } else {
                // If remote is missing but should be on left, use local as fallback
                drawImageCenter(ctx, localImg, BORDER, yOffset, halfWidth, FRAME_HEIGHT);
            }

            // Draw right image
            if (rightImg) {
                drawImageCenter(ctx, rightImg, BORDER + halfWidth, yOffset, halfWidth, FRAME_HEIGHT);
            } else {
                // If remote is missing but should be on right, use local as fallback
                drawImageCenter(ctx, localImg, BORDER + halfWidth, yOffset, halfWidth, FRAME_HEIGHT);
            }

            // Draw sticker template if selected
            if (selectedTemplate !== "none") {
                const drawSticker = (emoji: string) => {
                    ctx.font = "80px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    // Draw on local side (top middle)
                    ctx.fillText(emoji, BORDER + halfWidth / 2, yOffset + 80);
                    // Draw on remote side (top middle)
                    ctx.fillText(emoji, BORDER + halfWidth + halfWidth / 2, yOffset + 80);
                }

                if (selectedTemplate === "hearts") drawSticker("💖");
                if (selectedTemplate === "stars") drawSticker("✨");
                if (selectedTemplate === "crown") drawSticker("👑");
            }

            // subtle separator line in the middle
            if (borderStyle !== "black") {
                ctx.fillStyle = "rgba(0,0,0,0.1)";
                ctx.fillRect(BORDER + halfWidth, yOffset, 1, FRAME_HEIGHT);
            }

            ctx.restore();
        } catch {
            // If image fails, draw placeholder
            ctx.fillStyle = "rgba(255, 107, 157, 0.1)";
            ctx.fillRect(BORDER, yOffset, STRIP_WIDTH - BORDER * 2, FRAME_HEIGHT);
        }
    }

    // Reset filter for text
    ctx.filter = "none";

    // Footer
    const footerY = totalHeight - FOOTER_HEIGHT;

    // LoveLens branding
    ctx.fillStyle = borderStyle === "black" ? "#888" : "#999";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("♥ LoveLens", STRIP_WIDTH / 2, footerY + 20);

    // Caption
    if (caption) {
        ctx.fillStyle = borderStyle === "black" ? "#DDD" : "#555";
        ctx.font = "bold 18px 'Outfit', sans-serif";
        ctx.fillText(caption, STRIP_WIDTH / 2, footerY + 44);
    }

    // Date stamp
    if (showDateStamp) {
        ctx.fillStyle = borderStyle === "black" ? "#666" : "#AAA";
        ctx.font = "12px 'Courier New', monospace";
        ctx.fillText(
            new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
            STRIP_WIDTH / 2,
            footerY + 62
        );
    }

    return canvas;
}

function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawImageCenter(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;

    if (imgRatio > targetRatio) {
        // Image is wider than target area (crop left/right)
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
    } else {
        // Image is taller than target area (crop top/bottom)
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string = "image/png",
    quality: number = 0.92
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Failed to create blob"));
            },
            type,
            quality
        );
    });
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function sharePhotostrip(blob: Blob, format: string) {
    const file = new File([blob], `lovelens-strip.${format}`, {
        type: format === "pdf" ? "application/pdf" : `image/${format}`,
    });

    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({
                title: "Our LoveLens Moment 💕",
                text: "We took this at our virtual photobooth! #LoveLens",
                files: [file],
            });
            return true;
        } catch {
            // User cancelled or error
        }
    }

    return false;
}
