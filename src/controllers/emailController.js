import transporter from "../config/emailConfig.js";
import dotenv from "dotenv";

dotenv.config();

export const sendEmail = async (req, res) => {
  const { to, subject, nombre, mensaje } = req.body;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL,
      to,
      subject,
      template: 'email', // Nombre de la plantilla Handlebars
      context: { nombre, mensaje },
    });
    return res.status(200).json({ message: "Correo enviado con éxito" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
