import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Bot, User, ImagePlus, X, Loader2, Sparkles, Zap, Package, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

const quickActions = [
  { icon: Package, label: '¿Stock bajo?', prompt: '¿Cuáles productos tienen stock bajo o crítico?' },
  { icon: DollarSign, label: 'Ventas de hoy', prompt: '¿Cuánto vendimos hoy? Dame un resumen completo.' },
  { icon: Users, label: 'Resumen personal', prompt: 'Dame un resumen del personal activo y sus roles.' },
  { icon: Zap, label: 'Resumen general', prompt: 'Dame un resumen ejecutivo completo del estado del negocio.' },
];

export default function AdminAssistant() {
  const { currentStaff, isAdminUser } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isAdminUser()) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">No tienes acceso a esta sección.</p>
        </div>
      </Layout>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Imagen muy grande', description: 'Máximo 5MB por imagen', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const sendMessage = async (overrideInput?: string) => {
    const trimmed = (overrideInput || input).trim();
    if (!trimmed && images.length === 0) return;
    if (!currentStaff) return;

    const userMsg: Message = { role: 'user', content: trimmed, images: images.length > 0 ? [...images] : undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImages([]);
    setIsLoading(true);

    const apiMessages = [...messages, userMsg].map(m => {
      if (m.images && m.images.length > 0) {
        return {
          role: m.role,
          content: [
            { type: 'text' as const, text: m.content || 'Analiza esta imagen' },
            ...m.images.map(img => ({ type: 'image_url' as const, image_url: { url: img } }))
          ]
        };
      }
      return { role: m.role, content: m.content };
    });

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages, staffId: currentStaff.id }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error al comunicarse con el asistente');
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Layout>
      <PageHeader title="Asistente IA" description="Tu copiloto inteligente con acceso total al sistema" />

      <div className="flex flex-col h-[calc(100vh-12rem)] bg-card rounded-xl border border-border overflow-hidden shadow-lg">
        <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-card animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Asistente de Administración</h3>
                <p className="text-sm text-muted-foreground max-w-lg mt-2 leading-relaxed">
                  Puedo crear productos, ajustar stock, registrar gastos, gestionar personal y mucho más. 
                  Pedime lo que necesites y lo hago al instante.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-2">
                {quickActions.map(q => (
                  <Button
                    key={q.label}
                    variant="outline"
                    className="h-auto py-3 px-4 flex flex-col items-start gap-1 text-left hover:bg-primary/5 hover:border-primary/30 transition-all"
                    onClick={() => sendMessage(q.prompt)}
                  >
                    <q.icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">{q.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-2xl text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground px-4 py-3'
                    : 'bg-muted/60 border border-border/50 px-5 py-4'
                )}>
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {msg.images.map((img, j) => (
                        <img key={j} src={img} alt="upload" className="w-24 h-24 object-cover rounded-lg border border-border/30" />
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90 prose-code:bg-background/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-background/80 prose-pre:border prose-pre:border-border/30 prose-table:text-xs prose-th:bg-muted prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-td:border-border/30 prose-hr:border-border/30">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted/60 border border-border/50 rounded-2xl px-5 py-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Procesando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {images.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-border/50" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-border bg-background/50">
          <div className="flex gap-2 items-end">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pedime lo que necesites... crear productos, ajustar stock, analizar ventas..."
              className="min-h-[44px] max-h-32 resize-none rounded-xl"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && images.length === 0)}
              className="shrink-0 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
