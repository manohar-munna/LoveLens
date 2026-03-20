/**
 * LoveLens — Camera utility functions
 * Handles getUserMedia, frame capture, and stream management
 */

export interface CameraConfig {
    width?: number;
    height?: number;
    facingMode?: "user" | "environment";
    frameRate?: number;
}

const DEFAULT_CONFIG: CameraConfig = {
    width: 1280,
    height: 720,
    facingMode: "user",
    frameRate: 30,
};

export async function initCamera(
    config: CameraConfig = {}
): Promise<MediaStream> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: mergedConfig.width },
                height: { ideal: mergedConfig.height },
                facingMode: mergedConfig.facingMode,
                frameRate: { ideal: mergedConfig.frameRate },
            },
            audio: false,
        });
        return stream;
    } catch (error) {
        if (error instanceof DOMException) {
            switch (error.name) {
                case "NotAllowedError":
                    throw new Error(
                        "Camera permission denied. Please allow camera access to use the booth."
                    );
                case "NotFoundError":
                    throw new Error(
                        "No camera found. Please connect a camera and try again."
                    );
                case "NotReadableError":
                    throw new Error(
                        "Camera is already in use by another application."
                    );
                default:
                    throw new Error(`Camera error: ${error.message}`);
            }
        }
        throw error;
    }
}

export function stopStream(stream: MediaStream | null) {
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
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
