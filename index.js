const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

// Objeto para guardar el estado temporal de cada usuario (ej. { "521444...": { step: "WAITING_NAME", data: {} } })
const userStates = {};

// 1. Verificación del Webhook (Meta)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. Recepción de mensajes entrantes de WhatsApp
app.post('/webhook', async (req, res) => {
    // Respondemos 200 OK inmediatamente a Meta
    res.sendStatus(200);

    try {
        const body = req.body;

        if (body.object) {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const message = value?.messages?.[0];

            if (message && message.type === 'text') {
                const phone_number_id = value.metadata.phone_number_id;
                const from = message.from; 
                const msgBody = message.text.body.trim();
                const msgLower = msgBody.toLowerCase();

                console.log(`Mensaje recibido de ${from}: ${msgBody}`);

                let respuestaTexto = "";

                // Si el usuario escribe '0', 'menu' o 'hola', reiniciamos su estado al menú principal
                if (msgLower === 'hola' || msgLower === 'menu' || msgLower === '0') {
                    delete userStates[from]; // Limpiamos cualquier estado previo
                    
                    respuestaTexto = 
                        "🧀 *Bienvenido a Lácteos Carranco* (Proyecto Escolar UPSLP)\n\n" +
                        "Selecciona una opción escribiendo el número:\n" +
                        "1️⃣ Ver Catálogo de Productos (5 principales)\n" +
                        "2️⃣ Preguntas Frecuentes (FAQs)\n" +
                        "3️⃣ Simular Pedido / Cita (Interactivo)\n" +
                        "4️⃣ Contactar a Asesor Humano\n" +
                        "5️⃣ Acerca del Equipo y Empresa\n" +
                        "6️⃣ Propuesta 1: Automatización de Inventarios IoT\n" +
                        "7️⃣ Propuesta 2: Campañas de Fidelización por WhatsApp\n" +
                        "8️⃣ Propuesta 3: Integración de Pagos Digitales con CoDi\n" +
                        "9️⃣ Mensaje de Cierre / Despedida\n\n" +
                        "Escribe *0* para volver a este menú en cualquier momento.";
                } 
                // Revisamos si el usuario está en medio de un flujo interactivo de pedido
                else if (userStates[from] && userStates[from].step === 'WAITING_NAME') {
                    // Guardamos el nombre y pasamos al siguiente paso (pedir producto/cantidad)
                    userStates[from].data.name = msgBody;
                    userStates[from].step = 'WAITING_PRODUCT';

                    respuestaTexto = 
                        `Mucho gusto, *${msgBody}* 🧀.\n\n` +
                        "¿Qué producto de Lácteos Carranco y qué cantidad deseas ordenar? (Ej: 2 Quesos Panela y 1 Crema).";
                }
                else if (userStates[from] && userStates[from].step === 'WAITING_PRODUCT') {
                    // Guardamos el producto y pasamos al siguiente paso (pedir dirección)
                    userStates[from].data.product = msgBody;
                    userStates[from].step = 'WAITING_ADDRESS';

                    respuestaTexto = 
                        "Perfecto. Por último, ¿cuál es tu *dirección de entrega* en San Luis Potosí?";
                }
                else if (userStates[from] && userStates[from].step === 'WAITING_ADDRESS') {
                    // Recogemos la dirección y finalizamos la simulación
                    const orderData = userStates[from].data;
                    orderData.address = msgBody;

                    // Borramos el estado para que vuelva a la normalidad
                    delete userStates[from];

                    respuestaTexto = 
                        "🎉 *¡Pedido simulado registrado con éxito!* 🎉\n\n" +
                        "📋 *Resumen de tu orden para Carranco:*\n" +
                        `• *Cliente:* ${orderData.name}\n` +
                        `• *Pedido:* ${orderData.product}\n` +
                        `• *Dirección:* ${orderData.address}\n\n` +
                        "*(Nota: Proyecto escolar UPSLP sin validez comercial real)*.\n\n" +
                        "Escribe *menu* para volver a las opciones principales.";
                }
                // Menús principales si el usuario no está en un flujo activo
                else if (msgLower === '1') {
                    respuestaTexto = 
                        "🧀 *Catálogo de Productos Carranco*:\n\n" +
                        "1. *Queso Ranchero Carranco (300g)* - Tradicional, ideal para antojitos.\n" +
                        "2. *Queso Panela Carranco (400g)* - Fresco, suave y de gran calidad.\n" +
                        "3. *Crema Carranco (450g)* - Crema entera pasteurizada de excelente sabor.\n" +
                        "4. *Queso Manchego Carranco* - Excelente para fundir en tus platillos.\n" +
                        "5. *Mantequilla Artesanal Carranco* - Elaborada 100% con crema de leche.\n\n" +
                        "Escribe *3* para iniciar la simulación de pedido o *0* para volver al menú.";
                } 
                else if (msgLower === '2') {
                    respuestaTexto = 
                        "❓ *Preguntas Frecuentes (FAQs)*:\n\n" +
                        "• *Horarios:* Lunes a Viernes de 8:00 AM a 6:00 PM.\n" +
                        "• *Conservación:* Mantener en refrigeración entre 2°C y 6°C.\n" +
                        "• *Cobertura:* Entregas simuladas en SLP.\n\n" +
                        "Escribe *0* para regresar al menú.";
                } 
                // INICIO DE LA SIMULACIÓN DE PEDIDO INTERACTIVA (Opción 3)
                else if (msgLower === '3') {
                    // Inicializamos el estado del usuario en el paso 1 (esperando nombre)
                    userStates[from] = {
                        step: 'WAITING_NAME',
                        data: {}
                    };

                    respuestaTexto = 
                        "🛒 *Simulación de Pedido Interactiva* (Lácteos Carranco)\n\n" +
                        "Para comenzar, por favor dime: ¿Cuál es tu *Nombre Completo*?";
                } 
                else if (msgLower === '4') {
                    respuestaTexto = 
                        "👥 *Contacto con Asesor Humano*:\n\n" +
                        "Te hemos derivado con un operador del equipo escolar de Lácteos Carranco. Te atenderemos en breve. Escribe *0* para volver al menú.";
                } 
                else if (msgLower === '5') {
                    respuestaTexto = 
                        "ℹ️ *Acerca del Proyecto*:\n\n" +
                        "Desarrollado por alumnos de Ingeniería en Tecnologías de la Información de la **Universidad Politécnica de San Luis Potosí (UPSLP)**.\n\n" +
                        "Escribe *0* para volver al menú.";
                } 
                else if (msgLower === '6') {
                    respuestaTexto = 
                        "🚀 *Propuesta 1: Automatización de Inventarios IoT*\n\n" +
                        "Sensores en refrigeradores de distribuidores en SLP para alerta y reabastecimiento automático vía bot.\n\n" +
                        "Escribe *0* para volver al menú.";
                } 
                else if (msgLower === '7') {
                    respuestaTexto = 
                        "💡 *Propuesta 2: Campañas de Fidelización por WhatsApp*\n\n" +
                        "Cupones digitales y puntos por compras frecuentes de quesos y cremas.\n\n" +
                        "Escribe *0* para volver al menú.";
                } 
                else if (msgLower === '8') {
                    respuestaTexto = 
                        "💳 *Propuesta 3: Integración de Pagos Digitales con CoDi*\n\n" +
                        "Generación de códigos QR de cobro inmediato directo en el chat para transacciones seguras.\n\n" +
                        "Escribe *0* para volver al menú.";
                } 
                else if (msgLower === '9' || msgLower.includes('gracias') || msgLower.includes('adios')) {
                    delete userStates[from];
                    respuestaTexto = 
                        "👋 *¡Gracias por contactar a Lácteos Carranco!* \n\n" +
                        "Esperamos que este prototipo escolar haya sido de tu agrado. ¡Excelente día desde San Luis Potosí! Escribe *menu* para reiniciar.";
                } 
                else {
                    respuestaTexto = "¡Hola! No reconocí ese comando. Escribe *menu* para ver las opciones disponibles de Carranco.";
                }

                // Enviar respuesta a Meta Cloud API
                await axios.post(
                    `https://graph.facebook.com/v17.0/${phone_number_id}/messages`,
                    {
                        messaging_product: "whatsapp",
                        to: from,
                        text: { body: respuestaTexto },
                    },
                    {
                        headers: { Authorization: `Bearer ${TOKEN}` },
                    }
                );
            }
        }
    } catch (error) {
        console.error("Error al procesar mensaje:", error.response?.data || error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de Lácteos Carranco corriendo en puerto ${PORT}`);
});