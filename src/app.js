import bodyParser from "body-parser";
import express from "express";
import emailRoutes from "./routes/emailRoute.js";
import { userEvents } from "./services/service.js";

const app = express();

app.use(bodyParser.json());
app.use("/app/email", emailRoutes);

userEvents().catch((error) => {
  console.error("Error conectando a RabbitMQ:", error);
});

export default app;
