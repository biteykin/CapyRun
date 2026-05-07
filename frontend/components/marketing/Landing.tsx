"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Landing.module.css";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logo from "@/app/icon.png";

const ecosystem = ["Strava", "GARMIN", "POLAR", "COROS", "SUUNTO", "Apple Watch"];

const goals = [
  {
    title: "Первые 5 км",
    text: "Мягкий вход в бег без перегруза. С ходьбой, лёгкими пробежками и понятным прогрессом.",
    meta: "8 недель · новичок",
    featured: true,
  },
  {
    title: "Первые 10 км",
    text: "Если 5 км уже получаются, тренер поможет увеличить дистанцию спокойно и безопасно.",
    meta: "10 недель · любитель",
  },
  {
    title: "Бегать регулярно",
    text: "Три тренировки в неделю без давления на темп. Сначала строим привычку, потом скорость.",
    meta: "постоянно · любой уровень",
  },
  {
    title: "Вернуться после паузы",
    text: "После перерыва, зимы или травмы — без резкого старта и попытки “догнать всё за неделю”.",
    meta: "6 недель · возвращение",
  },
];

const topics = [
  "Темп",
  "Восстановление",
  "Первый старт",
  "Пульсовые зоны",
  "Питание",
  "Усталость",
  "Мотивация",
  "Техника бега",
];

const conversations = [
  {
    tag: "Восстановление",
    question: "У меня тяжёлые ноги после длительной. Это плохо?",
    answer:
      "Не обязательно. После длинной тренировки усталость нормальна. Смотрим на боль, сон, пульс и общий фон. Если нет резкой боли — завтра лучше лёгкое восстановление, а не темповая.",
  },
  {
    tag: "Первый старт",
    question: "Я нервничаю перед первыми 10 км. Что делать?",
    answer:
      "Это нормально: значит, старт для вас важен. Главная задача — не начать слишком быстро. Первые 2 км бежим спокойнее, чем хочется, а потом смотрим по самочувствию.",
  },
  {
    tag: "Темп",
    question: "Почему лёгкий бег такой медленный?",
    answer:
      "Потому что он и должен быть лёгким. Такие тренировки строят базу, помогают восстанавливаться и делают быстрые тренировки эффективнее.",
  },
  {
    tag: "Мотивация",
    question: "Я не бегал 9 дней. Всё испортил?",
    answer:
      "Нет. За 9 дней форма не исчезает. Не надо “отрабатывать пропущенное”. Просто начните с 25–30 минут лёгкого бега.",
  },
];

/* ---------- Icon set (inline SVG, унифицированы) ---------- */
const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icon = {
  trend: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11.5 7" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7L12.5 17" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M20.8 7.6a5 5 0 0 0-8.8-2.7 5 5 0 0 0-8.8 2.7c0 5.7 8.8 11.4 8.8 11.4s8.8-5.7 8.8-11.4z" />
      <path d="M3 12h4l2-3 3 6 2-4h7" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.7-5.3A8 8 0 1 1 21 12z" />
      <circle cx="9" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="15" cy="12" r="0.9" fill="currentColor" />
    </svg>
  ),
  sprout: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 21v-7" />
      <path d="M12 14c-4 0-6-2-6-6 4 0 6 2 6 6z" />
      <path d="M12 14c4 0 6-2 6-6-4 0-6 2-6 6z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}>
      <path d="M5 12.5l4 4L19 7" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  arrowUp: (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4-.5 2 .5 3 2 3 0-3 1-5 1-8z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12.5l2 2L15 11" />
    </svg>
  ),
  // Capybara — стилизованный SVG, заменяет emoji 🦫
  capy: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="20" rx="11" ry="8" fill="#fff" />
      <ellipse cx="16" cy="13.5" rx="7.5" ry="6.2" fill="#fff" />
      <ellipse cx="9.5" cy="9" rx="2" ry="2.3" fill="#fff" />
      <ellipse cx="22.5" cy="9" rx="2" ry="2.3" fill="#fff" />
      <ellipse cx="9.5" cy="9" rx="0.9" ry="1.1" fill="#B84A22" />
      <ellipse cx="22.5" cy="9" rx="0.9" ry="1.1" fill="#B84A22" />
      <circle cx="13" cy="13" r="1.1" fill="#0E0E0E" />
      <circle cx="19" cy="13" r="1.1" fill="#0E0E0E" />
      <ellipse cx="16" cy="16.2" rx="1.6" ry="1" fill="#0E0E0E" />
      <path
        d="M14.5 17.2c.4.5 1 .8 1.5.8s1.1-.3 1.5-.8"
        stroke="#0E0E0E"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  ),
} as const;

