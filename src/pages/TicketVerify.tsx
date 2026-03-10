import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useVerifyTicket, type Ticket, type TicketEvent } from '@/hooks/useTickets';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, CheckCircle2, XCircle, ScanLine, Keyboard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TicketVerify() {
  const { currentStaff } = useAuth();
  const verifyTicket = useVerifyTicket();
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<{ valid: boolean; reason: string; ticket: any } | null>(null);
  const [mode, setMode] = useState<'scan' | 'manual'>('manual');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);

  const handleVerify = async (code: string) => {
    if (!code.trim() || !currentStaff) return;
    const res = await verifyTicket.mutateAsync({ ticketCode: code.trim().toUpperCase(), staffId: currentStaff.id });
    setResult(res);
    setManualCode('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(manualCode);
  };

  // Camera scanning with BarcodeDetector API
  useEffect(() => {
    if (mode !== 'scan' || !scanning) return;

    let stream: MediaStream | null = null;
    let animationId: number;
    let stopped = false;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Try BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

          const scan = async () => {
            if (stopped || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                if (code) {
                  setScanning(false);
                  handleVerify(code);
                  return;
                }
              }
            } catch {}
            animationId = requestAnimationFrame(scan);
          };
          animationId = requestAnimationFrame(scan);
        }
      } catch (err) {
        console.error('Camera error:', err);
        setMode('manual');
      }
    };

    startCamera();

    return () => {
      stopped = true;
      cancelAnimationFrame(animationId);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [mode, scanning]);

  const ticketEvent = result?.ticket?.ticket_events as TicketEvent | undefined;

  return (
    <Layout>
      <PageHeader title="Verificar Entradas" description="Escanea el QR o ingresa el código manualmente" />

      <div className="max-w-lg mx-auto space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => { setMode('manual'); setScanning(false); }}
            className="flex-1"
          >
            <Keyboard className="w-4 h-4 mr-2" />Manual
          </Button>
          <Button
            variant={mode === 'scan' ? 'default' : 'outline'}
            onClick={() => { setMode('scan'); setScanning(true); setResult(null); }}
            className="flex-1"
          >
            <Camera className="w-4 h-4 mr-2" />Cámara
          </Button>
        </div>

        {/* Manual input */}
        {mode === 'manual' && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <Label>Código de entrada</Label>
                  <Input
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value.toUpperCase())}
                    placeholder="Ingresa el código (ej: ABC123XYZ)"
                    className="font-mono text-lg tracking-widest text-center"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={verifyTicket.isPending || !manualCode.trim()}>
                  <ScanLine className="w-4 h-4 mr-2" />
                  {verifyTicket.isPending ? 'Verificando...' : 'Verificar Entrada'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Camera */}
        {mode === 'scan' && (
          <Card>
            <CardContent className="pt-6">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-primary rounded-lg animate-pulse" />
                  </div>
                )}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">
                Apunta la cámara al código QR de la entrada
              </p>
              {!scanning && (
                <Button onClick={() => { setScanning(true); setResult(null); }} className="w-full mt-3">
                  Escanear otra vez
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className={`border-2 ${result.valid ? 'border-green-500 bg-green-500/5' : 'border-destructive bg-destructive/5'}`}>
            <CardContent className="pt-6 text-center space-y-3">
              {result.valid ? (
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              ) : (
                <XCircle className="w-16 h-16 text-destructive mx-auto" />
              )}
              <p className={`text-xl font-bold ${result.valid ? 'text-green-600' : 'text-destructive'}`}>
                {result.reason}
              </p>

              {result.ticket && (
                <div className="text-left space-y-2 mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Código:</span>
                    <span className="font-mono font-bold">{result.ticket.ticket_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Titular:</span>
                    <span className="font-medium">{result.ticket.holder_name}</span>
                  </div>
                  {result.ticket.holder_dni && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DNI:</span>
                      <span>{result.ticket.holder_dni}</span>
                    </div>
                  )}
                  {ticketEvent && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Evento:</span>
                      <span>{ticketEvent.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio:</span>
                    <span>${result.ticket.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado:</span>
                    <Badge variant={result.valid ? 'default' : 'destructive'}>
                      {result.ticket.status === 'valid' ? 'Válida' :
                       result.ticket.status === 'used' ? 'Usada' :
                       result.ticket.status === 'expired' ? 'Expirada' : 'Cancelada'}
                    </Badge>
                  </div>
                </div>
              )}

              <Button onClick={() => { setResult(null); if (mode === 'scan') setScanning(true); }} variant="outline" className="w-full mt-4">
                Verificar otra entrada
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
