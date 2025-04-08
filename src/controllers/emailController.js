import transporter from "../config/emailConfig.js";
import dotenv from "dotenv";
import hbs from "nodemailer-express-handlebars";
import path from "path";

dotenv.config();

const opcionesHandlebars = {
  viewEngine: {
    partialsDir: path.resolve("./views/partials"), // Si usas partials
    defaultLayout: "./views/main.hbs", // Habilita el diseño principal
  },
  viewPath: path.resolve("./views/"),
  extName: ".hbs",
};

transporter.use("compile", hbs(opcionesHandlebars));

export const sendEmail = async (req, res) => {
  const { to, subject, context, template } = req.body;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL,
      to,
      subject,
      template: template,
      context: context,
    });
    return res.status(200).json({ message: "Correo enviado con éxito" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
