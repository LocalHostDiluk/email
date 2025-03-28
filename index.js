import app from "./src/app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT_EXPRESS;

app.listen(PORT, () => {
  console.log("RabbitMQ Config:");
  console.log("Host:", process.env.RABBITMQ_HOST);
  console.log("User:", process.env.RABBITMQ_USER);
  console.log("Pass:", process.env.RABBITMQ_PASS ? "********" : "NO DEFINIDO");
  console.log("VHost:", process.env.RABBITMQ_USER);

  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
