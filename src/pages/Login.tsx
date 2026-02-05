import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, KeyRound, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import logoDejaVu from '@/assets/logo-dejavu.png';
const loginSchema = z.object({
  username: z.string().min(1, {
    message: 'Usuario requerido'
  }),
  password: z.string().min(1, {
    message: 'Contraseña requerida'
  })
});
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const {
    requestLogin,
    verifyCode,
    isAuthenticated,
    isLoading,
    pendingVerification,
    logout
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = loginSchema.safeParse({
      username,
      password
    });
    if (!validation.success) {
      toast({
        title: "Error de validación",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }
    const {
      error
    } = await requestLogin(username, password);
    if (error) {
      toast({
        title: "Error de acceso",
        description: error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Código enviado",
        description: "Se ha enviado un código de verificación al propietario"
      });
    }
  };
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast({
        title: "Error",
        description: "Ingresa el código de 6 dígitos",
        variant: "destructive"
      });
      return;
    }
    const {
      error
    } = await verifyCode(verificationCode);
    if (error) {
      toast({
        title: "Error de verificación",
        description: error,
        variant: "destructive"
      });
      setVerificationCode('');
    } else {
      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente"
      });
      navigate('/');
    }
  };
  const handleBack = () => {
    logout();
    setVerificationCode('');
  };
  return <div className="min-h-screen bg-background p-4 flex items-end justify-center gap-0">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8 px-0">
            <img src={logoDejaVu} alt="Deja-Vu Retro Pub" className="w-48 h-auto mb-2 object-cover" />
          </div>

          {!pendingVerification ?
        // Step 1: Login Form
        <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="username" type="text" placeholder="Ingresa tu usuario" value={username} onChange={e => setUsername(e.target.value)} className="pl-10" required maxLength={50} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="Ingresa tu contraseña" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required maxLength={128} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
              </Button>
            </form> :
        // Step 2: Verification Code Form
        <form onSubmit={handleVerifySubmit} className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Se ha enviado un código de verificación al propietario.
                  Ingresa el código de 6 dígitos para continuar.
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verificationCode} onChange={value => setVerificationCode(value)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || verificationCode.length !== 6}>
                {isLoading ? 'Verificando...' : 'Verificar Código'}
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </form>}

          <p className="text-xs text-muted-foreground text-center mt-6">Sistema de Gestión v35.7.0</p>
        </div>
      </div>
    </div>;
}