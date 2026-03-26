/**
 * LoveLens — Canvas-based photostrip compositor
 * Renders 4 side-by-side capture pairs into a photobooth strip
 */

import { FILTERS, type FilterId, type FontId } from "@/stores/booth-store";

interface ComposeOptions {
    captures: { localUrl: string; remoteUrl: string }[];
    filterId: FilterId;
    caption: string;
    showDateStamp: boolean;
    textSize?: number;
    fontFamily?: FontId;
    borderStyle: "white" | "pink" | "black" | "polaroid";
    selectedTemplate: "none" | "hearts" | "stars" | "crown" | "heart-formation";
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

    const isHeartFormation = selectedTemplate === "heart-formation";
    const heartLayout = captures.length === 2 ? "4-frame" : captures.length === 5 ? "9-frame" : null;

    let STRIP_WIDTH = 1200;
    let FRAME_HEIGHT = 440; // 4:3 ratio for each person (560x440)
    let BORDER = 40;
    let GAP = isHeartFormation ? 0 : 16;
    let FOOTER_HEIGHT = 80;
    let totalHeight = 0;

    if (isHeartFormation && heartLayout === "4-frame") {
        // 2x2 grid. Total width = 1200. Inner width = 1200 - 80 = 1120.
        // Each cell = 560x560 (1:1 ratio)
        STRIP_WIDTH = 1200;
        FRAME_HEIGHT = 560; // So two rows = 1120 height
        totalHeight = BORDER * 2 + FRAME_HEIGHT * 2 + FOOTER_HEIGHT;
    } else if (isHeartFormation && heartLayout === "9-frame") {
        // 3x3 grid. Inner width = 1200 - 80 = 1120.
        // Each cell = 1120 / 3 = 373.33
        STRIP_WIDTH = 1200;
        FRAME_HEIGHT = Math.round(1120 / 3);
        totalHeight = BORDER * 2 + FRAME_HEIGHT * 3 + FOOTER_HEIGHT;
    } else {
        totalHeight =
            BORDER * 2 +
            FRAME_HEIGHT * captures.length +
            GAP * (captures.length - 1) +
            FOOTER_HEIGHT;
    }

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

    if (isHeartFormation && heartLayout === "4-frame") {
        const innerWidth = STRIP_WIDTH - BORDER * 2;
        const cellW = innerWidth / 2;
        const cellH = FRAME_HEIGHT;

        // Snap 1: Top Left (left user), Top Right (right user)
        // Snap 2: Bottom Left (left user), Bottom Right (right user)
        for (let i = 0; i < 2; i++) {
            try {
                const localImg = await loadImage(captures[i].localUrl);
                const remoteImg = captures[i].remoteUrl ? await loadImage(captures[i].remoteUrl) : localImg;

                const leftImg = localSide === "left" ? localImg : remoteImg;
                const rightImg = localSide === "left" ? remoteImg : localImg;

                const yOffset = BORDER + i * cellH;

                ctx.save();
                ctx.beginPath();
                ctx.rect(BORDER, yOffset, cellW, cellH);
                ctx.clip();
                drawImageCenter(ctx, leftImg, BORDER, yOffset, cellW, cellH);
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.rect(BORDER + cellW, yOffset, cellW, cellH);
                ctx.clip();
                drawImageCenter(ctx, rightImg, BORDER + cellW, yOffset, cellW, cellH);
                ctx.restore();
            } catch (e) {
                console.error("Failed to load 4-frame heart layout image:", e);
            }
        }
    } else if (isHeartFormation && heartLayout === "9-frame") {
        const cellW = Math.round((STRIP_WIDTH - BORDER * 2) / 3);
        const cellH = FRAME_HEIGHT;

        // Positions:
        // Row 0: x0, x1, x2 (indices 0, 1, 2)
        // Row 1: x0, x1, x2 (indices 3, 4, 5)
        // Row 2: x0, x1, x2 (indices 6, 7, 8)

        // Snap mapping:
        // Snap 1: Pos 1 (index 0) & Pos 3 (index 2)
        // Snap 2: Pos 4 (index 3) & Pos 5 (index 5)
        // Snap 3: Pos 6 (index 6) & Pos 8 (index 8)
        // Snap 4: Pos 2 (index 1) & Pos 7 (index 7)
        // Snap 5: Pos 9 (index 4) -> both users blended/side-by-side

        const drawCell = async (img: HTMLImageElement, col: number, row: number) => {
            const x = BORDER + col * cellW;
            const y = BORDER + row * cellH;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, cellW, cellH);
            ctx.clip();
            drawImageCenter(ctx, img, x, y, cellW, cellH);
            ctx.restore();
        };

        const loadCaptureImages = async (index: number) => {
            const localImg = await loadImage(captures[index].localUrl);
            const remoteImg = captures[index].remoteUrl ? await loadImage(captures[index].remoteUrl) : localImg;
            return {
                leftImg: localSide === "left" ? localImg : remoteImg,
                rightImg: localSide === "left" ? remoteImg : localImg
            };
        };

