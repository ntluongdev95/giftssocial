export interface CapsuleTheme {
  id: string;
  label: string;
  emoji: string;
  description: string;
  bgGradient: string;
  paperGrainOpacity: number;
  inkColor: string;
  accentColor: string;
  secondaryColor: string;
  stampColor: string;
  stampText: string;
  headerLabel: string;
  flourish: [string, string, string];
  bottomFlourish: string;
  signaturePrefix: string;
  buttonGradient: string;
  scrollEmoji: string;
}

export const CAPSULE_THEMES: Record<string, CapsuleTheme> = {
  classic: {
    id: 'classic',
    label: 'Future self',
    emoji: '📜',
    description: 'A letter to who you become',
    bgGradient: 'linear-gradient(135deg, #f5e9d4 0%, #ead4b3 50%, #dcc090 100%)',
    paperGrainOpacity: 0.35,
    inkColor: '#3a2817',
    accentColor: '#8b6f47',
    secondaryColor: '#6b4f2c',
    stampColor: '#a3401b',
    stampText: '✓ DELIVERED',
    headerLabel: 'A letter from past you',
    flourish: ['❦', '✦', '❦'],
    bottomFlourish: '❀',
    signaturePrefix: '— You',
    buttonGradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    scrollEmoji: '📜',
  },
  child: {
    id: 'child',
    label: 'For my child',
    emoji: '🍼',
    description: 'A keepsake for your child to read someday',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #f9c5dd 100%)',
    paperGrainOpacity: 0.2,
    inkColor: '#4a1d3f',
    accentColor: '#be185d',
    secondaryColor: '#9d174d',
    stampColor: '#db2777',
    stampText: '♡ FOR YOU, MY LOVE',
    headerLabel: 'A letter for my child',
    flourish: ['🌸', '✿', '🌸'],
    bottomFlourish: '🍼',
    signaturePrefix: '— Yours always',
    buttonGradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
    scrollEmoji: '🌸',
  },
  love: {
    id: 'love',
    label: 'Love letter',
    emoji: '💌',
    description: 'For someone who has your heart',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 50%, #fca5a5 100%)',
    paperGrainOpacity: 0.25,
    inkColor: '#450a0a',
    accentColor: '#991b1b',
    secondaryColor: '#7f1d1d',
    stampColor: '#dc2626',
    stampText: '♥ SEALED WITH LOVE',
    headerLabel: 'A love letter',
    flourish: ['❤', '✦', '❤'],
    bottomFlourish: '♡',
    signaturePrefix: '— With love',
    buttonGradient: 'linear-gradient(135deg, #ef4444, #ec4899)',
    scrollEmoji: '💌',
  },
  travel: {
    id: 'travel',
    label: 'Travel memory',
    emoji: '✈️',
    description: 'A postcard from a place in time',
    bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)',
    paperGrainOpacity: 0.4,
    inkColor: '#451a03',
    accentColor: '#b45309',
    secondaryColor: '#92400e',
    stampColor: '#0369a1',
    stampText: '✈ POSTCARD',
    headerLabel: 'A postcard from then',
    flourish: ['✦', '☼', '✦'],
    bottomFlourish: '☼',
    signaturePrefix: '— From there',
    buttonGradient: 'linear-gradient(135deg, #f59e0b, #ec4899)',
    scrollEmoji: '✈️',
  },
  milestone: {
    id: 'milestone',
    label: 'Milestone',
    emoji: '🏆',
    description: 'For a big day yet to come',
    bgGradient: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)',
    paperGrainOpacity: 0.15,
    inkColor: '#fef3c7',
    accentColor: '#fbbf24',
    secondaryColor: '#f59e0b',
    stampColor: '#fbbf24',
    stampText: '★ FOR YOUR BIG DAY',
    headerLabel: 'For your milestone',
    flourish: ['★', '✦', '★'],
    bottomFlourish: '★',
    signaturePrefix: '— With pride',
    buttonGradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    scrollEmoji: '🏆',
  },
  birthday: {
    id: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    description: 'A birthday wish — open it on their day',
    bgGradient: 'linear-gradient(135deg, #fef3f8 0%, #fce4ec 30%, #fff4cc 65%, #ffe0a3 100%)',
    paperGrainOpacity: 0.18,
    inkColor: '#5b1d4a',
    accentColor: '#d946ef',
    secondaryColor: '#a21caf',
    stampColor: '#d97706',
    stampText: '★ HAPPY BIRTHDAY',
    headerLabel: 'A birthday letter',
    flourish: ['🎈', '✦', '🎈'],
    bottomFlourish: '🎂',
    signaturePrefix: '— Cheers',
    buttonGradient: 'linear-gradient(135deg, #f59e0b, #d946ef)',
    scrollEmoji: '🎂',
  },
};

export const THEME_LIST: CapsuleTheme[] = Object.values(CAPSULE_THEMES);

export const getTheme = (id?: string | null): CapsuleTheme =>
  CAPSULE_THEMES[id || 'classic'] || CAPSULE_THEMES.classic;
