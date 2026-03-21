import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Define all tools the AI can use
const tools = [
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Crear un nuevo producto en el inventario",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del producto" },
          category: { type: "string", enum: ["drinks", "cocktails", "food", "supplies", "others", "semi_elaborated"], description: "Categoría" },
          sale_price: { type: "number", description: "Precio de venta" },
          purchase_price: { type: "number", description: "Precio de compra" },
          quantity: { type: "number", description: "Cantidad inicial en stock" },
          min_stock: { type: "number", description: "Stock mínimo antes de alerta" },
          is_for_sale: { type: "boolean", description: "Si está disponible para venta" },
          requires_kitchen: { type: "boolean", description: "Si requiere preparación en cocina" },
        },
        required: ["name", "category", "sale_price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product",
      description: "Actualizar un producto existente (por nombre o ID)",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nombre del producto a buscar" },
          product_id: { type: "string", description: "ID UUID del producto (si se conoce)" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              sale_price: { type: "number" },
              purchase_price: { type: "number" },
              quantity: { type: "number" },
              min_stock: { type: "number" },
              is_for_sale: { type: "boolean" },
              requires_kitchen: { type: "boolean" },
              category: { type: "string", enum: ["drinks", "cocktails", "food", "supplies", "others", "semi_elaborated"] },
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_product",
      description: "Eliminar un producto del inventario",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nombre del producto" },
          product_id: { type: "string", description: "ID UUID del producto" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_stock",
      description: "Ajustar el stock de un producto (agregar o quitar cantidad)",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nombre del producto" },
          new_quantity: { type: "number", description: "Nueva cantidad total" },
          reason: { type: "string", enum: ["loss", "internal_consumption", "breakage", "correction"], description: "Razón del ajuste" },
          notes: { type: "string", description: "Notas adicionales" },
        },
        required: ["product_name", "new_quantity", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_expense",
      description: "Registrar un nuevo gasto",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Monto del gasto" },
          category: { type: "string", enum: ["drinks", "suppliers", "staff", "events", "maintenance", "others"], description: "Categoría" },
          description: { type: "string", description: "Descripción del gasto" },
          payment_method: { type: "string", enum: ["cash", "transfer", "qr"], description: "Método de pago" },
        },
        required: ["amount", "category", "payment_method"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_staff",
      description: "Crear un nuevo miembro del personal",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string", description: "Nombre completo" },
          username: { type: "string", description: "Nombre de usuario para login" },
          password: { type: "string", description: "Contraseña" },
          roles: { type: "array", items: { type: "string", enum: ["admin", "mozo", "cocina", "bartender", "cajero"] }, description: "Roles asignados" },
          email: { type: "string", description: "Email (opcional)" },
          phone: { type: "string", description: "Teléfono (opcional)" },
        },
        required: ["full_name", "username", "password", "roles"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_staff",
      description: "Actualizar datos de un miembro del personal",
      parameters: {
        type: "object",
        properties: {
          staff_name: { type: "string", description: "Nombre del personal a buscar" },
          staff_id: { type: "string", description: "ID UUID" },
          updates: {
            type: "object",
            properties: {
              full_name: { type: "string" },
              username: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              is_active: { type: "boolean" },
            },
          },
          new_roles: { type: "array", items: { type: "string", enum: ["admin", "mozo", "cocina", "bartender", "cajero"] }, description: "Nuevos roles (reemplaza los anteriores)" },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_staff",
      description: "Desactivar un miembro del personal",
      parameters: {
        type: "object",
        properties: {
          staff_name: { type: "string" },
          staff_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_data",
      description: "Consultar datos específicos del sistema: ventas por rango de fecha, productos por categoría, gastos filtrados, etc.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ["products", "sales", "sale_items", "expenses", "staff", "inventory_purchases", "stock_adjustments", "kitchen_orders", "bartender_orders", "tickets", "ticket_events", "events", "cash_register_sessions"], description: "Tabla a consultar" },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike"] },
                value: { type: "string" },
              },
              required: ["column", "operator", "value"],
            },
            description: "Filtros a aplicar",
          },
          select: { type: "string", description: "Columnas a seleccionar (formato Supabase)" },
          order_by: { type: "string", description: "Columna para ordenar" },
          ascending: { type: "boolean", description: "Orden ascendente" },
          limit: { type: "number", description: "Límite de resultados" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_create_products",
      description: "Crear múltiples productos a la vez (útil para cargar inventario desde foto o lista)",
      parameters: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: "string", enum: ["drinks", "cocktails", "food", "supplies", "others", "semi_elaborated"] },
                sale_price: { type: "number" },
                purchase_price: { type: "number" },
                quantity: { type: "number" },
                min_stock: { type: "number" },
              },
              required: ["name", "category", "sale_price"],
            },
          },
        },
        required: ["products"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_prices",
      description: "Actualizar precios de múltiples productos a la vez",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                sale_price: { type: "number" },
                purchase_price: { type: "number" },
              },
              required: ["product_name"],
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_sale",
      description: "Crear una nueva venta con sus items. Busca productos por nombre para obtener precios y descuenta stock automáticamente.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string", description: "Nombre del producto" },
                quantity: { type: "number", description: "Cantidad vendida" },
                unit_price: { type: "number", description: "Precio unitario (si no se provee, se usa el del producto)" },
              },
              required: ["product_name", "quantity"],
            },
            description: "Lista de productos vendidos",
          },
          payment_method: { type: "string", enum: ["cash", "transfer", "qr"], description: "Método de pago" },
          staff_name: { type: "string", description: "Nombre del mozo/vendedor" },
          table_number: { type: "string", description: "Número de mesa (opcional)" },
          concept: { type: "string", description: "Concepto o nota de la venta" },
          payment_status: { type: "string", enum: ["cobrado", "no_cobrado"], description: "Estado de pago (por defecto cobrado)" },
        },
        required: ["items", "payment_method"],
      },
    },
  },
];

