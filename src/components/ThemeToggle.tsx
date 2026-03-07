"use client";

import { useTheme, type Theme } from "./ThemeProvider";
import { Sun, Moon, Heart } from "lucide-react";

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "pink", label: "Pink", icon: Heart },
    { id: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="theme-toggle-group">
            {THEMES.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className={`theme-toggle-btn ${theme === id ? "active" : ""}`}
                    title={label}
                    aria-label={`Switch to ${label} theme`}
                >
                    <Icon size={14} fill={id === "pink" && theme === "pink" ? "currentColor" : "none"} />
                </button>
            ))}
        </div>
    );
}
