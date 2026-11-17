/**
 * MonsterArtwork - Custom SVG illustrations for all 16 Junk Slayer monsters & weeds,
 * with live combat status overlays (shield barrier rings, attack telegraph aura,
 * boss phase enrage embers, and damage flash).
 */

import type { MonsterArchetype } from '../game/types';

export type MonsterArtworkSize = 'sm' | 'md' | 'lg';

interface MonsterArtworkProps {
  monsterId: string;
  archetype?: MonsterArchetype;
  size?: MonsterArtworkSize;
  shieldHits?: number;
  maxShieldHits?: number;
  isWarning?: boolean;
  isDamaged?: boolean;
  bossPhase?: number;
  className?: string;
}

const SIZE_CLASSES: Record<MonsterArtworkSize, string> = {
  sm: 'w-11 h-11',
  md: 'w-16 h-16',
  lg: 'w-28 h-28',
};

function MonsterEyes({
  y = 58,
  spread = 14,
  angry = false,
  eyeColor = '#0f172a',
  pupilColor = '#f8fafc',
}: {
  y?: number;
  spread?: number;
  angry?: boolean;
  eyeColor?: string;
  pupilColor?: string;
}) {
  const leftX = 60 - spread;
  const rightX = 60 + spread;
  return (
    <g>
      <circle cx={leftX} cy={y} r={5.5} fill={eyeColor} />
      <circle cx={rightX} cy={y} r={5.5} fill={eyeColor} />
      <circle cx={leftX + 1.4} cy={y - 1.5} r={2} fill={pupilColor} />
      <circle cx={rightX + 1.4} cy={y - 1.5} r={2} fill={pupilColor} />
      {angry ? (
        <>
          <path
            d={`M${leftX - 7} ${y - 9} L${leftX + 6} ${y - 4}`}
            stroke={eyeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d={`M${rightX + 7} ${y - 9} L${rightX - 6} ${y - 4}`}
            stroke={eyeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d={`M${leftX - 6} ${y - 8} L${leftX + 5} ${y - 6}`}
            stroke={eyeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d={`M${rightX + 6} ${y - 8} L${rightX - 5} ${y - 6}`}
            stroke={eyeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

function BossCrown({ y = 14 }: { y?: number }) {
  return (
    <g transform={`translate(0, ${y})`}>
      <path
        d="M36 22 L42 6 L53 15 L60 2 L67 15 L78 6 L84 22 Z"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect
        x="35"
        y="20"
        width="50"
        height="7"
        rx="3"
        fill="#f59e0b"
        stroke="#b45309"
        strokeWidth="2"
      />
      <circle cx="60" cy="14" r="2.8" fill="#ef4444" />
      <circle cx="46" cy="17" r="2.2" fill="#38bdf8" />
      <circle cx="74" cy="17" r="2.2" fill="#10b981" />
    </g>
  );
}

function renderMonsterBody(baseId: string, isBoss: boolean) {
  switch (baseId) {
    case 'SODA':
      return (
        <g>
          {/* Straw & fizz bubbles */}
          <path
            d="M66 30 L74 12 L86 10"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M66 30 L74 12 L86 10"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <circle cx="42" cy="24" r="3.5" fill="#7dd3fc" opacity="0.85" />
          <circle cx="52" cy="17" r="2.5" fill="#bae6fd" opacity="0.9" />
          <circle cx="78" cy="24" r="3" fill="#7dd3fc" opacity="0.8" />
          {/* Can body */}
          <rect
            x="34"
            y="30"
            width="52"
            height="68"
            rx="12"
            fill="#e11d48"
            stroke="#881337"
            strokeWidth="3"
          />
          <rect x="36" y="45" width="48" height="28" fill="#fb7185" opacity="0.35" />
          <path
            d="M36 52 Q48 45 60 52 T84 52"
            fill="none"
            stroke="#fef08a"
            strokeWidth="3"
            opacity="0.85"
          />
          {/* Top/Bottom rim */}
          <ellipse cx="60" cy="32" rx="24" ry="5" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
          <ellipse cx="60" cy="96" rx="23" ry="4" fill="#94a3b8" />
          <MonsterEyes y={58} spread={12} angry={isBoss} />
          {/* Jagged grin */}
          <path
            d="M46 73 L52 79 L60 73 L68 79 L74 73"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );

    case 'FRIES':
      return (
        <g>
          {/* Crispy fries */}
          <g stroke="#b45309" strokeWidth="2">
            <rect x="36" y="24" width="10" height="40" rx="3" fill="#facc15" transform="rotate(-10 41 44)" />
            <rect x="47" y="18" width="10" height="44" rx="3" fill="#fde047" transform="rotate(-3 52 40)" />
            <rect x="58" y="16" width="10" height="46" rx="3" fill="#facc15" />
            <rect x="69" y="20" width="10" height="43" rx="3" fill="#fde047" transform="rotate(6 74 41)" />
            <rect x="76" y="27" width="9" height="36" rx="3" fill="#eab308" transform="rotate(14 80 45)" />
          </g>
          {/* Ninja headband */}
          <rect x="33" y="46" width="54" height="8" rx="3" fill="#1e293b" />
          <path d="M85 48 L98 42 L95 51 Z" fill="#1e293b" />
          {/* Carton */}
          <path
            d="M32 50 L88 50 L80 98 Q60 104 40 98 Z"
            fill="#dc2626"
            stroke="#7f1d1d"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M34 52 Q60 64 86 52"
            fill="none"
            stroke="#f87171"
            strokeWidth="3"
          />
          <MonsterEyes y={68} spread={13} angry={true} />
          <path
            d="M48 84 Q60 77 72 84"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );

    case 'MILKSHAKE':
      return (
        <g>
          {/* Whipped swirl */}
          <path
            d="M36 48 Q38 34 52 33 Q52 20 65 22 Q76 22 76 34 Q86 38 84 48 Z"
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="2.5"
          />
          <circle cx="62" cy="18" r="6" fill="#e11d48" stroke="#881337" strokeWidth="2" />
          <path d="M62 12 Q67 6 72 7" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
          {/* Tall glass */}
          <path
            d="M36 48 L84 48 L75 96 Q60 102 45 96 Z"
            fill="#f472b6"
            stroke="#9d174d"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M40 54 L78 54 L75 70 Q60 76 43 70 Z" fill="#fbcfe8" opacity="0.45" />
          <MonsterEyes y={68} spread={11} angry={isBoss} />
          <ellipse cx="60" cy="83" rx="8" ry="4.5" fill="#831843" />
          <ellipse cx="60" cy="84" rx="5" ry="2.2" fill="#fb7185" />
        </g>
      );

    case 'DONUT':
      return (
        <g>
          {/* Outer dough ring */}
          <circle cx="60" cy="62" r="36" fill="#d97706" stroke="#78350f" strokeWidth="3.5" />
          {/* Frosting */}
          <path
            d="M27 56 C28 34 45 27 60 27 C77 27 92 36 93 56 C90 61 85 57 81 62 C76 66 72 58 66 61 C60 65 54 57 48 61 C42 66 36 58 31 61 Z"
            fill="#ec4899"
            stroke="#9d174d"
            strokeWidth="2"
          />
          {/* Sprinkles */}
          <rect x="42" y="37" width="7" height="3" rx="1.5" fill="#fef08a" transform="rotate(-25 45 38)" />
          <rect x="66" y="34" width="7" height="3" rx="1.5" fill="#38bdf8" transform="rotate(20 69 35)" />
          <rect x="76" y="45" width="7" height="3" rx="1.5" fill="#4ade80" transform="rotate(-15 79 46)" />
          <rect x="34" y="47" width="6" height="3" rx="1.5" fill="#f8fafc" transform="rotate(30 37 48)" />
          {/* Center donut hole */}
          <circle cx="60" cy="62" r="12" fill="#0f172a" stroke="#78350f" strokeWidth="3" />
          <MonsterEyes y={50} spread={17} angry={isBoss} />
          <path
            d="M44 80 Q60 89 76 80"
            fill="none"
            stroke="#451a03"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </g>
      );

    case 'NACHOS':
      return (
        <g>
          {/* Back tortilla chips */}
          <polygon
            points="32,84 52,32 76,84"
            fill="#eab308"
            stroke="#854d0e"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <polygon
            points="48,88 76,28 96,84"
            fill="#f59e0b"
            stroke="#92400e"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {/* Main front tortilla chip */}
          <polygon
            points="24,90 60,26 92,90"
            fill="#facc15"
            stroke="#a16207"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          {/* Melted cheese drips */}
          <path
            d="M46 52 Q60 44 74 52 L77 62 Q70 57 65 65 Q59 56 53 64 Q49 58 43 61 Z"
            fill="#fb923c"
            stroke="#c2410c"
            strokeWidth="1.8"
          />
          {/* Jalapeño slice */}
          <circle cx="72" cy="80" r="5" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
          <MonsterEyes y={66} spread={12} angry={true} />
          <path
            d="M48 80 L55 84 L60 79 L65 84 L72 80"
            fill="none"
            stroke="#451a03"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      );

    case 'BURGER':
      return (
        <g>
          {/* Top bun */}
          <path
            d="M25 56 C25 32 42 26 60 26 C78 26 95 32 95 56 Z"
            fill="#f59e0b"
            stroke="#92400e"
            strokeWidth="3"
          />
          {/* Sesame seeds */}
          <ellipse cx="44" cy="37" rx="3" ry="1.6" fill="#fef3c7" transform="rotate(-15 44 37)" />
          <ellipse cx="60" cy="33" rx="3" ry="1.6" fill="#fef3c7" />
          <ellipse cx="76" cy="38" rx="3" ry="1.6" fill="#fef3c7" transform="rotate(15 76 38)" />
          {/* Lettuce wave */}
          <path
            d="M22 57 Q31 64 40 57 T58 57 T76 57 T98 57 L96 64 L24 64 Z"
            fill="#22c55e"
            stroke="#14532d"
            strokeWidth="2"
          />
          {/* Cheese triangles */}
          <polygon points="34,63 50,63 42,74" fill="#fde047" />
          <polygon points="62,63 82,63 72,75" fill="#fde047" />
          {/* Patty */}
          <rect
            x="23"
            y="64"
            width="74"
            height="16"
            rx="8"
            fill="#7c2d12"
            stroke="#431407"
            strokeWidth="2.8"
          />
          {/* Bottom bun */}
          <path
            d="M26 80 L94 80 C94 93 82 98 60 98 C38 98 26 93 26 80 Z"
            fill="#d97706"
            stroke="#92400e"
            strokeWidth="3"
          />
          <MonsterEyes y={46} spread={14} angry={isBoss} />
          {/* Tooth grin between bun & patty */}
          <path d="M46 72 L52 67 L58 72 L64 67 L70 72" fill="#f8fafc" />
        </g>
      );

    case 'HOT_SAUCE':
      return (
        <g>
          {/* Flame aura */}
          <path
            d="M36 92 C24 72 34 46 48 38 C52 24 62 16 66 24 C74 32 90 50 86 78 C84 88 76 96 60 96 Z"
            fill="#f97316"
            opacity="0.35"
          />
          {/* Pepper body */}
          <path
            d="M55 32 C42 32 34 46 38 66 C42 84 58 98 76 100 C68 88 66 72 72 54 C76 42 68 32 55 32 Z"
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          {/* Green stem */}
          <path
            d="M52 33 Q48 20 62 16"
            fill="none"
            stroke="#16a34a"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <ellipse cx="55" cy="33" rx="11" ry="4" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
          <MonsterEyes y={54} spread={9} angry={true} />
          <path
            d="M47 69 Q56 63 65 70"
            fill="none"
            stroke="#450a0a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );

    case 'PIZZA':
      return (
        <g>
          {/* Crust */}
          <path
            d="M22 40 Q60 22 98 40 L92 50 Q60 36 28 50 Z"
            fill="#d97706"
            stroke="#78350f"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Cheese slice */}
          <polygon
            points="28,46 92,46 60,100"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Pepperoni slices */}
          <circle cx="46" cy="57" r="6" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.8" />
          <circle cx="72" cy="56" r="5.5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.8" />
          <circle cx="60" cy="82" r="5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.8" />
          <MonsterEyes y={66} spread={10} angry={isBoss} />
          <path
            d="M51 75 Q60 70 69 75"
            fill="none"
            stroke="#451a03"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      );

    case 'WEED_DANDELION':
      return (
        <g>
          {/* Stem & leaves */}
          <path d="M60 66 L60 100" stroke="#15803d" strokeWidth="5" strokeLinecap="round" />
          <path d="M60 86 Q40 76 34 86 Q44 96 60 90 Z" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
          <path d="M60 84 Q80 74 86 84 Q76 94 60 88 Z" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
          {/* Spiky yellow flower petals */}
          <circle cx="60" cy="48" r="24" fill="#facc15" stroke="#a16207" strokeWidth="2.5" strokeDasharray="7 4" />
          <circle cx="60" cy="48" r="17" fill="#fde047" />
          <MonsterEyes y={48} spread={8} angry={true} />
          <path d="M53 58 L60 55 L67 58" fill="none" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );

    case 'WEED_THISTLE':
      return (
        <g>
          {/* Cactus-like thorny body */}
          <rect x="44" y="28" width="32" height="70" rx="16" fill="#16a34a" stroke="#14532d" strokeWidth="3" />
          <path d="M44 62 Q28 60 28 46 Q28 38 35 38 Q39 38 39 50 Q39 54 44 54" fill="#16a34a" stroke="#14532d" strokeWidth="2.5" />
          <path d="M76 56 Q92 54 92 40 Q92 32 85 32 Q81 32 81 44 Q81 48 76 48" fill="#16a34a" stroke="#14532d" strokeWidth="2.5" />
          {/* Purple thistle bloom */}
          <polygon points="48,30 55,16 60,26 65,16 72,30" fill="#a855f7" stroke="#581c87" strokeWidth="2" />
          {/* Spines */}
          <path d="M40 42 L35 40 M40 76 L35 78 M80 72 L86 70" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
          <MonsterEyes y={54} spread={9} angry={true} />
          <path d="M51 67 Q60 62 69 67" fill="none" stroke="#052e16" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );

    case 'WEED_VINE':
      return (
        <g>
          {/* Terra pot */}
          <path d="M38 66 L82 66 L76 98 L44 98 Z" fill="#b45309" stroke="#78350f" strokeWidth="2.8" strokeLinejoin="round" />
          <rect x="34" y="60" width="52" height="10" rx="3" fill="#d97706" stroke="#78350f" strokeWidth="2.5" />
          {/* Toxic vines */}
          <path
            d="M58 60 Q44 40 34 32 M60 60 Q60 32 60 20 M62 60 Q78 40 88 30"
            fill="none"
            stroke="#4ade80"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="34" cy="30" r="8" fill="#84cc16" stroke="#365314" strokeWidth="2" />
          <circle cx="60" cy="22" r="9" fill="#a3e635" stroke="#365314" strokeWidth="2" />
          <circle cx="88" cy="28" r="8" fill="#84cc16" stroke="#365314" strokeWidth="2" />
          <MonsterEyes y={79} spread={10} angry={true} />
          <path d="M52 89 L68 89" stroke="#451a03" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );

    default:
      return (
        <g>
          <circle cx="60" cy="60" r="34" fill="#f59e0b" stroke="#78350f" strokeWidth="3" />
          <MonsterEyes y={56} spread={12} angry={isBoss} />
          <path d="M46 74 Q60 84 74 74" fill="none" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
  }
}

function resolveBaseShapeId(monsterId: string): string {
  switch (monsterId) {
    case 'BOSS_KING_BURGER':
      return 'BURGER';
    case 'BOSS_PIZZA_EMPEROR':
      return 'PIZZA';
    case 'BOSS_DONUT_TITAN':
      return 'DONUT';
    case 'BOSS_SODA_OVERLORD':
      return 'SODA';
    case 'BOSS_FRIES_EMPEROR':
      return 'FRIES';
    default:
      return monsterId;
  }
}

export function MonsterArtwork({
  monsterId,
  archetype,
  size = 'md',
  shieldHits = 0,
  maxShieldHits = 0,
  isWarning = false,
  isDamaged = false,
  bossPhase = 0,
  className = '',
}: MonsterArtworkProps) {
  const isBoss = archetype === 'BOSS' || monsterId.startsWith('BOSS_');
  const baseShapeId = resolveBaseShapeId(monsterId);
  const hasShield = shieldHits > 0;
  const totalShields = Math.max(shieldHits, maxShieldHits, 1);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 120"
        className={`w-full h-full overflow-visible ${isDamaged ? 'brightness-150 saturate-150' : ''}`}
      >
        {/* Background ambient disc */}
        <circle
          cx="60"
          cy="62"
          r="46"
          fill={
            isWarning
              ? 'rgba(239, 68, 68, 0.22)'
              : bossPhase >= 1
                ? 'rgba(249, 115, 22, 0.2)'
                : isBoss
                  ? 'rgba(245, 158, 11, 0.14)'
                  : 'rgba(15, 23, 42, 0.55)'
          }
          stroke={
            isWarning
              ? '#ef4444'
              : bossPhase >= 1
                ? '#f97316'
                : isBoss
                  ? 'rgba(251, 191, 36, 0.45)'
                  : 'rgba(148, 163, 184, 0.2)'
          }
          strokeWidth={isWarning || bossPhase >= 1 ? '2.5' : '1.5'}
        />

        {/* Boss Enrage Embers */}
        {bossPhase >= 1 && (
          <g opacity="0.85">
            <circle cx="22" cy="34" r="3" fill="#fb923c" />
            <circle cx="98" cy="36" r="2.8" fill="#facc15" />
            <circle cx="26" cy="90" r="2.5" fill="#ef4444" />
            <circle cx="95" cy="88" r="3" fill="#fb923c" />
          </g>
        )}

        {/* Monster Body */}
        <g transform={isBoss ? 'translate(0, 6)' : undefined}>
          {renderMonsterBody(baseShapeId, isBoss)}
        </g>

        {/* Boss Crown Overlay */}
        {isBoss && <BossCrown y={2} />}

        {/* Crystalline Shield Barrier Ring */}
        {hasShield && (
          <g>
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3.2"
              strokeDasharray="14 6"
              opacity="0.9"
            />
            {Array.from({ length: Math.min(4, totalShields) }).map((_, i) => {
              const active = i < shieldHits;
              const cx = 42 + i * 12;
              return (
                <circle
                  key={`shield-pip-${i}`}
                  cx={cx}
                  cy="112"
                  r="4"
                  fill={active ? '#38bdf8' : '#1e293b'}
                  stroke="#0284c7"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>
        )}

        {/* Attack Warning Telegraph Corner Triangle */}
        {isWarning && (
          <polygon
            points="100,14 114,34 86,34"
            fill="#ef4444"
            stroke="#fef2f2"
            strokeWidth="1.5"
          />
        )}
      </svg>
    </div>
  );
}