        try {
            if (captures.length > 0) {
                const { leftImg, rightImg } = await loadCaptureImages(0);
                await drawCell(leftImg, 0, 0); // Pos 1
                await drawCell(rightImg, 2, 0); // Pos 3
            }
            if (captures.length > 1) {
                const { leftImg, rightImg } = await loadCaptureImages(1);
                await drawCell(leftImg, 0, 1); // Pos 4
                await drawCell(rightImg, 2, 1); // Pos 5
            }
            if (captures.length > 2) {
                const { leftImg, rightImg } = await loadCaptureImages(2);
                await drawCell(leftImg, 0, 2); // Pos 6
                await drawCell(rightImg, 2, 2); // Pos 8
            }
            if (captures.length > 3) {
                const { leftImg, rightImg } = await loadCaptureImages(3);
                await drawCell(leftImg, 1, 0); // Pos 2
                await drawCell(rightImg, 1, 2); // Pos 7
            }
            if (captures.length > 4) {
                const { leftImg, rightImg } = await loadCaptureImages(4);
                // Pos 9 (Center Selfie)
                const x = BORDER + 1 * cellW;
                const y = BORDER + 1 * cellH;

                ctx.save();
                ctx.beginPath();
                ctx.rect(x, y, cellW, cellH);
                ctx.clip();

                // Draw left user taking up left half, right user taking up right half of center
                drawImageCenter(ctx, leftImg, x, y, cellW / 2, cellH);
                drawImageCenter(ctx, rightImg, x + cellW / 2, y, cellW / 2, cellH);

                ctx.restore();
            }
        } catch (e) {
             console.error("Failed to load 9-frame heart layout image:", e);
        }

    } else {
        // Normal vertical strip layout
        for (let i = 0; i < captures.length; i++) {
            const yOffset = BORDER + i * (FRAME_HEIGHT + GAP);
            const innerWidth = STRIP_WIDTH - BORDER * 2;

            try {
                const localImg = await loadImage(captures[i].localUrl);
                const remoteImg = captures[i].remoteUrl ? await loadImage(captures[i].remoteUrl) : null;

                const halfWidth = innerWidth / 2;

                // Draw ONE combined frame background to clip both images
                ctx.save();
                roundedRect(ctx, BORDER, yOffset, innerWidth, FRAME_HEIGHT, 16);
                ctx.clip();

                const leftImg = localSide === "left" ? localImg : remoteImg;
                const rightImg = localSide === "left" ? remoteImg : localImg;

                // Draw left image
                if (leftImg) {
                    drawImageCenter(ctx, leftImg, BORDER, yOffset, halfWidth, FRAME_HEIGHT);
                } else {
                    drawImageCenter(ctx, localImg, BORDER, yOffset, halfWidth, FRAME_HEIGHT);
                }

                // Draw right image
                if (rightImg) {
                    drawImageCenter(ctx, rightImg, BORDER + halfWidth, yOffset, halfWidth, FRAME_HEIGHT);
                } else {
                    drawImageCenter(ctx, localImg, BORDER + halfWidth, yOffset, halfWidth, FRAME_HEIGHT);
                }

                // Draw sticker template if selected
                if (selectedTemplate !== "none") {
                    const drawSticker = (emoji: string) => {
                        ctx.font = "80px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(emoji, BORDER + halfWidth / 2, yOffset + 80);
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
                ctx.fillStyle = "rgba(255, 107, 157, 0.1)";
                ctx.fillRect(BORDER, yOffset, STRIP_WIDTH - BORDER * 2, FRAME_HEIGHT);
            }
        }
    }

    // Reset filter for text
    ctx.filter = "none";

    // Footer
    const footerY = totalHeight - FOOTER_HEIGHT;

    const sizeMultiplier = options.textSize || 1;
    const fontFamilyStr = options.fontFamily ? getFontFamilyString(options.fontFamily) : "'Outfit', sans-serif";

    // LoveLens branding
    ctx.fillStyle = borderStyle === "black" ? "#888" : "#999";
    ctx.font = `${Math.round(14 * sizeMultiplier)}px ${fontFamilyStr}`;
    ctx.textAlign = "center";
    ctx.fillText("♥ LoveLens", STRIP_WIDTH / 2, footerY + 20);

    // Caption
    if (caption) {
        ctx.fillStyle = borderStyle === "black" ? "#DDD" : "#555";
        ctx.font = `bold ${Math.round(18 * sizeMultiplier)}px ${fontFamilyStr}`;
        ctx.fillText(caption, STRIP_WIDTH / 2, footerY + 44);
    }

    // Date stamp
    if (showDateStamp) {
        ctx.fillStyle = borderStyle === "black" ? "#666" : "#AAA";
        ctx.font = `${Math.round(12 * sizeMultiplier)}px ${fontFamilyStr}`;
        ctx.fillText(
            new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
            STRIP_WIDTH / 2,
            footerY + 62 + (sizeMultiplier > 1 && caption ? (sizeMultiplier - 1) * 10 : 0)
        );
    }

    return canvas;
}

function getFontFamilyString(fontId: string): string {
    switch (fontId) {
        case "dancing": return "'Dancing Script', cursive";
        case "pacifico": return "'Pacifico', cursive";
        case "caveat": return "'Caveat', cursive";
        case "vt323": return "'VT323', monospace";
        case "outfit":
        default: return "'Outfit', sans-serif";
    }
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
