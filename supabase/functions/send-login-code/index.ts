import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin email for notifications
const ADMIN_EMAIL = "salmitasotelo15@gmail.com";

interface LoginRequest {
  username: string;
  password: string;
  userAgent?: string;
}

interface VerifyRequest {
  code: string;
  staffId: string;
}

const generateCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Deja-Vu Sistema <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "request") {
      // Step 1: Validate credentials from staff table and send code
      const { username, password, userAgent }: LoginRequest = await req.json();
      
      console.log(`Login attempt for user: ${username}`);

      // Find staff member in database
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select(`
          id,
          username,
          password_hash,
          full_name,
          email,
          is_active
        `)
        .eq("username", username)
        .single();

      if (staffError || !staffData) {
        console.log("User not found");
        return new Response(
          JSON.stringify({ error: "Credenciales inválidas" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is active
      if (!staffData.is_active) {
        console.log("User is inactive");
        return new Response(
          JSON.stringify({ error: "Usuario desactivado. Contacte al administrador." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password (direct comparison for simplicity - consider hashing in production)
      if (staffData.password_hash !== password) {
        console.log("Invalid password");
        return new Response(
          JSON.stringify({ error: "Credenciales inválidas" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("staff_id", staffData.id);

      const roles = rolesData?.map(r => r.role) || [];
      const isAdmin = roles.includes("admin");

      // Generate 6-digit code
      const code = generateCode();
      console.log(`Generated verification code for login attempt`);

      // Store code in database with staff_id reference
      const { error: insertError } = await supabase
        .from("login_verification_codes")
        .insert({
          code,
          user_agent: userAgent || "Unknown",
        });

      if (insertError) {
        console.error("Error storing code:", insertError);
        throw new Error("Error al generar código de verificación");
      }

      // Send email to admin (always notify admin for security)
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #8B5CF6; text-align: center;">🍷 Deja-Vu Retro Pub</h1>
          <h2 style="text-align: center; color: #333;">Código de Verificación</h2>
          
          <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Usuario:</strong> ${staffData.full_name} (${username})<br>
              <strong>Rol:</strong> ${roles.join(", ") || "Sin rol asignado"}
            </p>
          </div>
          
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <p style="color: white; font-size: 14px; margin: 0 0 10px 0;">Código de acceso:</p>
            <p style="color: white; font-size: 48px; font-weight: bold; letter-spacing: 8px; margin: 0;">${code}</p>
          </div>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Dispositivo:</strong> ${userAgent || "Desconocido"}<br>
              <strong>Fecha:</strong> ${new Date().toLocaleString("es-ES", { timeZone: "America/La_Paz" })}
            </p>
          </div>
          
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            Este código expira en 10 minutos. Si no reconoces este intento de acceso, ignora este mensaje.
          </p>
        </div>
      `;

      await sendEmail(ADMIN_EMAIL, `🔐 Código de Acceso - ${staffData.full_name}`, emailHtml);
      console.log("Email sent successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Código enviado al administrador",
          staffId: staffData.id,
          staffName: staffData.full_name,
          roles: roles
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "verify") {
      // Step 2: Verify the code
      const { code, staffId }: VerifyRequest = await req.json();
      
      console.log(`Verifying code attempt for staff: ${staffId}`);

      // Find valid code
      const { data: codeData, error: selectError } = await supabase
        .from("login_verification_codes")
        .select("*")
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (selectError || !codeData) {
        console.log("Invalid or expired code");
        return new Response(
          JSON.stringify({ error: "Código inválido o expirado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark code as used
      await supabase
        .from("login_verification_codes")
        .update({ used: true })
        .eq("id", codeData.id);

      // Get staff details and roles
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, username, full_name, email")
        .eq("id", staffId)
        .single();

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("staff_id", staffId);

      const roles = rolesData?.map(r => r.role) || [];

      console.log("Code verified successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Código verificado correctamente",
          staff: staffData,
          roles: roles
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Acción no válida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Error in send-login-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
