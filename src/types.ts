export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  sample: string;
}

export interface DetectedObstacle {
  id: string;
  label: string;
  isHazard: boolean;
  severity: 'high' | 'medium' | 'low';
  distance?: string;
  location?: 'left' | 'center' | 'right' | string;
  box2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 scale
}

export interface VisionAnalysis {
  summary: string;
  urgentHazards: string[];
  pathClear: boolean;
  navigationAdvice: string;
  obstacles: DetectedObstacle[];
  detectedText?: string[];
  identifiedItems?: Array<{
    name: string;
    location: string;
    distance: string;
  }>;
  audioAlert: string;
}

export interface TranslationResult {
  translatedText: string;
  romanizedPronunciation?: string;
  detectedSourceLanguage?: string;
  targetLanguage: string;
  culturalNote?: string;
  reverseTranslation?: string;
}

export type AssistantMode = 'voice-chat' | 'vision-nav' | 'interpreter' | 'quick-tools';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  spokenSummary?: string;
  romanizedPronunciation?: string;
  timestamp: Date;
  audioBase64?: string;
  image?: string;
  hazardWarning?: string | null;
  detectedLanguage?: string;
  suggestedReplies?: string[];
  obstacles?: DetectedObstacle[];
  objectsOrLabels?: string[];
}
