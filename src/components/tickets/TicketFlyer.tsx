import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Ticket, TicketEvent } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import logoSrc from '@/assets/logo-dejavu.png';

interface TicketFlyerProps {
  ticket: Ticket;
  event: TicketEvent;
  variant?: 'icon' | 'button';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function generateFlyer(ticket: Ticket, event: TicketEvent): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1025');
  grad.addColorStop(0.4, '#12081f');
  grad.addColorStop(1, '#0a0510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative accent circles
  ctx.globalAlpha = 0.08;
  const radGrad = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, 400);
  radGrad.addColorStop(0, '#a855f7');
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, W, H);

  const radGrad2 = ctx.createRadialGradient(W * 0.2, H * 0.7, 0, W * 0.2, H * 0.7, 350);
  radGrad2.addColorStop(0, '#ec4899');
  radGrad2.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad2;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Border glow
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
  ctx.lineWidth = 3;
  ctx.roundRect(30, 30, W - 60, H - 60, 30);
  ctx.stroke();

  // Inner border
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
  ctx.lineWidth = 1;
  ctx.roundRect(45, 45, W - 90, H - 90, 25);
  ctx.stroke();

  // Load logo
  try {
    const logo = await loadImage(logoSrc);
    const logoSize = 220;
    const logoX = (W - logoSize) / 2;
    ctx.drawImage(logo, logoX, 100, logoSize, logoSize);
  } catch {
    // fallback text if logo fails
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEJA-VU', W / 2, 220);
  }

  // "DEJA-VU RETRO PUB" text
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('DEJA-VU RETRO PUB', W / 2, 370);

  // Divider line
  const divY = 410;
  const divGrad = ctx.createLinearGradient(100, divY, W - 100, divY);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.5)');
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, divY);
  ctx.lineTo(W - 100, divY);
  ctx.stroke();

  // "ENTRADA" label
  ctx.fillStyle = 'rgba(236, 72, 153, 0.9)';
  ctx.font = '500 24px Inter, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('✦  E N T R A D A  ✦', W / 2, 470);

  // Event name
  ctx.fillStyle = '#f5f0ff';
  ctx.font = 'bold 64px Inter, sans-serif';
  const eventName = event.name.toUpperCase();
  // Word wrap for long names
  const words = eventName.split(' ');
  let lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > W - 160) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  let textY = 560;
  for (const line of lines) {
    ctx.fillText(line, W / 2, textY);
    textY += 75;
  }

  // Date and time
  const eventDate = new Date(event.event_date);
  const dateStr = format(eventDate, "EEEE dd 'de' MMMM", { locale: es }).toUpperCase();
  const timeStr = format(eventDate, "HH:mm 'HS'");

  textY += 20;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '500 30px Inter, sans-serif';
  ctx.fillText(dateStr, W / 2, textY);

  textY += 55;
  ctx.fillStyle = '#a855f7';
  ctx.font = 'bold 52px Inter, sans-serif';
  ctx.fillText(timeStr, W / 2, textY);

  // Venue
  if (event.venue) {
    textY += 50;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '400 26px Inter, sans-serif';
    ctx.fillText(`📍 ${event.venue}`, W / 2, textY);
  }

  // Divider 2
  textY += 50;
  const div2Grad = ctx.createLinearGradient(150, textY, W - 150, textY);
  div2Grad.addColorStop(0, 'transparent');
  div2Grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
  div2Grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = div2Grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, textY);
  ctx.lineTo(W - 150, textY);
  ctx.stroke();

  // Holder info
  textY += 55;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText('TITULAR', W / 2, textY);

  textY += 45;
  ctx.fillStyle = '#f5f0ff';
  ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText(ticket.holder_name.toUpperCase(), W / 2, textY);

  if (ticket.holder_dni) {
    textY += 40;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillText(`DNI: ${ticket.holder_dni}`, W / 2, textY);
  }

  // QR Code
  const qrSize = 350;
  const qrX = (W - qrSize) / 2;
  const qrY = textY + 50;

  // QR background card
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.roundRect(qrX - 30, qrY - 20, qrSize + 60, qrSize + 90, 20);
  ctx.fill();

  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(ticket.ticket_code)}&bgcolor=ffffff&color=1a1025&margin=10`;
    const qrImg = await loadImage(qrUrl);
    // White bg for QR
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
    ctx.fill();
    ctx.fillStyle = '#1a1025';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(ticket.ticket_code, W / 2, qrY + qrSize / 2);
  }

  // Ticket code below QR
  const codeY = qrY + qrSize + 40;
  ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
  ctx.font = '600 28px monospace';
  ctx.fillText(ticket.ticket_code, W / 2, codeY);

  // Price badge
  const priceY = codeY + 60;
  ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
  const priceText = `$${ticket.price.toLocaleString()}`;
  ctx.font = 'bold 36px Inter, sans-serif';
  const priceW = ctx.measureText(priceText).width + 60;
  ctx.roundRect((W - priceW) / 2, priceY - 30, priceW, 50, 25);
  ctx.fill();
  ctx.fillStyle = '#a855f7';
  ctx.fillText(priceText, W / 2, priceY + 5);

  // Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '400 20px Inter, sans-serif';
  ctx.fillText('Presentá este QR en la entrada para ingresar', W / 2, H - 80);

  return canvas;
}

export function TicketFlyer({ ticket, event, variant = 'icon' }: TicketFlyerProps) {
  const { toast } = useToast();

  const handleDownload = useCallback(async () => {
    try {
      const canvas = await generateFlyer(ticket, event);
      const link = document.createElement('a');
      link.download = `entrada-${event.name.replace(/\s+/g, '-').toLowerCase()}-${ticket.ticket_code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'Flyer descargado' });
    } catch (err) {
      console.error('Error generating flyer:', err);
      toast({ title: 'Error al generar flyer', variant: 'destructive' });
    }
  }, [ticket, event, toast]);

  const handleShare = useCallback(async () => {
    try {
      const canvas = await generateFlyer(ticket, event);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `entrada-${ticket.ticket_code}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Entrada - ${event.name}`,
            text: `Tu entrada para ${event.name}`,
            files: [file],
          });
        } else {
          // Fallback to download
          handleDownload();
        }
      }, 'image/png');
    } catch {
      handleDownload();
    }
  }, [ticket, event, handleDownload]);

  if (variant === 'icon') {
    return (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={handleDownload} title="Descargar flyer">
          <Download className="w-4 h-4 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleShare} title="Compartir">
          <Share2 className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="w-4 h-4 mr-2" />Descargar Flyer
      </Button>
      <Button variant="outline" size="sm" onClick={handleShare}>
        <Share2 className="w-4 h-4 mr-2" />Compartir
      </Button>
    </div>
  );
}
