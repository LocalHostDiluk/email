import amqp from 'amqplib';
import dotenv from 'dotenv';
import transporter from "../config/emailConfig.js";

dotenv.config();

export async function userEvents() {
  try {
    const connection = await amqp.connect({
      protocol: 'amqps',
      hostname: process.env.RABBITMQ_URL,
      port: 5671,
      username: process.env.RABBITMQ_USER,
      password: process.env.RABBIT_PASS,
      vhost: process.env.RABBITMQ_VHOST
    });

    const channel = await connection.createChannel();
    const exchange = 'user_event';

    await channel.assertExchange(exchange, 'topic', { durable: true });

    // =======================
    // 1. Evento: user.created
    // =======================
    const createdQueue = 'user_created_queue';
    const createdRoutingKey = 'user.created';

    await channel.assertQueue(createdQueue, { durable: true });
    await channel.bindQueue(createdQueue, exchange, createdRoutingKey);

    channel.consume(createdQueue, async (msg) => {
      if (msg !== null) {
        const user = JSON.parse(msg.content.toString());
        console.log("Mensaje de registro recibido:", user);

        try {
          await transporter.sendMail({
            from: process.env.EMAIL,
            to: user.username,
            subject: "¡Bienvenido a la plataforma!",
            template: "email",
            context: {
              nombre: user.username,
              password: user.password,
              mensaje: "Gracias por registrarte en nuestra plataforma. ¡Te damos la bienvenida!",
            },
          });
          console.log(`Correo de bienvenida enviado a ${user.username}`);
        } catch (error) {
          console.error("Error al enviar correo de bienvenida:", error);
        }
        channel.ack(msg);
      }
    }, { noAck: false });

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

    connection.on('close', () => {
      console.error('Conexión cerrada, intentando reconectar en 5s...');
      setTimeout(userEvents, 5000);
    });

  } catch (error) {
    console.error('Error al conectar a RabbitMQ:', error.message);
    console.log('Reintentando en 5s...');
    setTimeout(userEvents, 5000);
  }
}
