// server/config/supabase.js - Configuração do cliente Supabase para o Portal DMA
import 'dotenv/config'; // 💡 Garante que as variáveis carreguem ANTES do cliente instanciar
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