// Execute a tool call
async function executeTool(supabase: any, name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "create_product": {
        const { data, error } = await supabase.from("products").insert({
          name: args.name,
          category: args.category,
          sale_price: args.sale_price || 0,
          purchase_price: args.purchase_price || 0,
          quantity: args.quantity || 0,
          min_stock: args.min_stock || 5,
          is_for_sale: args.is_for_sale !== false,
          requires_kitchen: args.requires_kitchen || false,
        }).select().single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, product: data });
      }

      case "update_product": {
        let id = args.product_id;
        if (!id && args.product_name) {
          const { data } = await supabase.from("products").select("id").ilike("name", `%${args.product_name}%`).limit(1).single();
          if (data) id = data.id;
          else return JSON.stringify({ error: `Producto "${args.product_name}" no encontrado` });
        }
        if (!id) return JSON.stringify({ error: "Se requiere product_name o product_id" });
        const { data, error } = await supabase.from("products").update(args.updates).eq("id", id).select().single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, product: data });
      }

      case "delete_product": {
        let id = args.product_id;
        if (!id && args.product_name) {
          const { data } = await supabase.from("products").select("id").ilike("name", `%${args.product_name}%`).limit(1).single();
          if (data) id = data.id;
          else return JSON.stringify({ error: `Producto "${args.product_name}" no encontrado` });
        }
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, message: "Producto eliminado" });
      }

      case "adjust_stock": {
        const { data: product } = await supabase.from("products").select("id, quantity").ilike("name", `%${args.product_name}%`).limit(1).single();
        if (!product) return JSON.stringify({ error: `Producto "${args.product_name}" no encontrado` });
        
        await supabase.from("stock_adjustments").insert({
          product_id: product.id,
          product_name: args.product_name,
          previous_quantity: product.quantity,
          new_quantity: args.new_quantity,
          reason: args.reason,
          notes: args.notes || null,
        });
        
        const newStatus = args.new_quantity <= 0 ? 'critical' : args.new_quantity <= 5 ? 'low' : 'normal';
        await supabase.from("products").update({ quantity: args.new_quantity, status: newStatus }).eq("id", product.id);
        
        return JSON.stringify({ success: true, previous: product.quantity, new_quantity: args.new_quantity });
      }

      case "create_expense": {
        const { data, error } = await supabase.from("expenses").insert({
          amount: args.amount,
          category: args.category,
          description: args.description || null,
          payment_method: args.payment_method,
        }).select().single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, expense: data });
      }

      case "create_staff": {
        const { data: existing } = await supabase.from("staff").select("id").eq("username", args.username).single();
        if (existing) return JSON.stringify({ error: `Ya existe un usuario con nombre "${args.username}"` });

        const { data: staff, error } = await supabase.from("staff").insert({
          full_name: args.full_name,
          username: args.username,
          password_hash: args.password,
          email: args.email || null,
          phone: args.phone || null,
        }).select().single();
        if (error) return JSON.stringify({ error: error.message });

        if (args.roles && args.roles.length > 0) {
          await supabase.from("user_roles").insert(
            args.roles.map((role: string) => ({ staff_id: staff.id, role }))
          );
        }
        return JSON.stringify({ success: true, staff: { ...staff, roles: args.roles } });
      }

      case "update_staff": {
        let id = args.staff_id;
        if (!id && args.staff_name) {
          const { data } = await supabase.from("staff").select("id").ilike("full_name", `%${args.staff_name}%`).limit(1).single();
          if (data) id = data.id;
          else return JSON.stringify({ error: `Personal "${args.staff_name}" no encontrado` });
        }
        if (!id) return JSON.stringify({ error: "Se requiere staff_name o staff_id" });

        if (args.updates && Object.keys(args.updates).length > 0) {
          const { error } = await supabase.from("staff").update(args.updates).eq("id", id);
          if (error) return JSON.stringify({ error: error.message });
        }

        if (args.new_roles) {
          await supabase.from("user_roles").delete().eq("staff_id", id);
          await supabase.from("user_roles").insert(
            args.new_roles.map((role: string) => ({ staff_id: id, role }))
          );
        }
        return JSON.stringify({ success: true, message: "Personal actualizado" });
      }

      case "delete_staff": {
        let id = args.staff_id;
        if (!id && args.staff_name) {
          const { data } = await supabase.from("staff").select("id").ilike("full_name", `%${args.staff_name}%`).limit(1).single();
          if (data) id = data.id;
          else return JSON.stringify({ error: `Personal "${args.staff_name}" no encontrado` });
        }
        const { error } = await supabase.from("staff").update({ is_active: false }).eq("id", id);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, message: "Personal desactivado" });
      }

      case "query_data": {
        let query = supabase.from(args.table).select(args.select || "*");
        if (args.filters) {
          for (const f of args.filters) {
            query = query[f.operator](f.column, f.value);
          }
        }
        if (args.order_by) {
          query = query.order(args.order_by, { ascending: args.ascending !== false });
        }
        query = query.limit(args.limit || 50);
        const { data, error } = await query;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: data?.length || 0, data });
      }

      case "bulk_create_products": {
        const toInsert = args.products.map((p: any) => ({
          name: p.name,
          category: p.category,
          sale_price: p.sale_price || 0,
          purchase_price: p.purchase_price || 0,
          quantity: p.quantity || 0,
          min_stock: p.min_stock || 5,
          is_for_sale: true,
        }));
        const { data, error } = await supabase.from("products").insert(toInsert).select();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, count: data?.length, products: data });
      }

      case "bulk_update_prices": {
        const results: any[] = [];
        for (const u of args.updates) {
          const { data: product } = await supabase.from("products").select("id").ilike("name", `%${u.product_name}%`).limit(1).single();
          if (!product) {
            results.push({ product: u.product_name, error: "No encontrado" });
            continue;
          }
          const updateObj: any = {};
          if (u.sale_price !== undefined) updateObj.sale_price = u.sale_price;
          if (u.purchase_price !== undefined) updateObj.purchase_price = u.purchase_price;
          await supabase.from("products").update(updateObj).eq("id", product.id);
          results.push({ product: u.product_name, success: true });
        }
        return JSON.stringify({ results });
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Error ejecutando herramienta" });
  }
}

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

    // Fetch current data context
    const [
      { data: products },
      { data: recentSales },
      { data: staffList },
      { data: expenses },
    ] = await Promise.all([
      supabase.from("products").select("name, category, quantity, min_stock, sale_price, purchase_price, status, is_for_sale").limit(200),
      supabase.from("sales").select("id, total_amount, payment_method, payment_status, staff_name, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("staff").select("id, full_name, username, is_active"),
      supabase.from("expenses").select("amount, category, description, payment_method, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const systemPrompt = `Eres el **Asistente de Administración** de **Deja-Vu Retro Pub** 🎶

## Tu personalidad
- Sos profesional, claro y eficiente
- Usás español rioplatense (vos, sos, etc.)
- Respondés con formato markdown bien estructurado: usá títulos, listas, negritas, tablas cuando corresponda
- Usá emojis con moderación para hacer las respuestas más visuales
- Cuando ejecutás acciones, confirmá claramente qué hiciste

## Tus capacidades
Tenés acceso COMPLETO al sistema. Podés:
- ✅ **Crear, modificar y eliminar productos**
- ✅ **Ajustar stock** de cualquier producto
- ✅ **Registrar gastos**
- ✅ **Gestionar personal** (crear, editar, desactivar, cambiar roles)
- ✅ **Consultar cualquier dato** del sistema (ventas, gastos, inventario, pedidos, tickets, etc.)
- ✅ **Cargar productos en lote** desde fotos o listas
- ✅ **Actualizar precios masivamente**
- ✅ **Analizar fotos** de inventario y compararlas con el sistema

## Datos del sistema actual

**Productos (${products?.length || 0}):**
${JSON.stringify(products?.slice(0, 80) || [], null, 1)}

**Últimas ventas (${recentSales?.length || 0}):**
${JSON.stringify(recentSales?.slice(0, 15) || [], null, 1)}

**Personal:**
${JSON.stringify(staffList || [], null, 1)}

**Últimos gastos:**
${JSON.stringify(expenses?.slice(0, 10) || [], null, 1)}

## Reglas importantes
1. **Siempre ejecutá las acciones cuando te lo piden** - No preguntes "¿querés que lo haga?" simplemente hacelo.
2. Si te envían una foto del inventario, analizala y ofrecé cargar los datos automáticamente.
3. Cuando crees o modifiques datos, mostrá un resumen claro de lo que hiciste.
4. Para consultas complejas, usá la herramienta query_data.
5. Si no encontrás un producto por nombre, intentá con variaciones o informá al usuario.`;

    // Build AI messages
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Tool calling loop
    let currentMessages = aiMessages;
    let maxIterations = 5;

    while (maxIterations > 0) {
      maxIterations--;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: currentMessages,
          tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Límite de solicitudes alcanzado, intenta en unos minutos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      
      if (!choice) {
        return new Response(JSON.stringify({ error: "Respuesta vacía del modelo" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If the model wants to call tools
      if (choice.finish_reason === "tool_calls" && choice.message?.tool_calls) {
        // Add the assistant message with tool calls
        currentMessages.push(choice.message);

        // Execute each tool call
        for (const tc of choice.message.tool_calls) {
          const args = typeof tc.function.arguments === "string" 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments;
          
          console.log(`Executing tool: ${tc.function.name}`, args);
          const toolResult = await executeTool(supabase, tc.function.name, args);
          console.log(`Tool result: ${toolResult}`);

          currentMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        // Loop again to let the model process tool results
        continue;
      }

      // Model finished with a text response - stream it back
      const finalContent = choice.message?.content || "No tengo una respuesta en este momento.";
      
      // Now stream the final response for nice UX
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            ...currentMessages.slice(0, -1).filter((m: any) => m.role !== "tool" && !m.tool_calls),
            { role: "assistant", content: "Voy a responder ahora basándome en las acciones que realicé." },
            { role: "user", content: `Reformulá esta respuesta de forma estética con markdown:\n\n${finalContent}` },
          ],
          stream: true,
        }),
      });

      if (streamResponse.ok) {
        return new Response(streamResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Fallback: return non-streamed as SSE
      const encoder = new TextEncoder();
      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: finalContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(encoder.encode(sseData), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Max iterations reached
    const encoder = new TextEncoder();
    const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: "Se alcanzó el límite de operaciones por mensaje. Podés pedirme más en el siguiente mensaje." } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(encoder.encode(sseData), {
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
