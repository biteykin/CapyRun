"use client";

import Link from "next/link";
import Image from "next/image";
import logo from "@/app/icon-512.png";

export default function PublicTopbar() {
  return (
    <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src={logo}
          alt="CapyRun"
          width={36}
          height={36}
          priority
          className="h-9 w-9 rounded-xl object-contain"
        />
        <span>
          <span className="h-display block text-base font-black leading-none">CapyRun</span>
          <span className="hidden text-xs text-[#595958] sm:block">AI running coach</span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {/* Светлая (ghost) как на лендинге */}
        <Link href="/login?mode=login" className="btn btn-ghost">
          Войти
        </Link>
        {/* Жёлтая primary как на лендинге */}
        <Link href="/login?mode=signup" className="btn btn-primary">
          Попробовать бесплатно
        </Link>
      </div>
    </div>
  );
}
