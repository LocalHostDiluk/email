#Usar una imagen base de Node.js
FROM node:22

#Crear un directorio de trabajo dentro del contenedor
WORKDIR /app

#Copiar el archivo package.json al directorio de trabajo
COPY package*.json ./

#Instalar las dependencias del proyecto
RUN npm install

#Copiar el codigo fuente al contenedor
COPY . .

#Exponer el puerto en el que corre el servicio
EXPOSE 5000

#Comando para ejecutar la aplicacion
CMD ["node", "index.js"]