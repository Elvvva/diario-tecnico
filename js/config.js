// Configuración de la nube (Supabase). Si se deja vacío, la app funciona solo en local, como en la Fase 1.
// Estos dos valores NO son secretos: la seguridad la da el SQL de supabase/schema.sql (cada cuenta solo ve lo suyo).
// Cómo conseguirlos: README › "Cuenta y sincronización".
export const SUPABASE_URL = 'https://pvcstzbmcijbkdscvzxd.supabase.co';       // ej. 'https://abcdxyz.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2Y3N0emJtY2lqYmtkc2N2enhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjU3MDksImV4cCI6MjEwNzI0MTcwOX0.F8pVYL0HOmcOxQ6iZrI4bA8jEihHDiaA1mwAK6tJ9Nk';  // clave "anon" o "publishable" del proyecto
