import amqp from "amqplib";
import dotenv from "dotenv";
import transporter from "../config/emailConfig.js";
import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar handlebars para correos
const hbsOptions = {
  viewEngine: {
    layoutsDir: path.join(__dirname, "../../views"),
    partialsDir: path.join(__dirname, "../../views"),
    defaultLayout: "main",
  },
  viewPath: path.join(__dirname, "../../views"),
};

transporter.use("compile", hbs(hbsOptions));

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

    await channel.assertExchange(exchange, "topic", { durable: true });

    // =============== Evento: user.created ===============
    const createdQueue = "user_created_queue";
    const createdRoutingKey = "user.created";

    await channel.assertQueue(createdQueue, { durable: true });
    await channel.bindQueue(createdQueue, exchange, createdRoutingKey);

    channel.consume(
      createdQueue,
      async (msg) => {
        if (msg !== null) {
          const user = JSON.parse(msg.content.toString());
          console.log("Mensaje de registro recibido:", user);

          try {
            await transporter.sendMail({
              from: process.env.EMAIL,
              to: user.username,
              subject: `Bienvenido, ${user.username}!`,
              template: "welcomeMessage",
              context: {
                username: user.username,
              },
            });
            console.log(`Correo de bienvenida enviado a ${user.username}`);
          } catch (error) {
            console.error("Error enviando correo de bienvenida:", error);
          }

          channel.ack(msg);
        }
      },
      { noAck: false }
    );

    // =============== Evento: user.recover ===============
    const recoverQueue = "user_recover_queue";
    const recoverRoutingKey = "user.recover";

    await channel.assertQueue(recoverQueue, { durable: true });
    await channel.bindQueue(recoverQueue, exchange, recoverRoutingKey);

    channel.consume(
      recoverQueue,
      async (msg) => {
        if (msg !== null) {
          const data = JSON.parse(msg.content.toString());
          console.log("Mensaje de recuperación recibido:", data);

          try {
            await transporter.sendMail({
              from: process.env.EMAIL,
              to: data.email,
              subject: data.subject || "Recuperación de contraseña",
              template: "recovery", // Asegúrate de tener esta plantilla
              context: {
                email: data.email,
              },
            });
            console.log(`Correo de recuperación enviado a ${data.email}`);
          } catch (error) {
            console.error("Error enviando correo de recuperación:", error);
          }

          channel.ack(msg);
        }
      },
      { noAck: false }
    );

    // Reintento en caso de caída de la conexión
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
