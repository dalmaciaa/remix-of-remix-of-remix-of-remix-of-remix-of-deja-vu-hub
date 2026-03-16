import { useCallback, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Share2, Eye, Loader2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import logoSrc from '@/assets/logo-dejavu.png';

const CATEGORY_LABELS: Record<string, string> = {
  drinks: '🍺 Bebidas',
  cocktails: '🍸 Tragos',
  food: '🍔 Comidas',
  others: '📦 Otros',
};

const CATEGORY_ORDER = ['food', 'cocktails', 'drinks', 'others'];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface ProductForMenu {
  name: string;
  salePrice: number;
  category: string;
}

async function generateMenuCanvas(products: ProductForMenu[]): Promise<HTMLCanvasElement> {
  const W = 1080;
  const PADDING = 80;
  const CONTENT_W = W - PADDING * 2;

  // Group by category
  const grouped: Record<string, ProductForMenu[]> = {};
  for (const p of products) {
    const cat = p.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  const categories = CATEGORY_ORDER.filter(c => grouped[c]?.length);

  // Calculate height
  let totalItems = 0;
  categories.forEach(c => { totalItems += grouped[c].length; });
  const HEADER_H = 420;
  const CAT_HEADER_H = 90;
  const ITEM_H = 60;
  const CAT_GAP = 40;
  const FOOTER_H = 120;
  const H = HEADER_H + categories.length * (CAT_HEADER_H + CAT_GAP) + totalItems * ITEM_H + FOOTER_H + 60;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1025');
  grad.addColorStop(0.5, '#12081f');
  grad.addColorStop(1, '#0a0510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative accents
  ctx.globalAlpha = 0.06;
  const rg1 = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, 500);
  rg1.addColorStop(0, '#a855f7');
  rg1.addColorStop(1, 'transparent');
  ctx.fillStyle = rg1;
  ctx.fillRect(0, 0, W, H);
  const rg2 = ctx.createRadialGradient(W * 0.15, H * 0.8, 0, W * 0.15, H * 0.8, 400);
  rg2.addColorStop(0, '#ec4899');
  rg2.addColorStop(1, 'transparent');
  ctx.fillStyle = rg2;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Border
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
  ctx.lineWidth = 3;
  ctx.roundRect(30, 30, W - 60, H - 60, 30);
  ctx.stroke();

  // Logo
  let y = 80;
  try {
    const logo = await loadImage(logoSrc);
    const logoSize = 180;
    ctx.drawImage(logo, (W - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 20;
  } catch {
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 50px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEJA-VU', W / 2, y + 60);
    y += 90;
  }

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText('DEJA-VU RETRO PUB', W / 2, y);
  y += 50;

  ctx.fillStyle = '#f5f0ff';
  ctx.font = 'bold 56px Inter, sans-serif';
  ctx.fillText('NUESTRA CARTA', W / 2, y);
  y += 30;

  // Divider
  const divGrad = ctx.createLinearGradient(PADDING, y, W - PADDING, y);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.5)');
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(W - PADDING, y);
  ctx.stroke();
  y += 40;

  // Categories and items
  for (const cat of categories) {
    const items = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
    const label = CATEGORY_LABELS[cat] || cat;

    // Category header bg
    ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
    ctx.beginPath();
    ctx.roundRect(PADDING, y, CONTENT_W, CAT_HEADER_H - 20, 12);
    ctx.fill();

    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 34px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, y + 48);
    y += CAT_HEADER_H;

    // Items
    for (const item of items) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8e0f0';
      ctx.font = '400 28px Inter, sans-serif';
      const name = item.name.length > 35 ? item.name.substring(0, 33) + '…' : item.name;
      ctx.fillText(name, PADDING + 20, y + 20);

      // Dotted line
      const nameW = ctx.measureText(name).width;
      const priceStr = `$${item.salePrice.toLocaleString('es-AR')}`;
      ctx.font = 'bold 28px Inter, sans-serif';
      const priceW = ctx.measureText(priceStr).width;
      
      const dotsStart = PADDING + 20 + nameW + 10;
      const dotsEnd = W - PADDING - 20 - priceW - 10;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.font = '28px Inter, sans-serif';
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        ctx.fillText('·', dotX, y + 20);
        dotX += 12;
      }

      // Price
      ctx.textAlign = 'right';
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillText(priceStr, W - PADDING - 20, y + 20);

      y += ITEM_H;
    }

    y += CAT_GAP;
  }

  // QR code linking to published site
  const qrSize = 200;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(window.location.origin + '/menu')}&bgcolor=ffffff&color=1a1025&margin=8`;
  try {
    const qrImg = await loadImage(qrUrl);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect((W - qrSize - 40) / 2, y - 10, qrSize + 40, qrSize + 60, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect((W - qrSize) / 2, y, qrSize, qrSize, 10);
    ctx.fill();
    ctx.drawImage(qrImg, (W - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 20;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 20px Inter, sans-serif';
    ctx.fillText('Escaneá para ver el menú digital', W / 2, y);
  } catch {
    // skip QR
  }

  // Footer
  y += 40;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '400 18px Inter, sans-serif';
  ctx.fillText('Los precios pueden variar sin previo aviso', W / 2, y);

  return canvas;
}

export default function MenuGenerator() {
  const { data: products, isLoading } = useProducts();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const saleProducts = (products || []).filter(p => (p as any).isForSale !== false)
    .filter(p => !['supplies', 'semi_elaborated'].includes(p.category))
    .filter(p => p.salePrice > 0);

  const getMenuProducts = useCallback((): ProductForMenu[] => {
    return saleProducts.map(p => ({
      name: p.name,
      salePrice: p.salePrice,
      category: p.category,
    }));
  }, [saleProducts]);

  const handlePreview = useCallback(async () => {
    setGenerating(true);
    try {
      const canvas = await generateMenuCanvas(getMenuProducts());
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al generar vista previa', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [getMenuProducts, toast]);

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      const canvas = await generateMenuCanvas(getMenuProducts());
      const link = document.createElement('a');
      link.download = `menu-dejavu-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'Menú descargado' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al generar menú', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [getMenuProducts, toast]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const canvas = await generateMenuCanvas(getMenuProducts());
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'menu-dejavu.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Menú Deja-Vu', files: [file] });
        } else {
          handleDownload();
        }
        setGenerating(false);
      }, 'image/png');
    } catch {
      handleDownload();
      setGenerating(false);
    }
  }, [getMenuProducts, handleDownload]);

  return (
    <Layout>
      <PageHeader title="Generador de Menú" description="Generá una imagen del menú con todos los productos de venta y sus precios" />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORY_ORDER.map(cat => {
            const count = saleProducts.filter(p => p.category === cat).length;
            if (count === 0) return null;
            return (
              <Card key={cat}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{count}</p>
                  <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handlePreview} disabled={generating || isLoading || saleProducts.length === 0}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
            Vista Previa
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={generating || isLoading || saleProducts.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </Button>
          <Button variant="outline" onClick={handleShare} disabled={generating || isLoading || saleProducts.length === 0}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>
        </div>

        {saleProducts.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No hay productos de venta para mostrar en el menú. Agregá productos desde el Catálogo.
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {previewUrl && (
          <Card>
            <CardContent className="p-4 flex justify-center">
              <img src={previewUrl} alt="Vista previa del menú" className="max-w-full max-h-[80vh] rounded-lg shadow-lg" />
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