const featureCards: Array<[ReactNode, string, string]> = [
  [
    Icon.trend,
    "Отслеживание прогресса",
    "Фокус на регулярности, форме и устойчивом развитии, а не на случайных рекордах.",
  ],
  [
    Icon.calendar,
    "Недельные сводки",
    "Короткий человеческий вывод по неделе: что получилось, где усталость, что делать дальше.",
  ],
  [Icon.moon, "Восстановление", "Когда лучше отдохнуть, когда можно добавить нагрузку и почему отдых — часть плана."],
  [Icon.target, "Подбор цели", "Первые 5 км, 10 км, регулярность или возвращение после паузы — цель под ваш уровень."],
  [Icon.flag, "Подготовка к старту", "План на гонку, стратегия темпа, неделя перед стартом и спокойная работа с волнением."],
  [Icon.link, "Интеграция со Strava", "Текущий фокус — Strava. Остальные спортивные источники можно подключать дальше."],
  [Icon.heart, "Пульс простым языком", "Зоны, дрейф, восстановление и лёгкий бег без сложной спортивной терминологии."],
  [Icon.chat, "Тренер всегда рядом", "Можно задать вопрос в любое время: без стеснения, без оценки, без “глупых вопросов”."],
  [Icon.sprout, "Мотивация без давления", "Мягкие подсказки вместо чувства вины. План должен жить вместе с вашей реальной жизнью."],
];

const testimonials = [
  {
    quote: "Я наконец понял, как бегать легко. Раньше каждая тренировка превращалась в гонку.",
    name: "Марта · 34",
    meta: "Берлин · бегает 2 года",
  },
  {
    quote: "Ощущение, что у меня появился спокойный тренер в кармане. Очень не хватало такого формата.",
    name: "Том · 41",
    meta: "Манчестер · начал с беты",
  },
  {
    quote: "CapyRun помог мне перестать перегружаться. Колени сказали спасибо уже через пару недель.",
    name: "Леа · 28",
    meta: "Лион · возвращается к бегу",
  },
];

const faqs = [
  {
    question: "CapyRun правда подходит новичкам?",
    answer:
      "Да. Сервис рассчитан на людей, которые хотят начать бегать и не хотят сразу разбираться в сложной спортивной терминологии. Тренер объясняет простыми словами.",
  },
  {
    question: "Это заменяет живого тренера?",
    answer:
      "Для элитного спорта — нет. Для начинающих и любителей CapyRun закрывает главную потребность: понятный план, регулярную обратную связь и ответы на вопросы.",
  },
  {
    question: "Можно использовать со Strava?",
    answer:
      "Да. Интеграция со Strava — текущий ключевой сценарий. Дальше можно добавлять Garmin, Polar, Coros, Suunto и Apple Watch.",
  },
  {
    question: "Что если я ничего не понимаю в беге?",
    answer:
      "Это нормальная стартовая точка. CapyRun помогает выбрать цель, объясняет тренировки и постепенно вводит в базовые понятия.",
  },
  {
    question: "Можно просто общаться с тренером?",
    answer:
      "Да. Можно обсуждать технику, питание, восстановление, мотивацию, страх перед стартом или просто делиться мыслями после тренировки.",
  },
  {
    question: "Мои данные приватны?",
    answer:
      "Мы не продаём тренировочные данные и не строим рекламные профили. Данные нужны для плана, прогресса и персональных рекомендаций.",
  },
];

