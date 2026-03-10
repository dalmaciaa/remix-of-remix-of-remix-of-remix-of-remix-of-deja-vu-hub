import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, staffId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("staff_id", staffId);

    const isAdmin = roleData?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current data context for the AI
    const [
      { data: products },
      { data: sales },
      { data: staff },
      { data: expenses },
      { data: inventory },
    ] = await Promise.all([
      supabase.from("products").select("name, category, quantity, min_stock, sale_price, purchase_price, status, is_for_sale").limit(100),
      supabase.from("sales").select("id, total_amount, payment_method, payment_status, staff_name, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("staff").select("id, full_name, username, is_active").eq("is_active", true),
      supabase.from("expenses").select("amount, category, description, payment_method, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("inventory_purchases").select("product_name, quantity, purchase_price, total_cost, created_at").order("created_at", { ascending: false }).limit(30),
    ]);

    const systemPrompt = `Eres el asistente inteligente de administración del pub "Deja-Vu Retro Pub". 
Tu rol es ayudar al administrador con consultas sobre el negocio, análisis de datos, y sugerencias.

DATOS ACTUALES DEL SISTEMA:

PRODUCTOS (${products?.length || 0} productos):
${JSON.stringify(products || [], null, 2)}

ÚLTIMAS VENTAS (${sales?.length || 0}):
${JSON.stringify(sales || [], null, 2)}

PERSONAL ACTIVO:
${JSON.stringify(staff || [], null, 2)}

ÚLTIMOS GASTOS:
${JSON.stringify(expenses || [], null, 2)}

ÚLTIMAS COMPRAS DE INVENTARIO:
${JSON.stringify(inventory || [], null, 2)}

INSTRUCCIONES:
- Responde siempre en español
- Sé conciso pero informativo
- Si te piden análisis, usa los datos reales proporcionados
- Si te envían una foto del inventario, analízala y compara con los datos del sistema
- Si te piden cargar datos o hacer cambios, explica exactamente qué cambios se necesitan
- Puedes hacer cálculos, comparaciones, detectar inconsistencias
- Sugiere mejoras basándote en los datos`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes alcanzado, intenta en unos minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
