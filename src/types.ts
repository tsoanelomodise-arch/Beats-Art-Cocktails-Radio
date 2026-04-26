export interface ScheduleEntry {
  id: string;
  time: string; // e.g. "06:00-09:00"
  show: string;
  focus: string;
  category?: 'news' | 'music' | 'talk' | 'business' | 'creative';
  startTime?: number | null; // minutes from midnight, null for auto-follow
  followsShowTitle?: string; // If null/empty, follows the previous entry in list. Otherwise follows this specific show title.
  duration: number; // minutes
  startTimeSecs?: number; // seconds from midnight
  durationSecs?: number; // seconds
  daysOfWeek?: number[]; // [0,1,2,3,4,5,6] where 0 is Sunday
  specificDate?: string; // ISO date string for one-off events
  sessionId?: string; // Reference to specific Studio session ID
}

export interface MonthlySchedule {
  year: number;
  monthIndex: number; // 0-11
  theme: string;
  entries: ScheduleEntry[];
}

export type SegmentType = 'talk' | 'music' | 'ad' | 'jingle' | 'news' | 'interview' | 'documentary' | 'story' | 'mix';

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  duration?: number;
}

export interface ShowSegment {
  id: string;
  type: SegmentType;
  title: string;
  content: string; // The script or asset reference
  voiceId?: string;
  styleLabel?: string;
  audioUrl?: string; // Legacy / single audio fallback
  audioSequence?: AudioTrack[]; // Array for sequential audio upload
  duration?: number; // In seconds
  thumbnail?: string; // URL or Base64
}

export interface Session {
  id: string;
  title: string;
  segmentIds: string[];
}

export interface RadioShow {
  id: string;
  title: string;
  description: string;
  segments: ShowSegment[];
  sessions: Session[];
  createdAt: string;
}

export type AppView = 'studio' | 'schedule' | 'live' | 'landing';
export type ScheduleMode = 'calendar' | 'weekly' | 'list' | 'playlist';