export default function Landing() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(styles.revealIn);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.landing}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.revealIn}>
              <div className={styles.eyebrow}>
                <span className={styles.pulse} />
                ИИ-тренер для начинающих и любителей
              </div>

              <h1 className={`h-display ${styles.heroTitle}`}>
                Начните бегать <em>без</em> живого тренера
              </h1>

              <p className={styles.heroSub}>
                CapyRun помогает выбрать цель, собрать понятный план, отслеживать прогресс
                и обсуждать любые спортивные вопросы столько, сколько нужно.
              </p>

              <div className={styles.heroCtaRow}>
                <Link href="/login?mode=signup" className="btn btn-primary">
                  Попробовать бесплатно
                  <span className={styles.btnIcon}>{Icon.arrowRight}</span>
                </Link>
                <a href="#how" className="btn btn-ghost">
                  Как это работает
                </a>
              </div>

              <div className={styles.heroProof}>
                <div className={styles.avatarStack}>
                  <span className={`${styles.avi} ${styles.avi1}`} />
                  <span className={`${styles.avi} ${styles.avi2}`} />
                  <span className={`${styles.avi} ${styles.avi3}`} />
                  <span className={`${styles.avi} ${styles.avi4}`} />
                </div>
                <div>
                  <div className={styles.stars}>★ ★ ★ ★ ★</div>
                  <div>
                    Для тех, кто хочет прогрессировать без хаоса и перегруза
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.heroVisual}>
              <div className={`${styles.floatTag} ${styles.ft1}`}>
                <span className={styles.ic}>{Icon.heart}</span>
                Сегодня лучше лёгкая тренировка
              </div>

              <div className={`${styles.device} ${styles.deviceMain}`}>
                <div className={styles.dashHead}>
                  <div className={styles.greeting}>
                    Доброе утро, <strong>Анна</strong>
                  </div>
                  <div className={styles.dayPill}>План · 5 км</div>
                </div>

                <div className={styles.statRow}>
                  <div className={styles.stat}>
                    <div className={styles.lbl}>Неделя</div>
                    <div className={styles.val}>
                      23<small>км</small>
                    </div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.lbl}>Ритм</div>
                    <div className={styles.val}>
                      12<small>дней</small>
                    </div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.lbl}>Темп</div>
                    <div className={styles.val}>
                      6:14<small>/км</small>
                    </div>
                  </div>
                </div>

                <div className={styles.chartBlock}>
                  <div className={styles.chartBlockHead}>
                    <div className={styles.chartTitle}>План на неделю</div>
                    <div className={styles.chartTrend}>↗ +8% объём</div>
                  </div>
                  <div className={styles.bars}>
                    {[35, 12, 58, 12, 42, 80, 12].map((height, index) => (
                      <div
                        key={index}
                        className={`${styles.bar} ${height === 12 ? styles.rest : ""}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div className={styles.barLabels}>
                    {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${styles.device} ${styles.deviceChat}`}>
                <ChatHead small />
                <div className={`${styles.msg} ${styles.msgUser}`}>
                  Бежать сегодня? Ноги тяжёлые.
                </div>
                <div className={`${styles.msg} ${styles.msgAi}`}>
                  Темповую лучше убрать. Сделайте 30 минут легко — усталость после интервалов нормальна.
                </div>
                <div className={styles.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className={`${styles.floatTag} ${styles.ft2}`}>
                <span className={styles.ic}>{Icon.check}</span>
                План 5 км · неделя 3
              </div>
            </div>
          </div>

          <div className={styles.worksWith}>
            <div className={styles.worksLabel}>Встраивается в вашу беговую экосистему</div>
            <div className={styles.logos}>
              {ecosystem.map((item) => (
                <span key={item} className={styles.logoItem}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.atmoBlock} ${styles.goalsBlock}`} id="how" data-reveal>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionEyebrow}>01 — Выберите цель</div>
            <h2 className={`h-display ${styles.sectionTitle}`}>
              Цель, которая <em>подходит</em> вашей жизни
            </h2>
            <p className={styles.sectionSub}>
              Не универсальный план “для всех”, а понятная цель под текущий уровень:
              первые километры, первые 5 км, первые 10 км или стабильный бег без перегруза.
            </p>
          </div>

          <div className={styles.goalsGrid}>
            <div className={styles.goalCards}>
              {goals.map((goal, i) => (
                <div
                  key={goal.title}
                  className={`${styles.goalCard} ${goal.featured ? styles.featured : ""}`}
                >
                  <div className={styles.goalIcon}>
                    {[Icon.target, Icon.flag, Icon.calendar, Icon.sprout][i]}
                  </div>
                  <h4 className="h-display">{goal.title}</h4>
                  <p>{goal.text}</p>
                  <div className={styles.meta}>{goal.meta}</div>
                </div>
              ))}
            </div>

            <div className={styles.roadmap} data-reveal>
              <div className={styles.roadmapHead}>
                <h5 className="h-display">План Анны на 5 км</h5>
                <span>пример</span>
              </div>
              <div className={styles.roadmapLine}>
                {[
                  ["Неделя 1–2", "Ходьба + бег", "3 раза в неделю · по 20 минут", true],
                  ["Неделя 3–4", "Бег без остановки", "Первые 2 км спокойно", true],
                  ["Неделя 5 — сейчас", "Развитие выносливости", "Длинная пробежка до 4 км", false],
                  ["Неделя 8", "Цель: 5 км", "Комфортный темп · без спешки", false],
                ].map(([week, title, desc, done]) => (
                  <div
                    key={String(week)}
                    className={`${styles.roadmapStep} ${done ? styles.done : ""}`}
                  >
                    <div className={styles.week}>{week}</div>
                    <div className={styles.ttl}>{title}</div>
                    <div className={styles.desc}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.planBlock}`} data-reveal>
        <div className={styles.container}>
          <div className={styles.planWrap}>
            <div>
              <div className={styles.sectionEyebrow}>02 — Получите план</div>
              <h2 className={`h-display ${styles.sectionTitle}`}>
                План, который <em>подстраивается</em> под вас
              </h2>
              <p className={styles.sectionSub}>
                Плохой сон, поездка, усталость или хорошее самочувствие — тренер помогает
                не ломать неделю, а спокойно перестроить нагрузку.
              </p>
              <ul className={styles.planFeatures}>
                <li>
                  <span className={styles.check}>{Icon.check}</span>
                  <div>
                    <strong>Тренировки простым языком</strong>
                    <p>“Лёгкие 5 км” вместо набора терминов. А если интересно — тренер объяснит механику.</p>
                  </div>
                </li>
                <li>
                  <span className={styles.check}>{Icon.check}</span>
                  <div>
                    <strong>Восстановление внутри плана</strong>
                    <p>Отдых — не слабость, а часть прогресса. CapyRun объясняет, зачем он нужен.</p>
                  </div>
                </li>
                <li>
                  <span className={styles.check}>{Icon.check}</span>
                  <div>
                    <strong>Реалистичный рост</strong>
                    <p>Нагрузка увеличивается постепенно, чтобы не превратить мотивацию в травму.</p>
                  </div>
                </li>
              </ul>
            </div>

            <Calendar />
          </div>
        </div>
      </section>

      <section className={styles.block} id="coach" data-reveal>
        <div className={styles.container}>
          <div className={styles.coachSection}>
            <div className={styles.coachGrid}>
              <div>
                <div className={styles.sectionEyebrow}>03 — Общайтесь с тренером</div>
                <h2 className={`h-display ${styles.sectionTitle}`}>
                  Говорите о беге <em>сколько угодно</em>
                </h2>
                <p className={styles.sectionSub}>
                  Часто рядом нет человека, которому интересно слушать про интервалы,
                  тяжёлые ноги, пульс, питание и волнение перед стартом. CapyRun — как раз такой собеседник.
                </p>
                <p className={styles.sectionSub}>
                  Можно спросить про темп, усталость, питание, технику, восстановление,
                  мотивацию или просто поделиться мыслями после пробежки.
                </p>
                <div className={styles.topicPills}>
                  {topics.map((topic) => (
                    <span key={topic} className={styles.topicPill}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.chatMockup} data-reveal>
                <ChatHead />
                <div className={styles.msgTime}>Сегодня, 7:42</div>
                <div className={`${styles.msg} ${styles.msgUser}`}>
                  Мне кажется, я стал медленнее. Форма падает?
                </div>
                <div className={`${styles.msg} ${styles.msgAi}`}>
                  Скорее нет. Вы три недели подряд увеличивали объём. Это похоже на накопленную усталость,
                  а не на потерю формы. Хотите, я облегчу завтрашнюю тренировку?
                </div>
                <div className={`${styles.msg} ${styles.msgUser}`}>
                  Да. И я нервничаю перед воскресным стартом.
                </div>
                <div className={`${styles.msg} ${styles.msgAi}`}>
                  Это нормально. Давайте сделаем цель проще: спокойно финишировать и не гнаться за временем.
                  Вечером пришлю стратегию темпа.
                </div>
                <div className={styles.chatInput}>
                  <span>Спросите что угодно про бег...</span>
                  <div className={styles.sendBtn} aria-hidden="true">
                    {Icon.arrowUp}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.atmoBlock} ${styles.testimonialsBlock}`} data-reveal>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionEyebrow}>04 — Отслеживайте прогресс</div>
            <h2 className={`h-display ${styles.sectionTitle}`}>
              Прогресс <em>без одержимости</em> цифрами
            </h2>
            <p className={styles.sectionSub}>
              Для любителя важны регулярность, спокойный рост и ощущение контроля.
              Не нужно жить в графиках, чтобы становиться сильнее.
            </p>
          </div>

          <div className={styles.progressGrid}>
            <div className={styles.progCard}>
              <div className={styles.progCardHead}>
                <h5 className="h-display">Регулярность</h5>
                <span className={styles.progPill}>
                  <span className={styles.progPillIcon}>{Icon.trend}</span> +18%
                </span>
              </div>
              <div className={styles.bigNum}>
                12<small>недель бега</small>
              </div>
              <p>Вы выходили на пробежку минимум два раза в неделю 12 недель подряд — это сильная база.</p>
              <div className={styles.streakGrid}>
                {[1, 2, 1, 3, 2, 1, 3, 4, 2, 3, 3, 4, 3, 4].map((level, index) => (
                  <span key={index} className={`${styles.streakCell} ${styles[`l${level}`]}`} />
                ))}
              </div>
            </div>

            <div className={styles.progCard}>
              <div className={styles.progCardHead}>
                <h5 className="h-display">Лёгкий темп</h5>
                <span className={styles.progPill}>
                  <span className={styles.progPillIcon}>{Icon.flame}</span> −22 сек/км
                </span>
              </div>
              <div className={styles.bigNum}>
                6:14<small>/км</small>
              </div>
              <p>Лёгкий темп становится быстрее при том же усилии. Это и есть рост формы.</p>
              <svg className={styles.sparkline} viewBox="0 0 400 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#DF6133" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#DF6133" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,55 Q40,52 70,48 T140,40 T210,35 T280,25 T350,18 L400,15 L400,80 L0,80 Z"
                  fill="url(#sparkGrad)"
                />
                <path
                  d="M0,55 Q40,52 70,48 T140,40 T210,35 T280,25 T350,18 L400,15"
                  fill="none"
                  stroke="#DF6133"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="400" cy="15" r="4.5" fill="#DF6133" />
                <circle cx="400" cy="15" r="9" fill="#DF6133" opacity="0.2" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.atmoBlock} ${styles.convoBlock}`} data-reveal>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionEyebrow}>Живые вопросы</div>
            <h2 className={`h-display ${styles.sectionTitle}`}>
              Всё, что давно хотелось <em>у кого-то спросить</em>
            </h2>
            <p className={styles.sectionSub}>
              Спокойные ответы без осуждения, без “ты просто слабый” и без спортивного снобизма.
            </p>
          </div>

          <div className={styles.convoList}>
            {conversations.map((item) => (
              <div key={item.question} className={styles.convoCard}>
                <div className={styles.convoTag}>{item.tag}</div>
                <div className={`h-display ${styles.convoQ}`}>&ldquo;{item.question}&rdquo;</div>
                <div className={styles.convoA}>{item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.featuresBlock}`} id="features" data-reveal>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionEyebrow}>Внутри CapyRun</div>
            <h2 className={`h-display ${styles.sectionTitle}`}>Инструменты для спокойного прогресса</h2>
          </div>
          <div className={styles.featuresGrid}>
            {featureCards.map(([icon, title, text]) => (
              <div key={title} className={styles.featCard}>
                <div className={styles.featIcon} aria-hidden="true">
                  {icon}
                </div>
                <h6>{title}</h6>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.privacyBlock}`} data-reveal>
        <div className={styles.container}>
          <div className={styles.privacyBand}>
            <div>
              <div className={styles.sectionEyebrow}>Приватность</div>
              <h2 className={`h-display ${styles.privacyTitle}`}>
                Ваши тренировки остаются <em>вашими</em>
              </h2>
              <p className={styles.sectionSub}>
                Мы не продаём ваши данные и не строим рекламные профили. Разговоры с тренером
                и история тренировок нужны только для плана, прогресса и персональных рекомендаций.
              </p>
              <Link href="/legal/privacy" className={styles.inlineLink}>
                Политика конфиденциальности
              </Link>
            </div>
            <div className={styles.privacyIconWrap} aria-hidden="true">
              {Icon.shield}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.block} data-reveal>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionEyebrow}>Бета-пользователи</div>
            <h2 className={`h-display ${styles.sectionTitle}`}>Обычные люди. Реальный прогресс.</h2>
          </div>
          <div className={styles.testimonials}>
            {testimonials.map((item, index) => (
              <div key={item.name} className={styles.testi}>
                <blockquote className="h-display">&ldquo;{item.quote}&rdquo;</blockquote>
                <div className={styles.testiAuthor}>
                  <span className={`${styles.avi} ${styles[`avi${index + 2}`]}`} />
                  <div>
                    <div className={styles.nm}>{item.name}</div>
                    <div className={styles.ml}>{item.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.faqBlock}`} id="faq" data-reveal>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
              <div className={styles.sectionEyebrow}>FAQ</div>
              <h2 className={`h-display ${styles.sectionTitle}`}>
                Вопросы, <em>спокойно</em> отвеченные
              </h2>
              <p className={styles.sectionSub}>
                Если не нашли ответ — напишите на{" "}
                <a href="mailto:hello@capyrun.com" className={styles.inlineLink}>
                  hello@capyrun.com
                </a>
                , поможем разобраться.
              </p>
          </div>

          <Accordion
            type="single"
            collapsible
            defaultValue="faq-0"
            className="w-full divide-y divide-[rgba(14,14,14,0.08)] border-y border-[rgba(14,14,14,0.08)]"
          >
            {faqs.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`} className="border-b-0">
                <AccordionTrigger className="group py-6 text-left font-display text-[19px] font-medium tracking-[-0.018em] text-[#0E0E0E] hover:no-underline data-[state=open]:text-[#B84A22] sm:text-[21px] [&>svg]:hidden">
                  <span className="flex-1 pr-6">{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF1D4] text-[#DF6133] transition-all duration-300 group-hover:bg-[#FFE7B5] group-data-[state=open]:rotate-45 group-data-[state=open]:bg-[#DF6133] group-data-[state=open]:text-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="max-w-3xl pb-6 pr-12 text-[15.5px] leading-[1.6] text-[#595958]">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className={`${styles.block} ${styles.finalBlock}`} id="cta" data-reveal>
        <div className={styles.container}>
          <div className={styles.finalCta}>
            <h2 className="h-display">
              Бегайте умнее. <em>Спокойнее.</em>
            </h2>
            <p>
              Начните с понятной цели, получите план и обсуждайте прогресс с ИИ-тренером.
            </p>
            <div className={styles.finalCtaBtns}>
              <Link href="/login?mode=signup" className="btn btn-primary">
                Попробовать бесплатно
                <span className={styles.btnIcon}>{Icon.arrowRight}</span>
              </Link>
              <Link href="/login?mode=login" className="btn btn-ghost">
                У меня есть аккаунт
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerAbout}>
              <div className={styles.footerLogo}>
                <Image
                  src={logo}
                  alt="CapyRun"
                  width={32}
                  height={32}
                  priority
                  className={styles.logoMark}
                />
                <span className="h-display">CapyRun</span>
              </div>
              <p>
                Дружелюбный ИИ-тренер для любителей, которые хотят прогрессировать без хаоса.
              </p>
            </div>
            <div>
              <h6>Продукт</h6>
              <ul>
                <li><a href="#coach">ИИ-тренер</a></li>
                <li><a href="#how">Планы</a></li>
                <li><a href="#features">Возможности</a></li>
                <li><Link href="/pricing">Прайс</Link></li>
              </ul>
            </div>
            <div>
              <h6>Ресурсы</h6>
              <ul>
                <li><a href="#">Блог</a></li>
                <li><a href="#">Гайд новичка</a></li>
                <li><a href="#">Помощь</a></li>
                <li><a href="#">Что нового</a></li>
              </ul>
            </div>
            <div>
              <h6>Компания</h6>
              <ul>
                <li><a href="#">О нас</a></li>
                <li><Link href="/legal/privacy">Политика</Link></li>
                <li><a href="#">Условия</a></li>
                <li><a href="mailto:hello@capyrun.com">Контакты</a></li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <div>© 2026 CapyRun · Сделано с заботой о бегунах</div>
            <div className={styles.socialLinks}>
              <a href="#">Twitter</a>
              <a href="#">Instagram</a>
              <a href="#">Strava</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatHead({ small = false }: { small?: boolean }) {
  return (
    <div className={styles.chatHead}>
      <div className={styles.capyAvatar} aria-hidden="true">
        {Icon.capy}
      </div>
      <div className={styles.chatHeadText}>
        <div className={styles.name}>{small ? "Capy · тренер" : "Capy"}</div>
        <div className={styles.sub}>{small ? "онлайн · всегда" : "всегда рядом"}</div>
      </div>
    </div>
  );
}

function Calendar() {
  const days = [
    ["Пн 18", "Лёгкие 4К", "easy"],
    ["Вт 19", "Отдых", "rest"],
    ["Ср 20", "Интервалы", "hard"],
    ["Чт 21", "Отдых", "rest"],
    ["Пт 22", "Лёгкие 5К", "easy today"],
    ["Сб 23", "ОФП", "rest"],
    ["Вс 24", "Длинная 8К", "hard"],
    ["25", "Лёгкие 4К", "easy"],
    ["26", "Отдых", "rest"],
    ["27", "Темпо", "hard"],
    ["28", "Отдых", "rest"],
    ["29", "Лёгкие 4К", "easy"],
    ["30", "ОФП", "rest"],
    ["31", "Старт 5К", "race"],
  ];

  return (
    <div className={styles.calendar} data-reveal>
      <div className={styles.calHead}>
        <h5 className="h-display">Март · неделя 3</h5>
        <div className={styles.calNav}>
          <button type="button">‹</button>
          <button type="button">›</button>
        </div>
      </div>
      <div className={styles.calGrid}>
        {days.map(([day, workout, type]) => (
          <div
            key={`${day}-${workout}`}
            className={`${styles.calCell} ${type
              .split(" ")
              .map((name) => styles[name])
              .join(" ")}`}
          >
            <div className={styles.dayNum}>{day}</div>
            <div className={styles.workout}>{workout}</div>
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span><span className={`${styles.sw} ${styles.swEasy}`} /> Легко</span>
        <span><span className={`${styles.sw} ${styles.swHard}`} /> Работа</span>
        <span><span className={`${styles.sw} ${styles.swRest}`} /> Восстановление</span>
        <span><span className={`${styles.sw} ${styles.swRace}`} /> Старт</span>
      </div>
    </div>
  );
}

