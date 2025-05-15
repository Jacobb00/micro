FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production
RUN npm install prom-client@15.1.3 --save

COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"] 