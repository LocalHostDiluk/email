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
      protocol: "amqps",
      hostname: process.env.RABBITMQ_HOST,
      port: 5671,
      username: process.env.RABBITMQ_USER,
      password: process.env.RABBITMQ_PASS,
      vhost: process.env.RABBITMQ_VHOST,
    });

    const channel = await connection.createChannel();

    const exchange = "user_event";
    const welcomeQueue = "user_created_queue";
    const recoverQueue = "user_recover_queue";

    // Declaramos el exchange y las dos colas
    await channel.assertExchange(exchange, "topic", { durable: true });

    // Cola para correo de bienvenida
    await channel.assertQueue(welcomeQueue, { durable: true });
    await channel.bindQueue(welcomeQueue, exchange, "user.created");

    // Cola para recuperación de contraseña
    await channel.assertQueue(recoverQueue, { durable: true });
    await channel.bindQueue(recoverQueue, exchange, "user.recover");

    console.log(`[*] Waiting for messages in queues...`);

    // Consumidor para correos de bienvenida
    channel.consume(
      welcomeQueue,
      async (msg) => {
        if (msg !== null) {
          try {
            const response = JSON.parse(msg.content.toString());

            await transporter.sendMail({
              from: process.env.EMAIL,
              to: response.username,
              subject: `Bienvenido, ${response.username}`,
              template: "welcomeMessage",
              context: {
                username: response.username,
              },
            });

            channel.ack(msg);
          } catch (error) {
            console.error("Error enviando correo de bienvenida:", error);
            channel.ack(msg);
          }
        }
      },
      { noAck: false }
    );

    // Consumidor para correos de recuperación
    channel.consume(
      recoverQueue,
      async (msg) => {
        if (msg !== null) {
          try {
            const data = JSON.parse(msg.content.toString());

            await transporter.sendMail({
              from: process.env.EMAIL,
              to: data.email,
              subject: data.subject,
              template: "recoverPassword", // asegúrate de tener recoverPassword.hbs
              context: {
                email: data.email,
                body: data.body,
              },
            });

            console.log(`Correo de recuperación enviado a ${data.email}`);
            channel.ack(msg);
          } catch (error) {
            console.error("Error enviando correo de recuperación:", error);
            channel.ack(msg);
          }
        }
      },
      { noAck: false }
    );

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
