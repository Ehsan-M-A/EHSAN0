import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Volume2, 
  Mic, 
  Settings, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Copy, 
  Check, 
  Share2, 
  RotateCcw, 
  Info, 
  ExternalLink, 
  User, 
  Clock, 
  ArrowRight, 
  FileText, 
  HelpCircle, 
  VolumeX,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { VOICE_PERSONAS, PRESET_TEXTS } from './data';
import { VoicePersona, PresetText } from './types';

export default function App() {
  // Navigation / Tabs inside the Android phone simulator
  const [activeTab, setActiveTab] = useState<'tts' | 'stt'>('tts');
  
  // TTS State
  const [inputText, setInputText] = useState<string>(PRESET_TEXTS[0].content);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('sheikh_abdullah');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showFloatingWidget, setShowFloatingWidget] = useState<boolean>(false);
  const [highlightedText, setHighlightedText] = useState<string>('');
  
  // Custom voices loaded from browser to bind real speech
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // STT State
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recognitionError, setRecognitionError] = useState<string>('');
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  
  // UI helpers
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedTranscribed, setCopiedTranscribed] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  
  // Active android guide step
  const [activeGuide, setActiveGuide] = useState<'tts' | 'stt'>('tts');
  const [guideStep, setGuideStep] = useState<number>(1);

  // References for drag-and-drop floating widget
  const widgetRef = useRef<HTMLDivElement>(null);
  const [widgetPosition, setWidgetPosition] = useState({ x: 20, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setBrowserVoices(voices);
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    // Cleanup on unmount
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Set up Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'ar-SA'; // Default to Arabic Saudi Arabia
      
      rec.onstart = () => {
        setIsRecording(true);
        setRecognitionError('');
      };
      
      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscribedText(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };
      
      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event);
        if (event.error === 'not-allowed') {
          setRecognitionError('صلاحية المايكروفون مرفوضة. الرجاء السماح للمتصفح بالوصول للمايك.');
        } else {
          setRecognitionError('حدث خطأ أثناء التعرف على الصوت. الرجاء المحاولة مجددًا.');
        }
        setIsRecording(false);
      };
      
      rec.onend = () => {
        setIsRecording(false);
      };
      
      setRecognitionInstance(rec);
    }
  }, []);

  // Split text helper
  const prepareSentences = (text: string) => {
    if (!text.trim()) return [];
    
    // Split by common Arabic/English punctuation or newlines
    const rawSegments = text.split(/([.،؟!\n]+)/);
    const result: string[] = [];
    
    for (let i = 0; i < rawSegments.length; i++) {
      const segment = rawSegments[i];
      if (!segment) continue;
      
      // If it's punctuation, append to the last sentence if possible
      if (/^[.،؟!\n]+$/.test(segment)) {
        if (result.length > 0) {
          result[result.length - 1] += segment;
        } else {
          result.push(segment);
        }
      } else {
        if (segment.trim()) {
          result.push(segment);
        }
      }
    }
    return result;
  };

  // Speak a specific sentence
  const speakSentence = (index: number, currentSentences: string[]) => {
    window.speechSynthesis.cancel();
    
    if (index < 0 || index >= currentSentences.length) {
      // Finished reading
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentSentenceIndex(-1);
      return;
    }
    
    setCurrentSentenceIndex(index);
    const sentenceToSpeak = currentSentences[index];
    
    const utterance = new SpeechSynthesisUtterance(sentenceToSpeak);
    
    // Find best voice match
    const selectedPersona = VOICE_PERSONAS.find(p => p.id === selectedVoiceId) || VOICE_PERSONAS[0];
    
    // Try to find an Arabic voice in the browser, fallback to any available Arabic or default
    const arabicVoices = browserVoices.filter(v => v.lang.startsWith('ar') || v.lang.toLowerCase().includes('arabic'));
    if (arabicVoices.length > 0) {
      // Choose different Arabic voices dynamically based on index if multiple exist on the system!
      const voiceIdx = VOICE_PERSONAS.findIndex(p => p.id === selectedVoiceId) % arabicVoices.length;
      utterance.voice = arabicVoices[Math.max(0, voiceIdx)];
    }
    
    // Apply voice persona characteristics
    utterance.pitch = selectedPersona.pitch;
    // Speed is voice rate multiplied by user setting
    utterance.rate = selectedPersona.rate * speechRate;
    
    utterance.onend = () => {
      // Speak next sentence if still playing and not paused
      if (isPlaying && !isPaused) {
        speakSentence(index + 1, currentSentences);
      }
    };
    
    utterance.onerror = (e) => {
      console.error('SpeechSynthesisUtterance error', e);
      // Try next sentence anyway
      if (isPlaying && !isPaused) {
        speakSentence(index + 1, currentSentences);
      }
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Start TTS
  const handleStartReading = () => {
    if (!inputText.trim()) return;
    
    const prepared = prepareSentences(inputText);
    setSentences(prepared);
    setIsPlaying(true);
    setIsPaused(false);
    setShowFloatingWidget(true);
    
    // Start from beginning
    speakSentence(0, prepared);
  };

  // Toggle Pause/Resume
  const handleTogglePause = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      speakSentence(currentSentenceIndex, sentences);
    } else {
      // Pause
      setIsPaused(true);
      window.speechSynthesis.cancel(); // Stop current speaking, state stays on current index
    }
  };

  // Stop reading
  const handleStopReading = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    setShowFloatingWidget(false);
  };

  // Forward 10s (approx 3 sentences)
  const handleForward = () => {
    if (sentences.length === 0) return;
    const nextIndex = Math.min(sentences.length - 1, currentSentenceIndex + 2);
    if (nextIndex !== currentSentenceIndex) {
      setIsPaused(false);
      speakSentence(nextIndex, sentences);
    }
  };

  // Rewind 10s (approx 3 sentences)
  const handleRewind = () => {
    if (sentences.length === 0) return;
    const prevIndex = Math.max(0, currentSentenceIndex - 2);
    if (prevIndex !== currentSentenceIndex) {
      setIsPaused(false);
      speakSentence(prevIndex, sentences);
    }
  };

  // STT Dictation controls
  const handleToggleRecording = () => {
    if (!recognitionInstance) {
      setRecognitionError('ميزة تحويل الصوت إلى كتابة غير مدعومة بالكامل في هذا المتصفح. يرجى استخدام متصفح جوجل كروم.');
      return;
    }

    if (isRecording) {
      recognitionInstance.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionInstance.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleClearTranscription = () => {
    setTranscribedText('');
    setRecognitionError('');
  };

  // Copy text helper
  const copyToClipboard = (text: string, isTranscribed: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isTranscribed) {
      setCopiedTranscribed(true);
      setTimeout(() => setCopiedTranscribed(false), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  // WhatsApp share helper
  const shareToWhatsApp = (text: string) => {
    if (!text.trim()) return;
    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // Google Search helper
  const searchOnGoogle = (text: string) => {
    if (!text.trim()) return;
    const encodedText = encodeURIComponent(text);
    window.open(`https://www.google.com/search?q=${encodedText}`, '_blank');
  };

  // Drag handlers for the floating widget
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement) return; // Don't drag if clicking buttons
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - widgetPosition.x,
      y: e.clientY - widgetPosition.y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    // Constrain within the simulated screen (optional, but nice)
    setWidgetPosition({
      x: Math.max(5, Math.min(newX, 300)),
      y: Math.max(50, Math.min(newY, 600))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target instanceof HTMLButtonElement) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = {
      x: touch.clientX - widgetPosition.x,
      y: touch.clientY - widgetPosition.y
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.current.x;
    const newY = touch.clientY - dragStart.current.y;
    setWidgetPosition({
      x: Math.max(5, Math.min(newX, 300)),
      y: Math.max(50, Math.min(newY, 600))
    });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const activePersona = VOICE_PERSONAS.find(p => p.id === selectedVoiceId) || VOICE_PERSONAS[0];

  const categories = ['الكل', 'أذكار وطمأنينة', 'حكم وقصص', 'صصحة وعافية'];
  const filteredPresets = PRESET_TEXTS.filter(p => 
    selectedCategory === 'الكل' || p.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#3E362E] font-sans p-2 sm:p-6 lg:p-10 flex flex-col items-center select-none" id="app_root" dir="rtl">
      
      {/* HEADER SECTION */}
      <header className="w-full max-w-7xl text-center mb-8 mt-4" id="app_header">
        <div className="inline-flex items-center justify-center p-2.5 bg-[#4A6741]/10 text-[#4A6741] rounded-2xl mb-3 border border-[#4A6741]/20">
          <Sparkles className="w-5 h-5 ml-2 animate-bounce text-[#4A6741]" />
          <span className="font-bold text-sm md:text-base">تطبيق تفاعلي مُهداة بكل حب للوالد الغالي 🧔❤️</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight text-[#2D241E] mb-2">
          مُساعد الأندرويد للقراءة والإملاء بالصوت
        </h1>
        <p className="text-[#7A6C5D] text-base md:text-lg max-w-2xl mx-auto font-medium">
          أداة محاكاة تفاعلية لتجربة الميزات فوراً، مع دليل مبسط وخطوة بخطوة لتفعيلها وتثبيتها بشكل حقيقي على هاتف الوالد.
        </p>
        
        {/* Full Screen Link Button */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-4" id="fullscreen_launcher_box">
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="px-5 py-2.5 bg-[#4A6741] hover:bg-[#3B5234] text-white text-xs font-black rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2 border border-[#3B5234]"
          >
            <ExternalLink className="w-4 h-4 text-[#F2F7F0]" />
            <span>انقر هنا لفتح التطبيق في نافذة مستقلة (لحل مشكلة المايكروفون تماماً)</span>
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE BENTO GRID */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16" id="main_grid">
        
        {/* RIGHT COLUMN: DETAILED GUIDES & ACTIONS (7/12) */}
        <section className="lg:col-span-7 space-y-6" id="guides_column">
          
          {/* INFO CARD */}
          <div className="bg-[#F5F1E9] rounded-3xl p-6 shadow-sm border border-[#E2D9C8]" id="info_intro">
            <h2 className="text-xl font-display font-bold text-[#2D241E] flex items-center mb-3">
              <Info className="w-5.5 h-5.5 text-[#4A6741] ml-2" />
              توضيح فني هام ومريح للوالد
            </h2>
            <p className="text-[#5E5246] leading-relaxed text-sm md:text-base">
              نظراً لأن أنظمة أندرويد تحافظ على خصوصية المستخدم، 
              <strong className="text-[#2D241E]"> لا يمكن لأي موقع ويب أو تطبيق خارجي أن يتحكم في الشاشة أو يقرأ من التطبيقات الأخرى (مثل الواتساب وقوقل) بشكل تلقائي دون إذن رسمي.</strong>
               لذلك، قمنا بتوفير ميزتين رائعتين:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#F2F7F0] rounded-2xl border border-[#4A6741]/20">
                <span className="text-xs font-bold text-[#4A6741] bg-[#4A6741]/10 px-2 py-0.5 rounded-full">داخل هذا التطبيق</span>
                <p className="text-xs text-[#5E5246] mt-2">
                  جرب محاكاة كاملة 100% للميزات كأنك على الهاتف! استمع للأصوات الـ 10، غير السرعة، جرب اللوحة الشفافة العائمة، وتكلم ليتحول كلامك لنص وارسله فوراً للواتساب بنقرة واحدة!
                </p>
              </div>
              <div className="p-4 bg-[#EAE2D5]/40 rounded-2xl border border-[#E2D9C8]">
                <span className="text-xs font-bold text-[#5E5246] bg-[#EAE2D5] px-2 py-0.5 rounded-full">على هاتف الوالد مباشرة</span>
                <p className="text-xs text-[#5E5246] mt-2">
                  اتبع الدليل المصور بالأسفل لتفعيل ميزتي <span className="font-bold text-[#2D241E]">"سماع الاختيار"</span> و <span className="font-bold text-[#2D241E]">"الكتابة بالصوت من Google"</span> المدمجتين مجاناً في نظامه لتشتغل في أي مكان بجواله!
                </p>
              </div>
            </div>
          </div>

          {/* DYNAMIC SETUP GUIDE */}
          <div className="bg-white rounded-3xl shadow-md border border-[#E2D9C8] overflow-hidden" id="interactive_guide">
            {/* Guide Header Tabs */}
            <div className="bg-[#4A6741] text-white p-4 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-[#3B5234]">
              <div>
                <h3 className="font-display font-black text-lg md:text-xl flex items-center justify-center md:justify-start">
                  <Smartphone className="w-5 h-5 ml-2 text-[#EAE2D5]" />
                  دليل تفعيل الميزة على جوال الوالد (أندرويد)
                </h3>
                <p className="text-xs text-[#F2F7F0]/80 mt-0.5">خطوات مبسطة بخط كبير وألوان مريحة للعين لتعديل إعدادات الهاتف</p>
              </div>
              <div className="flex bg-[#3B5234] p-1.5 rounded-xl border border-[#2F4229] self-stretch md:self-auto">
                <button 
                  id="guide_tab_tts"
                  onClick={() => { setActiveGuide('tts'); setGuideStep(1); }}
                  className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeGuide === 'tts' ? 'bg-white text-[#4A6741] shadow' : 'text-[#EAE2D5] hover:text-white'}`}
                >
                  القسم 1: قراءة الشاشة
                </button>
                <button 
                  id="guide_tab_stt"
                  onClick={() => { setActiveGuide('stt'); setGuideStep(1); }}
                  className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeGuide === 'stt' ? 'bg-white text-[#4A6741] shadow' : 'text-[#EAE2D5] hover:text-white'}`}
                >
                  القسم 2: إملاء الصوت
                </button>
              </div>
            </div>

            {/* Guide Steps Body */}
            <div className="p-6 md:p-8">
              {activeGuide === 'tts' ? (
                // TTS SELECT TO SPEAK GUIDE
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-[#4A6741] bg-[#F2F7F0] border border-[#4A6741]/20 px-3 py-1 rounded-full">
                      ميزة "سماع الاختيار" (Select to Speak)
                    </span>
                    <span className="text-[#7A6C5D] text-xs font-bold font-mono">الخطوة {guideStep} من 4</span>
                  </div>

                  {/* Step Content */}
                  <div className="min-h-[160px] flex flex-col justify-center">
                    {guideStep === 1 && (
                      <div className="space-y-3" id="tts_step_1">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">١</span>
                          افتح "الإعدادات" في هاتف الوالد
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          اذهب إلى الشاشة الرئيسية لجوال الوالد، وابحث عن تطبيق <strong className="text-[#2D241E]">"الإعدادات" (Settings)</strong> ذو شكل الترس وافتحه.
                        </p>
                        <div className="bg-[#F5F1E9] p-3 rounded-xl border border-[#E2D9C8] text-xs text-[#7A6C5D] pr-9">
                          💡 نصيحة: يمكنك أيضاً سحب الشاشة من الأعلى لأسفل والضغط على علامة الترس الصغيرة في الزاوية.
                        </div>
                      </div>
                    )}

                    {guideStep === 2 && (
                      <div className="space-y-3" id="tts_step_2">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">٢</span>
                          ابحث عن "إمكانية الوصول" (Accessibility)
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          انزل لأسفل القائمة واضغط على خيار <strong className="text-[#2D241E]">"إمكانية الوصول" (Accessibility)</strong> أو في بعض الهواتف تجدها داخل <strong className="text-[#2D241E]">"الإعدادات الإضافية"</strong>.
                        </p>
                        <div className="bg-[#F5F1E9] p-3 rounded-xl border border-[#E2D9C8] text-xs text-[#7A6C5D] pr-9">
                          💡 شعار هذا الخيار غالباً ما يكون على شكل شخص يفتح ذراعيه باللون الأخضر أو الأزرق.
                        </div>
                      </div>
                    )}

                    {guideStep === 3 && (
                      <div className="space-y-3" id="tts_step_3">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">٣</span>
                          تفعيل ميزة "سماع الاختيار" (Select to Speak)
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          اضغط على <strong className="text-[#2D241E]">"سماع الاختيار" (Select to Speak)</strong>، ثم قم بتفعيل زر التشغيل. ستظهر رسالة تطلب منك إعطاء الصلاحيات لظهور الأداة، اضغط <strong className="text-[#4A6741] font-bold">"موافق" (Allow)</strong>.
                        </p>
                        <div className="bg-[#F5F1E9] p-3 rounded-xl border border-[#E2D9C8] text-xs text-[#7A6C5D] pr-9">
                          ⚙️ في قائمة الإعدادات الفرعية لهذه الميزة، يمكنك الضغط على "محرك تحويل النص إلى حديث" واختيار اللغة العربية وتعديل سرعة الصوت للسرعة المناسبة لوالدك!
                        </div>
                      </div>
                    )}

                    {guideStep === 4 && (
                      <div className="space-y-3" id="tts_step_4">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">٤</span>
                          طريقة الاستخدام في الواتس اب أو أي مكان!
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          الآن، سيظهر زر صغير عائم (أو عبر ضغط زري رفع وخفض الصوت معاً حسب نوع الجوال). 
                          عند تصفح الواتس اب، يضغط الوالد على هذا الزر الصغير، ثم يحدد النص المراد قراءته على الشاشة. ستظهر <strong className="text-[#4A6741]">لوحة تحكم شفافة</strong> تمكنه من: التشغيل، الإيقاف، التقديم، أو التأخير بسهولة فائقة!
                        </p>
                        <div className="bg-[#F2F7F0] p-3 rounded-xl border border-[#4A6741]/20 text-xs text-[#5E5246] pr-9">
                          🎉 مبروك! الميزة مدمجة رسمياً ومحمية بالكامل من نظام أندرويد لتعمل على جميع التطبيقات دون إبطاء للجوال!
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Guide Navigation */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E2D9C8]">
                    <button
                      id="prev_step_btn"
                      disabled={guideStep === 1}
                      onClick={() => setGuideStep(p => Math.max(1, p - 1))}
                      className="px-4 py-2 bg-[#F5F1E9] hover:bg-[#EAE2D5] text-[#5E5246] text-xs font-bold rounded-xl border border-[#E2D9C8] disabled:opacity-40 transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex space-x-1.5 space-x-reverse">
                      {[1, 2, 3, 4].map(idx => (
                        <div 
                           key={idx} 
                           onClick={() => setGuideStep(idx)}
                           className={`w-2 h-2 rounded-full cursor-pointer transition-all ${guideStep === idx ? 'w-6 bg-[#4A6741]' : 'bg-[#E2D9C8]'}`} 
                        />
                      ))}
                    </div>
                    {guideStep < 4 ? (
                      <button
                        id="next_step_btn"
                        onClick={() => setGuideStep(p => Math.min(4, p + 1))}
                        className="px-4 py-2 bg-[#4A6741] hover:bg-[#3B5234] text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        التالي
                      </button>
                    ) : (
                      <button
                        id="test_simulator_btn"
                        onClick={() => {
                          setActiveTab('tts');
                          // Scroll to simulator
                          document.getElementById('simulator_card')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-4 py-2 bg-[#4A6741] hover:bg-[#3B5234] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center"
                      >
                        اختبر المحاكاة الآن 📱
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // STT SPEECH TO TEXT GUIDE
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-[#5E5246] bg-[#F5F1E9] border border-[#E2D9C8] px-3 py-1 rounded-full">
                      ميزة "الكتابة بالصوت" عبر لوحة المفاتيح
                    </span>
                    <span className="text-[#7A6C5D] text-xs font-bold font-mono">الخطوة {guideStep} من 3</span>
                  </div>

                  {/* Step Content */}
                  <div className="min-h-[160px] flex flex-col justify-center">
                    {guideStep === 1 && (
                      <div className="space-y-3" id="stt_step_1">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">١</span>
                          التأكد من استخدام لوحة مفاتيح Gboard من Google
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          لوحة مفاتيح <strong className="text-[#2D241E]">Gboard</strong> هي الكيبورد الرسمي الأفضل من جوجل ويأتي مثبتاً تلقائياً على معظم الأجهزة، وإذا لم يكن موجوداً يمكنك تحميله بثوانٍ من متجر <strong className="text-[#2D241E]">Play Store</strong> مجاناً.
                        </p>
                        <div className="bg-[#F5F1E9] p-3 rounded-xl border border-[#E2D9C8] text-xs text-[#7A6C5D] pr-9">
                          💡 كيبورد جوجل يحتوي على أقوى محرك في العالم لفهم اللهجات العربية المختلفة بدقة متناهية.
                        </div>
                      </div>
                    )}

                    {guideStep === 2 && (
                      <div className="space-y-3" id="stt_step_2">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">٢</span>
                          تفعيل "الكتابة بالصوت" في إعدادات اللوحة
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          افتح الواتساب واضغط على مربع النص لتفتح الكيبورد. اضغط على أيقونة الترس (الإعدادات) الموجودة أعلى الكيبورد مباشرة، ثم اختر <strong className="text-[#2D241E]">"الكتابة بالصوت" (Voice typing)</strong> وتأكد من تفعيل خيار <strong className="text-[#4A6741]">"استخدام الكتابة بالصوت"</strong>.
                        </p>
                        <div className="bg-[#F5F1E9] p-3 rounded-xl border border-[#E2D9C8] text-xs text-[#7A6C5D] pr-9">
                          ⚙️ تأكد من أن لغة الجوال تدعم العربية في قسم اللغات للتحدث بالعامية أو الفصحى وفهمها فوراً.
                        </div>
                      </div>
                    )}

                    {guideStep === 3 && (
                      <div className="space-y-3" id="stt_step_3">
                        <h4 className="text-lg font-bold text-[#2D241E] flex items-center">
                          <span className="w-7 h-7 rounded-full bg-[#4A6741] text-white flex items-center justify-center ml-2 text-sm">٣</span>
                          طريقة الكتابة بالصوت داخل الواتساب
                        </h4>
                        <p className="text-[#5E5246] text-sm leading-relaxed pr-9">
                          ببساطة، عندما يريد الوالد الكتابة، يضغط على زر <strong className="text-[#2D241E]">المايكروفون الصغير الموجود على أقصى يسار أو يمين لوحة الكيبورد (وليس مايك الواتساب الصوتي الأخضر)</strong>. سيتحول المايك إلى اللون الأزرق ويبدأ بالاستماع، وبمجرد أن يتكلم، سيتم كتابة كلامه فوراً وحرفياً داخل مربع النص!
                        </p>
                        <div className="bg-[#F2F7F0] p-3 rounded-xl border border-[#4A6741]/20 text-xs text-[#4A6741] pr-9">
                          🎯 هذه الطريقة عملية للغاية وتغني الوالد عن مجهود الكتابة اليدوية المرهق في كافة التطبيقات كقوقل ومواقع التواصل والرسائل.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Guide Navigation */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E2D9C8]">
                    <button
                      id="prev_step_btn_stt"
                      disabled={guideStep === 1}
                      onClick={() => setGuideStep(p => Math.max(1, p - 1))}
                      className="px-4 py-2 bg-[#F5F1E9] hover:bg-[#EAE2D5] text-[#5E5246] text-xs font-bold rounded-xl border border-[#E2D9C8] disabled:opacity-40 transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex space-x-1.5 space-x-reverse">
                      {[1, 2, 3].map(idx => (
                        <div 
                           key={idx} 
                           onClick={() => setGuideStep(idx)}
                           className={`w-2 h-2 rounded-full cursor-pointer transition-all ${guideStep === idx ? 'w-6 bg-[#4A6741]' : 'bg-[#E2D9C8]'}`} 
                        />
                      ))}
                    </div>
                    {guideStep < 3 ? (
                      <button
                        id="next_step_btn_stt"
                        onClick={() => setGuideStep(p => Math.min(3, p + 1))}
                        className="px-4 py-2 bg-[#4A6741] hover:bg-[#3B5234] text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        التالي
                      </button>
                    ) : (
                      <button
                        id="test_simulator_btn_stt"
                        onClick={() => {
                          setActiveTab('stt');
                          document.getElementById('simulator_card')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-4 py-2 bg-[#4A6741] hover:bg-[#3B5234] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center"
                      >
                        اختبر المحاكاة الصوتية الآن 🎤
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QUICK PRESETS & TEXT MANAGER CARD */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E2D9C8]" id="presets_container">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-[#2D241E]">نصوص جاهزة لتجربة القراءة</h3>
                <p className="text-xs text-[#7A6C5D] mt-1">اضغط على أي نص أدناه لملء شاشة محاكاة قارئ الوالد فوراً</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-[#4A6741] text-white shadow' : 'bg-[#F5F1E9] text-[#5E5246] hover:bg-[#EAE2D5]'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPresets.map(preset => (
                <div 
                  key={preset.id}
                  onClick={() => {
                    setInputText(preset.content);
                    // scroll to the text box in the phone simulator
                    document.getElementById('phone_simulator_inner')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="p-4 bg-[#F5F1E9]/40 hover:bg-[#F2F7F0] rounded-2xl border border-[#E2D9C8] hover:border-[#4A6741] cursor-pointer transition-all duration-200 text-right group flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-[#4A6741] bg-[#F2F7F0] border border-[#4A6741]/20 px-2 py-0.5 rounded-full mb-2 inline-block">
                      {preset.category}
                    </span>
                    <h4 className="font-display font-bold text-sm text-[#2D241E] group-hover:text-[#4A6741] transition-colors">
                      {preset.title}
                    </h4>
                    <p className="text-xs text-[#7A6C5D] mt-2 line-clamp-3 leading-relaxed">
                      {preset.content}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-[#4A6741] text-left mt-3 group-hover:translate-x-[-4px] transition-transform flex items-center justify-end">
                    <span>انقر للمحاكاة</span>
                    <ChevronRight className="w-3.5 h-3.5 mr-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SHARE CARD FOR THE SON */}
          <div className="bg-gradient-to-br from-[#4A6741] to-[#3B5234] rounded-3xl p-6 text-white shadow-lg border border-[#2F4229]" id="share_card">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-right">
                <h3 className="text-2xl font-display font-black">افتح التطبيق من جوال الوالد الآن! 📱</h3>
                <p className="text-[#F2F7F0] text-sm mt-1 leading-relaxed">
                  امسح الرمز أو شارك الرابط ليفتح الوالد هذا الموقع على جواله الأندرويد مباشرة، ليجرب الصوت العالي، ويتدرب على كيفية التفعيل بنفسه بكل سهولة!
                </p>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <div className="bg-white p-3 rounded-2xl shadow-md border border-[#EAE2D5]">
                  {/* Real-time QR Code generation for the current URL */}
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.href)}`} 
                    alt="QR Code to scan" 
                    referrerPolicy="no-referrer"
                    className="w-28 h-28"
                  />
                </div>
                <button
                  id="share_link_btn"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="mt-3 px-4 py-1.5 bg-[#2F4229]/50 hover:bg-[#2F4229]/70 rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-1.5 animate-fade-in"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>تم نسخ الرابط!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>نسخ رابط المشاركة للواتس</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </section>

        {/* LEFT COLUMN: VIRTUAL ANDROID PHONE SIMULATOR (5/12) */}
        <section className="lg:col-span-5 flex justify-center sticky top-6" id="simulator_card">
          
          {/* Outer Phone Frame */}
          <div className="relative w-full max-w-[380px] h-[780px] bg-[#2D241E] rounded-[50px] p-3.5 shadow-2xl border-4 border-[#3E362E] ring-12 ring-[#2D241E] flex flex-col overflow-hidden">
            
            {/* Phone Front Camera Notch */}
            <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-[#2D241E] rounded-full z-30 flex items-center justify-between px-4">
              <div className="w-3.5 h-3.5 bg-slate-900 rounded-full border border-slate-850" />
              <div className="w-16 h-1 bg-slate-850 rounded-full" />
              <div className="w-2 h-2 bg-slate-900 rounded-full" />
            </div>

            {/* Simulated Android Status Bar */}
            <div className="h-10 bg-[#2D241E] rounded-t-[36px] px-6 pt-5 pb-2 flex justify-between items-center text-[11px] font-mono font-bold text-[#E2D9C8] select-none z-20">
              <span id="simulator_time">08:10 ص</span>
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <span className="text-[10px]">98%</span>
                <div className="w-5 h-2.5 bg-slate-700 rounded-sm p-0.5 border border-slate-600 flex items-center">
                  <div className="w-full h-full bg-[#4A6741] rounded-2xs" />
                </div>
                <span>📶</span>
              </div>
            </div>

            {/* Inner Android Application Screen */}
            <div 
              id="phone_simulator_inner"
              className="flex-1 bg-[#FDFBF7] rounded-[34px] flex flex-col overflow-hidden relative border border-[#2D241E] text-right text-[#3E362E] select-none"
            >
              {/* App Status Indicator inside simulator */}
              <div className="bg-[#4A6741] text-white py-1.5 px-4 text-[10px] font-bold text-center flex items-center justify-center border-b border-[#3B5234]">
                <Smartphone className="w-3.5 h-3.5 ml-1.5 text-[#EAE2D5]" />
                <span>شاشة محاكاة هاتف الوالد (تجربة حية)</span>
              </div>

              {/* SIMULATOR APPS / HEADER */}
              <div className="p-4 bg-[#F5F1E9] border-b border-[#E2D9C8] flex justify-between items-center shrink-0 shadow-xs">
                <div>
                  <h3 className="font-display font-black text-base text-[#2D241E]">تطبيق المساعد الصوتي</h3>
                  <p className="text-[10px] text-[#7A6C5D] font-medium">مُصمم لتسهيل القراءة والكتابة</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#4A6741]/10 border border-[#4A6741]/20 flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-[#4A6741]" />
                </div>
              </div>

              {/* SIMULATOR TAB SWITCHER */}
              <div className="p-2 bg-[#EAE2D5] flex rounded-xl m-3 border border-[#E2D9C8] shrink-0">
                <button
                  id="tab_tts_btn"
                  onClick={() => { setActiveTab('tts'); handleStopReading(); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${activeTab === 'tts' ? 'bg-white text-[#4A6741] shadow-xs' : 'text-[#5E5246] hover:text-[#2D241E]'}`}
                >
                  <FileText className="w-3.5 h-3.5 ml-1.5" />
                  قارئ النصوص
                </button>
                <button
                  id="tab_stt_btn"
                  onClick={() => { setActiveTab('stt'); handleStopReading(); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${activeTab === 'stt' ? 'bg-white text-[#4A6741] shadow-xs' : 'text-[#5E5246] hover:text-[#2D241E]'}`}
                >
                  <Mic className="w-3.5 h-3.5 ml-1.5" />
                  الكتابة بالصوت
                </button>
              </div>

              {/* MAIN SIMULATOR SCREEN CONTENT (SCROLLABLE) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24" id="simulator_scrollable">
                
                {/* --- TAB 1: TEXT TO SPEECH SIMULATOR --- */}
                {activeTab === 'tts' && (
                  <div className="space-y-4" id="tab_tts_content">
                    
                    {/* Input Label & Category Presets */}
                    <div>
                      <label className="block text-xs font-bold text-[#5E5246] mb-1.5">اكتب النص أو الصقه أدناه لقراءته:</label>
                      <textarea
                        id="tts_textarea"
                        value={inputText}
                        onChange={(e) => {
                          setInputText(e.target.value);
                          if (isPlaying) handleStopReading();
                        }}
                        placeholder="الصق أو اكتب النص هنا لتجربة الصوت الحقيقي للوالد..."
                        className="w-full h-36 p-3 text-sm border border-[#E2D9C8] rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-[#4A6741] focus:border-transparent text-right resize-none font-medium leading-relaxed text-[#3E362E]"
                      />
                    </div>

                    {/* Speech Highlighting Monitor inside text box (Only visible when playing) */}
                    {isPlaying && currentSentenceIndex !== -1 && sentences[currentSentenceIndex] && (
                      <div className="p-3 bg-[#F2F7F0] border border-[#4A6741]/30 rounded-2xl animate-fade-in">
                        <span className="text-[10px] font-bold text-[#4A6741] block mb-1">العبارة التي يتم قراءتها حالياً:</span>
                        <p className="text-sm font-semibold text-[#2D241E] leading-relaxed font-display">
                          {sentences[currentSentenceIndex]}
                        </p>
                      </div>
                    )}

                    {/* Speed Slider */}
                    <div className="bg-white p-3 rounded-2xl border border-[#E2D9C8] shadow-3xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-[#5E5246]">سرعة القراءة والصوت:</span>
                        <span className="text-xs font-mono font-bold text-[#4A6741] bg-[#F2F7F0] px-2 py-0.5 rounded-lg border border-[#4A6741]/20">{speechRate}x</span>
                      </div>
                      <input 
                        id="speed_range_slider"
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.25"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#F5F1E9] rounded-lg appearance-none cursor-pointer accent-[#4A6741] mt-2"
                      />
                      <div className="flex justify-between text-[10px] text-[#7A6C5D] font-bold mt-1 px-1">
                        <span>بطيء (0.5x)</span>
                        <span>طبيعي (1.0x)</span>
                        <span>سريع (2.0x)</span>
                      </div>
                    </div>

                    {/* Voice Persona Selector */}
                    <div>
                      <span className="block text-xs font-bold text-[#5E5246] mb-2">اختر نبرة الصوت المفضلة للوالد (أصوات رجال):</span>
                      <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1" id="voice_personas_list">
                        {VOICE_PERSONAS.map(persona => (
                          <div
                            key={persona.id}
                            id={`persona_card_${persona.id}`}
                            onClick={() => {
                              setSelectedVoiceId(persona.id);
                              if (isPlaying) handleStopReading();
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-right ${selectedVoiceId === persona.id ? 'bg-[#F2F7F0] border-[#4A6741] shadow-3xs' : 'bg-white border-[#E2D9C8]/80 hover:border-[#D9C5B2]'}`}
                          >
                            <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                              <div className={`w-8.5 h-8.5 rounded-xl border flex items-center justify-center shrink-0 ${persona.iconColor}`}>
                                <User className="w-4.5 h-4.5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-display font-bold text-xs text-[#2D241E] flex items-center">
                                  {persona.name}
                                  {selectedVoiceId === persona.id && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#4A6741] mr-1.5 animate-ping" />
                                  )}
                                </h4>
                                <p className="text-[10px] text-[#7A6C5D] truncate mt-0.5">{persona.title}</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-medium text-[#5E5246] bg-[#F5F1E9] border border-[#E2D9C8] px-1.5 py-0.5 rounded-md ml-1 shrink-0">
                              {persona.rate * speechRate}x سرعة
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Voice engine technical help tip */}
                    <div className="bg-[#F5F1E9] p-3 rounded-2xl border border-[#E2D9C8] text-[10.5px] text-[#5E5246] leading-relaxed">
                      💡 <strong>ملاحظة هامة لنبرة الصوت:</strong> قمنا بتغيير نبرات الصوت (الحدة، والعمق، والسرعة) برمجياً لتختلف تماماً بالمتصفح. وإذا كان جهازك مبرمجاً على صوت عربي واحد فقط، فيمكنك تفعيل محركات نطق متعددة أو تخصيص نبرة الصوت الافتراضية بسهولة من إعدادات الجوال (راجع دليل الإعداد في الجانب الأيمن!).
                    </div>

                    {/* Action Play Button */}
                    {!isPlaying ? (
                      <button
                        id="start_reading_btn"
                        onClick={handleStartReading}
                        className="w-full py-4 bg-gradient-to-l from-[#4A6741] to-[#3B5234] hover:from-[#3B5234] hover:to-[#2F4229] text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        <Volume2 className="w-5 h-5 text-[#F2F7F0]" />
                        <span>تشغيل القراءة بصوت {activePersona.name}</span>
                      </button>
                    ) : (
                      <button
                        id="stop_reading_btn"
                        onClick={handleStopReading}
                        className="w-full py-4 bg-[#2D241E] hover:bg-[#3E362E] text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        <VolumeX className="w-5 h-5 text-[#E2D9C8]" />
                        <span>إيقاف تشغيل القراءة بالكامل</span>
                      </button>
                    )}

                  </div>
                )}





                {/* --- TAB 2: SPEECH TO TEXT SIMULATOR --- */}
                {activeTab === 'stt' && (
                  <div className="space-y-4" id="tab_stt_content">
                    
                    {/* Important iframe permission note */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-[#5E5246] space-y-2">
                      <h5 className="font-bold text-[#2D241E] flex items-center">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600 ml-1.5 shrink-0" />
                        تنبيه فني هام للمايكروفون والكتابة الصالحة:
                      </h5>
                      <p className="leading-relaxed">
                        ١. إذا لم يستجب زر المايك بالأسفل، فهذا لأن المتصفح يمنع الصوت داخل نافذة المراجعة الصغيرة. يرجى الضغط على زر <strong className="text-[#4A6741]">"فتح التطبيق في نافذة مستقلة"</strong> بالأعلى ليعمل المايكروفون فوراً وبكفاءة كاملة!
                      </p>
                      <p className="leading-relaxed">
                        ٢. <strong className="text-[#2D241E]">للكتابة بالصوت مباشرة داخل الواتساب أو قوقل دون فتح هذا الموقع:</strong> يجب تفعيل كيبورد <strong className="text-[#4A6741]">Gboard</strong> (راجع خطوات الدليل التفصيلي بجانبك بالقسم 2) واستخدام مايك الكيبورد الصغير لتتكلم ويكتب هناك تلقائياً!
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[#E2D9C8] shadow-3xs space-y-3">
                      <div className="flex justify-between items-center border-b border-[#F5F1E9] pb-2">
                        <span className="text-xs font-bold text-[#5E5246]">مربع النص الصوتي الذكي</span>
                        {isRecording && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 flex items-center animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-1.5" />
                            المايك يسجل حالياً...
                          </span>
                        )}
                      </div>

                      <div className="min-h-[140px] text-right font-medium text-[#3E362E] text-sm leading-relaxed max-h-[220px] overflow-y-auto" id="dictation_output">
                        {transcribedText ? (
                          <p className="whitespace-pre-wrap">{transcribedText}</p>
                        ) : (
                          <p className="text-[#7A6C5D] italic text-xs py-4 text-center">
                            {isRecording ? "تكلم الآن بما تريده وسيقوم التطبيق بكتابته حرفياً..." : "اضغط على المايك بالأسفل وابدأ بالتحدث ليكتب كلامك تلقائياً."}
                          </p>
                        )}
                      </div>

                      {/* Microphone Pulsing Button */}
                      <div className="flex flex-col items-center justify-center py-4">
                        <button
                          id="mic_activation_btn"
                          onClick={handleToggleRecording}
                          className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all shadow-lg ${isRecording ? 'bg-rose-500 hover:bg-rose-600 animate-pulse-glow' : 'bg-[#2D241E] hover:bg-[#3E362E] hover:scale-105'}`}
                        >
                          <Mic className={`w-8.5 h-8.5 ${isRecording ? 'animate-bounce' : ''}`} />
                        </button>
                        <span className="text-[10px] font-bold text-[#7A6C5D] mt-3">
                          {isRecording ? 'انقر مجدداً لإنهاء الإملاء' : 'انقر للتحدث بالصوت'}
                        </span>
                      </div>

                      {/* Web API support notice inside the phone */}
                      {recognitionError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 flex items-start">
                          <AlertTriangle className="w-4 h-4 ml-1.5 shrink-0 mt-0.5" />
                          <span>{recognitionError}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons inside the simulator */}
                    <div className="grid grid-cols-2 gap-2" id="stt_action_buttons">
                      <button
                        id="copy_stt_text"
                        disabled={!transcribedText}
                        onClick={() => copyToClipboard(transcribedText, true)}
                        className="py-3 bg-white hover:bg-[#FDFBF7] border border-[#E2D9C8] text-[#5E5246] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-4xs"
                      >
                        {copiedTranscribed ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span>تم نسخ النص!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-[#7A6C5D]" />
                            <span>نسخ الكلام المكتوب</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        id="whatsapp_stt_text"
                        disabled={!transcribedText}
                        onClick={() => shareToWhatsApp(transcribedText)}
                        className="py-3 bg-[#4A6741] hover:bg-[#3B5234] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-4xs"
                      >
                        <MessageSquare className="w-4 h-4 text-[#F2F7F0]" />
                        <span>إرسال للواتساب</span>
                      </button>

                      <button
                        id="search_stt_text"
                        disabled={!transcribedText}
                        onClick={() => searchOnGoogle(transcribedText)}
                        className="py-3 bg-[#3B5234] hover:bg-[#2F4229] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-4xs"
                      >
                        <Search className="w-4 h-4 text-[#F2F7F0]" />
                        <span>بحث في قوقل</span>
                      </button>

                      <button
                        id="clear_stt_text"
                        disabled={!transcribedText}
                        onClick={handleClearTranscription}
                        className="py-3 bg-[#F5F1E9] hover:bg-[#EAE2D5] text-[#5E5246] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                      >
                        <RotateCcw className="w-4 h-4 text-[#7A6C5D]" />
                        <span>مسح وتنظيف النص</span>
                      </button>
                    </div>

                    {/* WhatsApp Simulator Frame */}
                    <div className="bg-[#F5F1E9] border border-[#E2D9C8] rounded-2xl p-3 relative overflow-hidden" id="wa_simulator">
                      <div className="bg-[#4A6741] text-white px-3 py-1.5 text-[10px] font-bold rounded-xl flex items-center justify-between shadow-3xs mb-2">
                        <span>محاكاة نافذة واتساب</span>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                      </div>
                      <div className="space-y-2 max-h-[100px] overflow-y-auto p-1 text-right">
                        <div className="bg-white p-2 rounded-xl rounded-tr-none text-xs text-slate-700 shadow-4xs max-w-[85%] mr-auto">
                          السلام عليكم يا والدي الغالي 🌸
                        </div>
                        {transcribedText && (
                          <div className="bg-[#F2F7F0] p-2 rounded-xl rounded-tl-none text-xs text-slate-800 shadow-4xs max-w-[85%] ml-auto animate-fade-in border border-[#4A6741]/10">
                            {transcribedText}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* --- FLOATING CONTROLLER TRANSPARENT SIMULATION PANEL --- */}
              {/* This is the key requested feature! Beautifully rendered within the screen */}
              {showFloatingWidget && (
                <div
                  ref={widgetRef}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  style={{
                    left: `${widgetPosition.x}px`,
                    top: `${widgetPosition.y}px`,
                    cursor: isDragging ? 'grabbing' : 'grab'
                  }}
                  id="floating_transparent_control_widget"
                  className="absolute z-40 w-[240px] rounded-2xl shadow-2xl border border-white/40 backdrop-blur-md bg-white/80 p-3 select-none flex flex-col space-y-2 transition-shadow duration-150 active:shadow-lg text-[#2D241E] font-sans"
                >
                  {/* Handle bar */}
                  <div className="flex justify-between items-center border-b border-[#2D241E]/10 pb-1.5">
                    <span className="text-[9px] font-bold text-[#4A6741] bg-[#4A6741]/10 px-1.5 py-0.5 rounded flex items-center border border-[#4A6741]/20">
                      <Smartphone className="w-2.5 h-2.5 ml-1" />
                      التحكم العائم الشفاف
                    </span>
                    <button 
                      id="close_floating_widget"
                      onClick={handleStopReading}
                      className="text-[#7A6C5D] hover:text-rose-600 p-0.5 rounded-full hover:bg-black/5 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Active Speaker Info */}
                  <div className="flex items-center space-x-2 space-x-reverse text-right">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4A6741] animate-ping shrink-0" />
                    <p className="text-[10px] font-bold text-[#2D241E] truncate">
                      يقرأ بصوت: <span className="text-[#4A6741]">{activePersona.name}</span>
                    </p>
                  </div>

                  {/* Controller Buttons */}
                  <div className="flex items-center justify-between gap-1 py-1">
                    {/* Rewind Button */}
                    <button
                      id="widget_rewind_btn"
                      onClick={handleRewind}
                      className="flex-1 p-2 bg-[#2D241E]/10 hover:bg-[#2D241E]/15 rounded-xl flex flex-col items-center justify-center transition-all group"
                      title="إرجاع 10 ثوانٍ"
                    >
                      <SkipBack className="w-4 h-4 text-[#2D241E] group-active:-translate-x-1 transition-transform" />
                      <span className="text-[8px] font-bold text-[#5E5246] mt-0.5">-10 ثوانٍ</span>
                    </button>

                    {/* Play / Pause Toggle */}
                    <button
                      id="widget_play_pause_btn"
                      onClick={handleTogglePause}
                      className="p-3 bg-[#4A6741] hover:bg-[#3B5234] text-white rounded-full flex items-center justify-center transition-all shadow-xs"
                      title={isPaused ? "تشغيل" : "إيقاف مؤقت"}
                    >
                      {isPaused ? (
                        <Play className="w-4.5 h-4.5 fill-current" />
                      ) : (
                        <Pause className="w-4.5 h-4.5 fill-current" />
                      )}
                    </button>

                    {/* Forward Button */}
                    <button
                      id="widget_forward_btn"
                      onClick={handleForward}
                      className="flex-1 p-2 bg-[#2D241E]/10 hover:bg-[#2D241E]/15 rounded-xl flex flex-col items-center justify-center transition-all group"
                      title="تقديم 10 ثوانٍ"
                    >
                      <SkipForward className="w-4 h-4 text-[#2D241E] group-active:translate-x-1 transition-transform" />
                      <span className="text-[8px] font-bold text-[#5E5246] mt-0.5">+10 ثوانٍ</span>
                    </button>
                  </div>

                  {/* Progress segment indicator */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold text-[#7A6C5D]">
                      <span>التقدم في النص:</span>
                      <span>
                        {sentences.length > 0 ? Math.round(((currentSentenceIndex + 1) / sentences.length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#2D241E]/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#4A6741] transition-all duration-300"
                        style={{
                          width: `${sentences.length > 0 ? ((currentSentenceIndex + 1) / sentences.length) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-[7.5px] text-center text-[#7A6C5D] bg-white/40 p-1 rounded font-medium">
                    🖐️ يمكنك سحب هذه اللوحة وتحريكها بأي اتجاه!
                  </div>
                </div>
              )}

              {/* Bottom Navigation Home Bar for Simulated Phone */}
              <div className="h-10 bg-[#F5F1E9] border-t border-[#E2D9C8] flex justify-around items-center shrink-0 text-[#7A6C5D] z-10">
                <button className="text-[#7A6C5D] font-bold">◁</button>
                <div className="w-4 h-4 rounded-full border-2 border-[#E2D9C8]" />
                <div className="w-3.5 h-3.5 bg-[#E2D9C8] rounded-xs" />
              </div>

            </div>
          </div>

        </section>

      </main>

      {/* FOOTER SECTION */}
      <footer className="w-full max-w-7xl text-center py-6 border-t border-[#E2D9C8] mt-auto text-xs text-[#7A6C5D] font-medium">
        <p>© {new Date().getFullYear()} - تطبيق مساعد أندرويد الصوتي للأب الغالي. صُمم بامتياز لمساعدة كبار السن وتسهيل الحياة الرقمية.</p>
      </footer>

    </div>
  );
}
