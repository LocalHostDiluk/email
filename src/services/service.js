import amqp from "amqplib";
import dotenv from "dotenv";
import transporter from "../config/emailConfig.js";
import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hbsOptions = {
  viewEngine: {
    layoutsDir: path.join(__dirname, '../../views'),  
    partialsDir: path.join(__dirname, '../../views'), // Asegura que pueda encontrar `styles.hbs`
    defaultLayout: 'main',
  },
  viewPath: path.join(__dirname, '../../views') 
};

transporter.use('compile', hbs(hbsOptions));

export async function userEvents() {
  try {
    const connection = await amqp.connect({
      protocol: "amqps",  // Cambia de "amqp" a "amqps"
      hostname: process.env.RABBITMQ_HOST,
      port: 5671,  // Usa el puerto para TLS
      username: process.env.RABBITMQ_USER,
      password: process.env.RABBITMQ_PASS,
      vhost: process.env.RABBITMQ_VHOST,
    });

    const channel = await connection.createChannel();

    const exchange = "user_event";
    const queue = "user_created_queue";
    const routingKey = "user.created";

    await channel.assertExchange(exchange, "topic", { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, routingKey);

    console.log(`[*] Waiting for messages in ${queue}.`);

    channel.consume(
      queue,
      async (msg) => {
        if (msg !== null) {
          try {
            const response = JSON.parse(msg.content.toString());

            await transporter.sendMail({
              from: process.env.EMAIL,
              to: response.username,
              subject: `Para ${response.username}`,
              template: "welcomeMessage",
              context: {
                username: response.username,
              },
            });

            channel.ack(msg);
          } catch (emailError) {
            console.error("Error sending email:", emailError);
            channel.ack(msg);
          }
        }
      },
      { noAck: false }
    );

    // =================================
    // 2. Evento: user.recover (password)
    // =================================
    const recoverQueue = 'user_recover_queue';
    const recoverRoutingKey = 'user.recover';

    await channel.assertQueue(recoverQueue, { durable: true });
    await channel.bindQueue(recoverQueue, exchange, recoverRoutingKey);

    channel.consume(recoverQueue, async (msg) => {
      if (msg !== null) {
        const data = JSON.parse(msg.content.toString());
        console.log("Mensaje de recuperación recibido:", data);

        try {
          await transporter.sendMail({
            from: process.env.EMAIL,
            to: data.email,
            subject: data.subject || "Recuperación de contraseña",
            template: "recovery",
            context: {
              email: data.email
            },
          });
          console.log(`Correo de recuperación enviado a ${data.email}`);
        } catch (error) {
          console.error("Error al enviar correo de recuperación:", error);
        }

        channel.ack(msg);
      }
    }, { noAck: false });
    
    connection.on("close", () => {
      console.error("Conexión cerrada, reconectando en 5s...");
      setTimeout(userEvents, 5000);
    });
  } catch (error) {
    console.error("Error conectando a RabbitMQ:", error.message);
    console.error("Reintentando en 5s...");
    setTimeout(userEvents, 5000);
  }
}
