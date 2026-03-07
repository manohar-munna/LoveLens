"use client";

import { motion } from "framer-motion";
import {
  Heart,
  Camera,
  Share2,
  Sparkles,
  Users,
  Download,
  ArrowRight,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";


// Animated counter
function AnimatedCounter({ target, label }: { target: number; label: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold gradient-text font-[family-name:var(--font-outfit)]">
        {count.toLocaleString()}+
      </div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

// Feature card
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: typeof Heart;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      className="glass-card p-6 md:p-8 group hover:border-pink-primary/30 transition-all duration-300"
    >
      <div className="w-12 h-12 rounded-xl gradient-pink flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon size={22} className="text-white" />
      </div>
      <h3 className="text-lg font-semibold font-[family-name:var(--font-outfit)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// Step card in "How it works"
function StepCard({
  number,
  title,
  description,
  delay,
}: {
  number: number;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      className="flex items-start gap-4"
    >
      <div className="w-10 h-10 rounded-full gradient-pink flex items-center justify-center text-white font-bold text-sm shrink-0 mt-1">
        {number}
      </div>
      <div>
        <h4 className="font-semibold font-[family-name:var(--font-outfit)] text-base mb-1">
          {title}
        </h4>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// Filter preview
function FilterPreview({ name, filter }: { name: string; filter: string }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div
        className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border-2 border-white/10 hover:border-pink-primary/50 transition-all duration-300 cursor-pointer hover:scale-105"
        style={{ filter }}
      >
        <div className="w-full h-full bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 flex items-center justify-center">
          <Camera size={24} className="text-white/80" />
        </div>
      </div>
      <span className="text-xs text-gray-400">{name}</span>
    </div>
  );
}

export default function LandingPage() {
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString());
  }, []);

  const filters = [
    { name: "Vintage", filter: "sepia(0.4) contrast(1.1) saturate(0.8)" },
    {
      name: "Polaroid",
      filter: "contrast(1.1) brightness(1.05) saturate(1.1)",
    },
    { name: "B&W Film", filter: "grayscale(1) contrast(1.2)" },
    {
      name: "Romantic",
      filter: "brightness(1.08) contrast(0.95) saturate(1.3)",
    },
    {
      name: "VHS",
      filter: "saturate(0.7) contrast(1.2) brightness(0.95)",
    },
    {
      name: "Dreamy",
      filter: "brightness(1.1) saturate(0.6) hue-rotate(10deg)",
    },
    {
      name: "Disposable",
      filter: "contrast(1.15) saturate(0.85) brightness(1.05)",
    },
    {
      name: "Old Digital",
      filter: "saturate(0.6) contrast(0.9) brightness(1.1)",
    },
  ];

  return (
    <div className="gradient-hero min-h-screen">

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 md:px-12 py-5">
        <div className="flex items-center gap-2">
          <Heart
            size={26}
            className="text-pink-primary"
            fill="currentColor"
          />
          <span className="text-xl font-bold font-[family-name:var(--font-outfit)] gradient-text">
            LoveLens
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/booth"
            className="btn-secondary text-sm hidden md:block"
          >
            Open Booth
          </Link>
          <Link href="/booth" className="btn-primary text-sm">
            Start Free →
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 md:px-12 pt-16 md:pt-24 pb-20 text-center max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-gray-300 mb-6">
            <Sparkles size={14} className="text-pink-primary" />
            <span>Your virtual photobooth for couples</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-[family-name:var(--font-outfit)] leading-tight mb-6">
            Capturing Love
            <br />
            <span className="gradient-text">Beyond Distance</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Take cute photobooth memories together even when you&apos;re far
            apart. Real-time filters, synchronized captures, and adorable
            photostrips — all from your browser.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/booth" className="btn-primary text-lg px-10 py-4 pulse-glow flex items-center gap-2">
              Start Your Booth
              <Heart size={18} fill="currentColor" />
            </Link>
            <a
              href="#how-it-works"
              className="btn-secondary flex items-center gap-2"
            >
              See How It Works
              <ArrowRight size={16} />
            </a>
          </div>
        </motion.div>

        {/* Animated photostrip preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 max-w-md mx-auto"
        >
          <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
            <div className="bg-white rounded-xl p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex gap-2"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  <div className="w-1/2 aspect-[4/3] rounded-lg bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
                    <span className="text-2xl">
                      {["🥰", "😍", "🤪", "💕"][i - 1]}
                    </span>
                  </div>
                  <div className="w-1/2 aspect-[4/3] rounded-lg bg-gradient-to-br from-blue-200 via-purple-200 to-indigo-300 flex items-center justify-center">
                    <span className="text-2xl">
                      {["😘", "🥰", "😜", "💗"][i - 1]}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-gray-400 pt-1 font-medium">
                LoveLens {dateStr ? `• ${dateStr}` : ""}
              </p>
            </div>
            <div className="absolute inset-0 shimmer rounded-2xl pointer-events-none" />
          </div>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 grid grid-cols-3 gap-8 max-w-lg mx-auto"
        >
          <AnimatedCounter target={12487} label="Strips Created" />
          <AnimatedCounter target={4230} label="Happy Couples" />
          <AnimatedCounter target={890} label="Countries" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-outfit)] mb-3">
            Everything You Need for
            <span className="gradient-text"> Cute Memories</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Built with love for couples who are apart but never far from each
            other&apos;s hearts.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={Camera}
            title="Synchronized Capture"
            description="Both cameras click at the exact same moment — as if you're in the same booth together."
            delay={0}
          />
          <FeatureCard
            icon={Sparkles}
            title="8 Beautiful Filters"
            description="Vintage film, Polaroid, VHS, dreamy pastels — choose the vibe that matches your moment."
            delay={0.1}
          />
          <FeatureCard
            icon={Users}
            title="Real-Time Preview"
            description="See each other's feeds live with filters applied. Pick the perfect look before you snap."
            delay={0.2}
          />
          <FeatureCard
            icon={Download}
            title="Instant Download"
            description="Get your photostrip as JPG, PNG, or a printable PDF — ready in seconds."
            delay={0.3}
          />
          <FeatureCard
            icon={Share2}
            title="One-Tap Sharing"
            description="Share directly to Instagram, WhatsApp, or Twitter. Show the world your love."
            delay={0.4}
          />
          <FeatureCard
            icon={Star}
            title="Memory Album"
            description="All your strips saved in one beautiful timeline. Watch your love story grow."
            delay={0.5}
          />
        </div>
      </section>

      {/* Filter Carousel */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-outfit)] mb-3">
            Choose Your <span className="gradient-text">Vibe</span>
          </h2>
          <p className="text-gray-400">
            8 stunning filters inspired by classic cameras
          </p>
        </motion.div>

        <div className="flex gap-5 overflow-x-auto pb-4 justify-center flex-wrap">
          {filters.map((f) => (
            <FilterPreview key={f.name} name={f.name} filter={f.filter} />
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 px-6 md:px-12 py-20 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-outfit)] mb-3">
            How <span className="gradient-text">LoveLens</span> Works
          </h2>
          <p className="text-gray-400">Simple, sweet, and just 4 steps</p>
        </motion.div>

        <div className="space-y-8">
          <StepCard
            number={1}
            title="Create Your Booth"
            description="Sign in with Google and get a unique booth link in one click. No downloads, no installs."
            delay={0}
          />
          <StepCard
            number={2}
            title="Invite Your Partner"
            description="Share the booth link with your partner. They click it, and boom — you're connected live."
            delay={0.1}
          />
          <StepCard
            number={3}
            title="Strike a Pose"
            description="Pick a filter, hit the shutter button, and take 4 synchronized photos together. 📸"
            delay={0.2}
          />
          <StepCard
            number={4}
            title="Save & Share Your Strip"
            description="Your photos become a beautiful photostrip. Download it, share it, or add it to your memory album."
            delay={0.3}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 md:px-12 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto glass-card p-10 md:p-14"
        >
          <Heart
            size={40}
            className="text-pink-primary mx-auto mb-4"
            fill="currentColor"
          />
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-outfit)] mb-3">
            Your Next Memory Awaits
          </h2>
          <p className="text-gray-400 mb-8">
            It&apos;s free, it&apos;s instant, and it&apos;s made for you two.
          </p>
          <Link href="/booth" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2">
            Start Your Booth
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6 md:px-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Heart
            size={16}
            className="text-pink-primary"
            fill="currentColor"
          />
          <span className="text-sm font-[family-name:var(--font-outfit)] gradient-text font-semibold">
            LoveLens
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Capturing Love Beyond Distance • Made with ♥
        </p>
      </footer>
    </div>
  );
}
