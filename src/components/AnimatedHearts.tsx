"use client";

import { useEffect, useState, useMemo } from "react";
import { useTheme } from "./ThemeProvider";

interface HeartData {
    id: number;
    left: number;
    top: number;
    size: number;
    delay: number;
    duration: number;
    opacity: number;
    glowDelay: number;
}

export function AnimatedHearts() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const hearts = useMemo<HeartData[]>(() => {
        return Array.from({ length: 18 }, (_, i) => ({
            id: i,
            left: (i * 5.5 + Math.random() * 4) % 100,
            top: Math.random() * 100,
            size: 12 + Math.random() * 22,
            delay: Math.random() * 10,
            duration: 8 + Math.random() * 8,
            opacity: 0.08 + Math.random() * 0.15,
            glowDelay: Math.random() * 5,
        }));
    }, []);

    if (!mounted) return null;

    // Don't show hearts on light theme
    const showHearts = theme === "pink" || theme === "dark";
    if (!showHearts) return null;

    const heartColor =
        theme === "pink"
            ? "rgba(255, 107, 157, VAR_OPACITY)"
            : "rgba(255, 255, 255, VAR_OPACITY)";

    const glowColor =
        theme === "pink"
            ? "rgba(255, 107, 157, 0.4)"
            : "rgba(200, 180, 255, 0.3)";

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
            {hearts.map((h) => {
                const fill = heartColor.replace("VAR_OPACITY", String(h.opacity));
                return (
                    <svg
                        key={h.id}
                        className="absolute heart-float"
                        style={{
                            left: `${h.left}%`,
                            top: `${h.top}%`,
                            width: h.size,
                            height: h.size,
                            animationDelay: `${h.delay}s`,
                            animationDuration: `${h.duration}s`,
                            // @ts-expect-error CSS custom property
                            "--glow-delay": `${h.glowDelay}s`,
                            "--glow-color": glowColor,
                        }}
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                               2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
                               C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
                               c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                            fill={fill}
                            className="heart-glow-path"
                        />
                    </svg>
                );
            })}
        </div>
    );
}
