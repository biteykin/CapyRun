import Link from "next/link";
import Image from "next/image";
import logo from "@/app/icon-512.png";
import styles from "./not-found.module.css";

export const metadata = {
  title: "404 · CapyRun",
  description: "Эта страница сошла с маршрута. Возвращаемся на главную.",
};

export default function NotFound() {
  return (
    <main className={styles.wrap}>
      {/* Декоративные блики, как на лендинге */}
      <div className={styles.orb1} aria-hidden="true" />
      <div className={styles.orb2} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.logoWrap}>
          <Image
            src={logo}
            alt="CapyRun"
            width={140}
            height={140}
            priority
            className={styles.logo}
          />
        </div>

        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          404 · ошибка маршрута
        </div>

        <h1 className={`h-display ${styles.title}`}>
          Сошли <em>с&nbsp;маршрута</em>
        </h1>

        <p className={styles.subtitle}>
          Эта страница ушла на восстановительную и не&nbsp;вернулась.
          Бывает! Возвращаемся к&nbsp;плану — впереди ещё много километров.
        </p>

        {/* Ироничная "статистика забега" */}
        <div className={styles.statsCard} aria-hidden="true">
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Дистанция</span>
            <span className={styles.statDots} />
            <span className={styles.statValue}>0 км</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Темп</span>
            <span className={styles.statDots} />
            <span className={styles.statValue}>—:—— /км</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Финиш</span>
            <span className={styles.statDots} />
            <span className={`${styles.statValue} ${styles.statDnf}`}>
              DNF · сход с дистанции
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/" className="btn btn-primary">
            На главную
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
              style={{ marginLeft: 6 }}
            >
              <path d="M5 12h14m-6-7l7 7-7 7" />
            </svg>
          </Link>
          <Link href="/login?mode=signup" className="btn btn-ghost">
            Попробовать AI-тренера
          </Link>
        </div>
      </div>
    </main>
  );
}
