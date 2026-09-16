/**
 * LoveLens — Camera utility functions
 * Handles getUserMedia, frame capture, mobile camera switching, and stream management
 */

export interface CameraConfig {
    width?: number;
    height?: number;
    facingMode?: "user" | "environment";
    frameRate?: number;
}

export type CameraErrorType = "permission_denied" | "not_found" | "in_use" | "error";

export interface CameraException {
    type: CameraErrorType;
    message: string;
}

export function parseCameraError(error: unknown): CameraException {
    if (error instanceof DOMException) {
        switch (error.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
                return {
                    type: "permission_denied",
                    message: "Camera permission denied. Please allow camera access in your browser settings.",
                };
            case "NotFoundError":
            case "DevicesNotFoundError":
                return {
                    type: "not_found",
                    message: "No camera found. Please connect or enable a camera.",
                };
            case "NotReadableError":
            case "TrackStartError":
                return {
                    type: "in_use",
                    message: "Camera is already in use by another application or tab.",
                };
            default:
                return {
                    type: "error",
                    message: `Camera error: ${error.message}`,
                };
        }
    }
    return {
        type: "error",
        message: error instanceof Error ? error.message : "Failed to access camera",
    };
}

export function isMobileDevice(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    return isMobileUA || isIPadOS || (hasTouch && window.innerWidth <= 1024);
}

export async function getAvailableCameras(): Promise<{
    hasMultiple: boolean;
    devices: MediaDeviceInfo[];
    isMobile: boolean;
}> {
    const isMobile = isMobileDevice();
    try {
        if (!navigator.mediaDevices?.enumerateDevices) {
            return { hasMultiple: isMobile, devices: [], isMobile };
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        return {
            hasMultiple: videoInputs.length > 1 || isMobile,
            devices: videoInputs,
            isMobile,
        };
    } catch {
        return { hasMultiple: isMobile, devices: [], isMobile };
    }
}

export async function initCamera(
    config: CameraConfig = {}
): Promise<MediaStream> {
    const isPortrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
    const defaultWidth = isPortrait ? 720 : 1280;
    const defaultHeight = isPortrait ? 1280 : 720;

    const mergedConfig = {
        width: defaultWidth,
        height: defaultHeight,
        facingMode: "user" as const,
        frameRate: 30,
        ...config,
    };

    const videoConstraints: MediaTrackConstraints = {
        width: { ideal: mergedConfig.width },
        height: { ideal: mergedConfig.height },
        frameRate: { ideal: mergedConfig.frameRate },
    };

    if (mergedConfig.facingMode) {
        videoConstraints.facingMode = { ideal: mergedConfig.facingMode };
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
        });
        return stream;
    } catch (error) {
        // Fallback with loose constraints if ideal constraints failed on specific mobile devices
        if (error instanceof DOMException && error.name !== "NotAllowedError") {
            try {
                return await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
            } catch {
                // fall through
            }
        }
        const parsed = parseCameraError(error);
        throw new Error(parsed.message);
    }
}

export function stopStream(stream: MediaStream | null) {
    if (stream) {
        stream.getTracks().forEach((track) => {
            try {
                track.stop();
            } catch (err) {
                console.warn("Failed to stop track:", err);
            }
        });
    }
}

/**
 * Capture a single frame from a video element as a data URL
 */
export function captureFrame(
    videoElement: HTMLVideoElement,
    filter?: string,
    mirrored: boolean = true,
    zoom: number = 1
): { blob: Promise<Blob>; url: string } {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext("2d")!;

    // Apply css filter if provided
    if (filter && filter !== "none") {
        ctx.filter = filter;
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(mirrored ? -zoom : zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const url = canvas.toDataURL("image/jpeg", 0.92);
    const blob = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to capture frame"));
            },
            "image/jpeg",
            0.92
        );
    });

    return { blob, url };
}

/**
 * Check if camera is available
 */
export async function isCameraAvailable(): Promise<boolean> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some((device) => device.kind === "videoinput");
    } catch {
        return false;
    }
}
