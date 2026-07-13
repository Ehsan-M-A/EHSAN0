export interface VoicePersona {
  id: string;
  name: string;
  title: string;
  description: string;
  gender: 'male' | 'female';
  pitch: number;
  rate: number;
  lang: string;
  iconColor: string;
}

export interface PresetText {
  id: string;
  title: string;
  category: string;
  content: string;
}
